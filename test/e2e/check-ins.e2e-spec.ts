import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createPlatformAdmin,
  grantHealthConsent,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Check-ins (e2e)', () => {
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

  it('an athlete without consent cannot submit a check-in', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .put(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ date: new Date().toISOString(), energy: 7 })
      .expect(403);
  });

  it('an athlete grants consent then submits a check-in', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    await grantHealthConsent(app, athleteToken, athlete.id);

    const res = await request(app.getHttpServer())
      .put(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({
        date: new Date().toISOString(),
        sleepQuality: 8,
        energy: 7,
        soreness: 3,
        stress: 2,
        motivation: 9,
        pain: 'Slight left calf tightness',
      })
      .expect(200);

    expect(res.body.sleepQuality).toBe(8);
    expect(res.body.pain).toBe('Slight left calf tightness');
  });

  it('submitting again on the same day upserts in place rather than duplicating', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    await grantHealthConsent(app, athleteToken, athlete.id);
    const today = new Date().toISOString();

    const first = await request(app.getHttpServer())
      .put(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ date: today, energy: 5 })
      .expect(200);

    const second = await request(app.getHttpServer())
      .put(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ date: today, energy: 9 })
      .expect(200);

    expect(second.body.id).toBe(first.body.id);
    expect(second.body.energy).toBe(9);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(listRes.body.items).toHaveLength(1);
  });

  it("a coach can read their own roster athlete's check-ins once consent exists", async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    await grantHealthConsent(app, athleteToken, athlete.id);
    await request(app.getHttpServer())
      .put(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ date: new Date().toISOString(), pain: 'Sore hamstring' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].pain).toBe('Sore hamstring');
  });

  it("a coach cannot read another coach's athlete's check-ins", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    await grantHealthConsent(app, athleteToken, athlete.id);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);
  });

  it('withdrawing consent blocks both submitting and reading, including for the coach', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    const consent = await grantHealthConsent(app, athleteToken, athlete.id);
    await request(app.getHttpServer())
      .put(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ date: new Date().toISOString(), energy: 6 })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/consents/${consent.id}/withdraw`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .put(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ date: new Date().toISOString(), energy: 6 })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(403);
  });

  it('PLATFORM_ADMIN can read check-ins regardless of consent state', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    await grantHealthConsent(app, athleteToken, athlete.id);
    await request(app.getHttpServer())
      .put(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ date: new Date().toISOString(), energy: 6 })
      .expect(200);

    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items).toHaveLength(1);
  });
});
