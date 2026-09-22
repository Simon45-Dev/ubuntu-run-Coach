import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createPlatformAdmin,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Messages (e2e)', () => {
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

  it('a coach sends to their own athlete, the athlete sees it and marks it read', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    const athleteMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    const athleteUserId = athleteMe.body.userId as string;

    const sendRes = await request(app.getHttpServer())
      .post(`/api/v1/users/${athleteUserId}/messages`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ content: 'How did the long run go?' })
      .expect(201);
    expect(sendRes.body.content).toBe('How did the long run go?');
    expect(sendRes.body.readAt).toBeNull();

    const threadRes = await request(app.getHttpServer())
      .get(`/api/v1/users/${coach.userId}/messages`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(threadRes.body.items).toHaveLength(1);
    expect(threadRes.body.items[0].id).toBe(sendRes.body.id);

    const readRes = await request(app.getHttpServer())
      .patch(`/api/v1/messages/${sendRes.body.id}/read`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(readRes.body.readAt).not.toBeNull();
  });

  it('an athlete sends to their own coach', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${coach.userId}/messages`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ content: 'Felt great, thanks!' })
      .expect(201);
  });

  it('a coach cannot message an athlete outside their roster', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const athleteBToken = await loginAs(app, athleteB.email, athleteB.password);
    const athleteBMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${athleteBToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${athleteBMe.body.userId}/messages`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ content: 'Hijack attempt' })
      .expect(404);
  });

  it('an athlete cannot message a coach that is not their own', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteA = await createAthleteForCoach(app, coachA.accessToken, coachA.coachId);
    const athleteAToken = await loginAs(app, athleteA.email, athleteA.password);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${coachB.userId}/messages`)
      .set('Authorization', `Bearer ${athleteAToken}`)
      .send({ content: 'Wrong coach' })
      .expect(404);
  });

  it('rejects messaging yourself', async () => {
    const coach = await registerCoach(app);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${coach.userId}/messages`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ content: 'Note to self' })
      .expect(400);
  });

  it("cannot mark someone else's message as read", async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await loginAs(app, athlete.email, athlete.password)}`)
      .expect(200);

    const sendRes = await request(app.getHttpServer())
      .post(`/api/v1/users/${athleteMe.body.userId}/messages`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ content: 'For the athlete only' })
      .expect(201);

    // The sender (coach) is not the receiver, so cannot mark it read.
    await request(app.getHttpServer())
      .patch(`/api/v1/messages/${sendRes.body.id}/read`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(404);
  });

  it('PLATFORM_ADMIN can message anyone across organisations', async () => {
    const coach = await registerCoach(app);
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${coach.userId}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Platform notice' })
      .expect(201);
  });
});
