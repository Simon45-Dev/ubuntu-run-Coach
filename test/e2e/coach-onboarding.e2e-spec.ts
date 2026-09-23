import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createAthleteForCoach, createPlatformAdmin, loginAs, registerCoach } from './utils/fixtures';

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

  it('a coach from a different organisation cannot resend a coach invite', async () => {
    const org = await registerCoach(app);
    const otherOrg = await registerCoach(app);
    const token = await adminToken();
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email, name: 'Invited Coach' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/coaches/${inviteRes.body.id}/resend-invite`)
      .set('Authorization', `Bearer ${otherOrg.accessToken}`)
      .expect(404);
  });

  it('an athlete cannot invite or resend-invite a coach', async () => {
    const org = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, org.accessToken, org.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ email: `invitee-${Date.now()}@example.test`, name: 'Invited Coach' })
      .expect(403);
  });

  it('a coach can invite a second coach into their own organisation', async () => {
    const org = await registerCoach(app);
    const email = `invitee-${Date.now()}@example.test`;

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .send({ email, name: 'Second Coach' })
      .expect(201);
    expect(typeof inviteRes.body.inviteToken).toBe('string');

    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'AcceptedPassword123!' })
      .expect(200);
    expect(typeof acceptRes.body.accessToken).toBe('string');
  });

  it('a coach cannot invite a coach into another organisation', async () => {
    const org = await registerCoach(app);
    const otherOrg = await registerCoach(app);

    await request(app.getHttpServer())
      .post(`/api/v1/organisations/${otherOrg.organisationId}/coaches`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .send({ email: `invitee-${Date.now()}@example.test`, name: 'Should Not Work' })
      .expect(403);
  });

  it('a coach can resend an invite within their own organisation', async () => {
    const org = await registerCoach(app);
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${org.organisationId}/coaches`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .send({ email, name: 'Second Coach' })
      .expect(201);
    const oldToken = inviteRes.body.inviteToken as string;

    const resendRes = await request(app.getHttpServer())
      .post(`/api/v1/coaches/${inviteRes.body.id}/resend-invite`)
      .set('Authorization', `Bearer ${org.accessToken}`)
      .expect(201);
    expect(resendRes.body.inviteToken).not.toBe(oldToken);
  });
});
