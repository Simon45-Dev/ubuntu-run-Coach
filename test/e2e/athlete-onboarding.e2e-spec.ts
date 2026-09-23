import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { registerCoach } from './utils/fixtures';

describe('Athlete onboarding via invite (e2e)', () => {
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

  it('a coach invites an athlete, who accepts and can then log in normally', async () => {
    const coach = await registerCoach(app);
    const email = `invitee-${Date.now()}@example.test`;

    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email, name: 'Invited Athlete' })
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

  it('an invited athlete cannot log in with any password before accepting', async () => {
    const coach = await registerCoach(app);
    const email = `invitee-${Date.now()}@example.test`;
    await request(app.getHttpServer())
      .post(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email, name: 'Invited Athlete' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'WhateverPassword123!' })
      .expect(401);
  });

  it('accepting with an invalid token is rejected', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: 'not-a-real-token', password: 'SomePassword123!' })
      .expect(401);
  });

  it('accepting with an expired token is rejected', async () => {
    const coach = await registerCoach(app);
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email, name: 'Invited Athlete' })
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
    const coach = await registerCoach(app);
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email, name: 'Invited Athlete' })
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
    const coach = await registerCoach(app);
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email, name: 'Invited Athlete' })
      .expect(201);
    const oldToken = inviteRes.body.inviteToken as string;

    const resendRes = await request(app.getHttpServer())
      .post(`/api/v1/athletes/${inviteRes.body.id}/resend-invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
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

  it('a coach cannot resend an invite for an athlete who has already accepted', async () => {
    const coach = await registerCoach(app);
    const email = `invitee-${Date.now()}@example.test`;
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email, name: 'Invited Athlete' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'AlreadyAccepted123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${inviteRes.body.id}/resend-invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(400);
  });
});
