import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createAthleteForCoach, loginAs, registerCoach } from './utils/fixtures';

describe('Personal bests (e2e)', () => {
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

  it('an athlete creates their own PB, and their coach can read and update it', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/personal-bests`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ distance: '10K', timeSeconds: 2400 })
      .expect(201);
    expect(createRes.body.distance).toBe('10K');
    expect(createRes.body.source).toBe('SELF_REPORTED');

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/personal-bests`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body[0].timeSeconds).toBe(2400);

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/personal-bests/${createRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ timeSeconds: 2350, source: 'VERIFIED' })
      .expect(200);
    expect(patchRes.body.timeSeconds).toBe(2350);
    expect(patchRes.body.source).toBe('VERIFIED');
  });

  it('a coach creates a PB on behalf of their athlete and can delete it', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/personal-bests`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ distance: 'Marathon', timeSeconds: 12600, achievedDate: '2026-01-01' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/personal-bests/${createRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/personal-bests`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(0);
  });

  it("a coach cannot create, read, or update a PB for another coach's athlete", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const createRes = await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athleteB.id}/personal-bests`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .send({ distance: '5K', timeSeconds: 1000 })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athleteB.id}/personal-bests`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ distance: '5K', timeSeconds: 900 })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athleteB.id}/personal-bests`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/personal-bests/${createRes.body.id}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ timeSeconds: 800 })
      .expect(404);
  });
});
