import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createClubAdminForCoach,
  createPlatformAdmin,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Club Admins (e2e)', () => {
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

  it('a coach invites a club admin, who accepts and can manage club members but not coaching data', async () => {
    const coach = await registerCoach(app);

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-admins`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email: 'admin@example.test', name: 'Club Admin' })
      .expect(201);
    expect(inviteRes.body.user.status).toBe('INVITED');

    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'ClubAdminPassword123!' })
      .expect(200);
    const clubAdminToken = acceptRes.body.accessToken as string;

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .expect(200);
    expect(meRes.body.role).toBe('CLUB_ADMIN');
    expect(meRes.body.organisationId).toBe(coach.organisationId);

    // Can manage club members - create, list, record a payment.
    const memberRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ firstName: 'Sipho', lastName: 'Dlamini', email: 'sipho@example.test' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/club-members/${memberRes.body.id}/payments`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ amount: 100, method: 'CASH', paidAt: '2026-01-15' })
      .expect(201);

    // Cannot see coaching data - guard-layer role rejection, no DB lookup
    // needed, so this is 403 even with a made-up id.
    await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/athletes/some-athlete-id/training-plans')
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ name: 'Plan', startDate: new Date().toISOString() })
      .expect(403);

    // Cannot view coach profiles either (coach-profile hardening).
    await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .expect(403);
  });

  it('a club admin cannot invite or remove other club admins', async () => {
    const coach = await registerCoach(app);
    const clubAdmin = await createClubAdminForCoach(app, coach.accessToken, coach.organisationId);
    const clubAdminToken = await loginAs(app, clubAdmin.email, clubAdmin.password);

    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-admins`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ email: 'another-admin@example.test', name: 'Another Admin' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/club-admins/${clubAdmin.id}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .expect(403);
  });

  it('a coach from a different organisation cannot invite into another club, and cross-org access 404s', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);

    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-admins`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .send({ email: 'cross-org@example.test', name: 'Cross Org' })
      .expect(403);

    const clubAdmin = await createClubAdminForCoach(app, coachA.accessToken, coachA.organisationId);
    await request(app.getHttpServer())
      .delete(`/api/v1/club-admins/${clubAdmin.id}`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .expect(404);
  });

  it('PLATFORM_ADMIN can invite, list, and remove club admins across every organisation', async () => {
    const coach = await registerCoach(app);
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-admins`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'platform-invited@example.test', name: 'Platform Invited Admin' })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-admins`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(1);

    await request(app.getHttpServer())
      .delete(`/api/v1/club-admins/${inviteRes.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('a coach can resend a club admin invite, and removing them drops them from the org list', async () => {
    const coach = await registerCoach(app);
    const clubAdmin = await createClubAdminForCoach(app, coach.accessToken, coach.organisationId);

    const resendRes = await request(app.getHttpServer())
      .post(`/api/v1/club-admins/${clubAdmin.id}/resend-invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(400); // already accepted in the fixture, so a resend is rejected
    expect(resendRes.body.message).toContain('already accepted');

    await request(app.getHttpServer())
      .delete(`/api/v1/club-admins/${clubAdmin.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-admins`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(0);
  });
});
