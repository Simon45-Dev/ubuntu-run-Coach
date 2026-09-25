import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createPlatformAdmin, loginAs, registerCoach } from './utils/fixtures';

const MEMBER_INPUT = {
  firstName: 'Sipho',
  lastName: 'Dlamini',
  email: 'sipho@example.test',
  phone: '0821234567',
  nextOfKinName: 'Thandi Dlamini',
  nextOfKinPhone: '0839876543',
  nextOfKinRelationship: 'Spouse',
};

describe('Club Members (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  it('a coach creates a club member with no login, and it appears on the org list', async () => {
    const coach = await registerCoach(app);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);
    expect(createRes.body.membershipNumber).toBe('0001');
    expect(createRes.body.user).toBeNull();

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].id).toBe(createRes.body.id);
  });

  it('membership numbers are sequential per organisation, and a second organisation starts independently at 0001', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);

    const first = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ ...MEMBER_INPUT, email: 'first@example.test' })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ ...MEMBER_INPUT, email: 'second@example.test' })
      .expect(201);
    expect(first.body.membershipNumber).toBe('0001');
    expect(second.body.membershipNumber).toBe('0002');

    const otherOrgFirst = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachB.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .send({ ...MEMBER_INPUT, email: 'other-org@example.test' })
      .expect(201);
    expect(otherOrgFirst.body.membershipNumber).toBe('0001');
  });

  it('a coach can invite a member, who then accepts and can view/update their own profile', async () => {
    const coach = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);
    const memberId = createRes.body.id as string;

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/club-members/${memberId}/invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(201);
    const token = inviteRes.body.inviteToken as string;

    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token, password: 'MemberPassword123!' })
      .expect(200);
    const memberToken = acceptRes.body.accessToken as string;

    const meRes = await request(app.getHttpServer())
      .get(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(meRes.body.firstName).toBe('Sipho');

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/club-members/${memberId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ address: '123 Main Road, Johannesburg' })
      .expect(200);
    expect(updateRes.body.address).toBe('123 Main Road, Johannesburg');
  });

  it('a coach from a different organisation gets 404, not the member data', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/club-members/${createRes.body.id}`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coachA.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .expect(403);
  });

  it('PLATFORM_ADMIN can see club members across every organisation', async () => {
    const coach = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);

    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    await request(app.getHttpServer())
      .get(`/api/v1/club-members/${createRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('soft-deletes a club member, and it disappears from the org list', async () => {
    const coach = await registerCoach(app);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(MEMBER_INPUT)
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/club-members/${createRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(0);
  });

  it('validates required fields on creation', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ firstName: 'Incomplete' })
      .expect(400);
  });
});
