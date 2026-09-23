import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createPlatformAdmin, loginAs, registerCoach } from './utils/fixtures';

describe('Coach onboarding via invite (e2e)', () => {
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

  async function adminToken() {
    const admin = await createPlatformAdmin(prisma);
    return loginAs(app, admin.email, admin.password);
  }

  it('PLATFORM_ADMIN invites a coach, who accepts and can then log in normally', async () => {
    const org = await registerCoach(app);
    const token = await adminToken();
    const email = `invitee-${Date.now()}@example.test`;

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, name: 'Invited Coach' })
      .expect(201);
    expect(typeof inviteRes.body.inviteToken).toBe('string');
    expect(inviteRes.body.inviteToken.length).toBeGreaterThan(20);

    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'AcceptedPassword123!' })
      .expect(200);
    expect(typeof acceptRes.body.accessToken).toBe('string');

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'AcceptedPassword123!' })
      .expect(200);
    expect(typeof loginRes.body.accessToken).toBe('string');
  });

  it('an invited coach cannot log in with any password before accepting', async () => {
    const org = await registerCoach(app);
    const token = await adminToken();
    const email = `invitee-${Date.now()}@example.test`;
    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, name: 'Invited Coach' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WhateverPassword123!' })
      .expect(401);
  });

  it('accepting with an expired token is rejected', async () => {
    const org = await registerCoach(app);
    const token = await adminToken();
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, name: 'Invited Coach' })
      .expect(201);

    await prisma.user.update({
      where: { email },
      data: { inviteTokenExpiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'SomePassword123!' })
      .expect(401);
  });

  it('accepting the same token twice fails the second time', async () => {
    const org = await registerCoach(app);
    const token = await adminToken();
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, name: 'Invited Coach' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'FirstAccept123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'SecondAccept123!' })
      .expect(401);
  });

  it('resending an invite regenerates a working token and invalidates the old one', async () => {
    const org = await registerCoach(app);
    const token = await adminToken();
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, name: 'Invited Coach' })
      .expect(201);
    const oldToken = inviteRes.body.inviteToken as string;

    const resendRes = await request(app.getHttpServer())
      .post(`/api/v1/coaches/${inviteRes.body.id}/resend-invite`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    const newToken = resendRes.body.inviteToken as string;
    expect(newToken).not.toBe(oldToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: oldToken, password: 'ShouldFail123!' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: newToken, password: 'ShouldWork123!' })
      .expect(200);
  });

  it('cannot resend an invite for a coach who has already accepted', async () => {
    const org = await registerCoach(app);
    const token = await adminToken();
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, name: 'Invited Coach' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'AlreadyAccepted123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/coaches/${inviteRes.body.id}/resend-invite`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });

  it('a non-admin cannot resend a coach invite', async () => {
    const org = await registerCoach(app);
    const token = await adminToken();
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, name: 'Invited Coach' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/coaches/${inviteRes.body.id}/resend-invite`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(403);
  });
});
