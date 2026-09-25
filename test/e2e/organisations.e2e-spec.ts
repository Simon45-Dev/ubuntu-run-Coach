import { existsSync } from 'fs';
import { join } from 'path';
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

// Smallest possible valid 1x1 PNG.
const PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function logoPath(logoUrl: string): string {
  return join(process.cwd(), 'uploads', 'avatars', logoUrl.split('/').pop()!);
}

describe('Organisations (e2e)', () => {
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

  it('a coach can read and rename their own organisation', async () => {
    const coach = await registerCoach(app, { organisationName: 'Original Name' });

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(getRes.body.name).toBe('Original Name');

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/organisations/${coach.organisationId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Renamed Org' })
      .expect(200);
    expect(patchRes.body.name).toBe('Renamed Org');
  });

  it("PLATFORM_ADMIN can update an organisation's name and type", async () => {
    const coach = await registerCoach(app, { organisationName: 'Original Name' });
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/organisations/${coach.organisationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Admin Renamed Org', type: 'CLUB' })
      .expect(200);
    expect(patchRes.body.name).toBe('Admin Renamed Org');
    expect(patchRes.body.type).toBe('CLUB');
  });

  it('rejects an empty organisation name on update', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .patch(`/api/v1/organisations/${coach.organisationId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: '' })
      .expect(400);
  });

  it('PLATFORM_ADMIN can create a new organisation', async () => {
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    const res = await request(app.getHttpServer())
      .post('/api/v1/organisations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New Running Club' })
      .expect(201);
    expect(res.body.name).toBe('New Running Club');
    expect(res.body.type).toBe('SOLO');

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${res.body.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(getRes.body.id).toBe(res.body.id);
  });

  it('a non-admin cannot create an organisation', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .post('/api/v1/organisations')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Should Not Work' })
      .expect(403);
  });

  it('only PLATFORM_ADMIN can list all organisations', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .get('/api/v1/organisations')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(403);

    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);
    const res = await request(app.getHttpServer())
      .get('/api/v1/organisations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items.some((org: { id: string }) => org.id === coach.organisationId)).toBe(
      true,
    );
  });

  it('a coach can upload, replace, and remove their own organisation logo', async () => {
    const coach = await registerCoach(app);

    const first = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/logo`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', PNG_BUFFER, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201);
    expect(first.body.logoUrl).toMatch(/^\/uploads\/avatars\/.+\.png$/);
    const firstPath = logoPath(first.body.logoUrl);
    expect(existsSync(firstPath)).toBe(true);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/logo`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', PNG_BUFFER, { filename: 'logo2.png', contentType: 'image/png' })
      .expect(201);
    expect(second.body.logoUrl).not.toBe(first.body.logoUrl);
    expect(existsSync(firstPath)).toBe(false);

    await request(app.getHttpServer())
      .delete(`/api/v1/organisations/${coach.organisationId}/logo`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200)
      .expect((res) => expect(res.body.logoUrl).toBeNull());
    expect(existsSync(logoPath(second.body.logoUrl))).toBe(false);
  });

  it('a club admin can change their own organisation logo, but a coach from a different org cannot', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const clubAdmin = await createClubAdminForCoach(app, coachA.accessToken, coachA.organisationId);
    const clubAdminToken = await loginAs(app, clubAdmin.email, clubAdmin.password);

    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/logo`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .attach('file', PNG_BUFFER, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/logo`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .attach('file', PNG_BUFFER, { filename: 'logo.png', contentType: 'image/png' })
      .expect(403);
  });

  it('a club member cannot change the organisation logo', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/logo`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', PNG_BUFFER, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201);

    const memberRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-members`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ firstName: 'Test', lastName: 'Member', email: 'logo-test@example.test' })
      .expect(201);
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/club-members/${memberRes.body.id}/invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(201);
    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'MemberPassword123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/logo`)
      .set('Authorization', `Bearer ${acceptRes.body.accessToken}`)
      .attach('file', PNG_BUFFER, { filename: 'logo.png', contentType: 'image/png' })
      .expect(403);
  });
});
