import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createRaceGoalForAthlete,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Race goals (e2e)', () => {
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

  it('an athlete creates their own race goal, and their coach can read and update it', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    const goal = await createRaceGoalForAthlete(app, athleteToken, athlete.id, {
      raceName: 'Spring Marathon',
    });

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/race-goals`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body[0].raceName).toBe('Spring Marathon');

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/race-goals/${goal.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ status: 'COMPLETED', actualTimeSeconds: 14400 })
      .expect(200);
    expect(patchRes.body.status).toBe('COMPLETED');
    expect(patchRes.body.actualTimeSeconds).toBe(14400);
  });

  it('a coach creates a race goal on behalf of their athlete', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    await createRaceGoalForAthlete(app, coach.accessToken, athlete.id);
  });

  it("a coach cannot create, read, or update a race goal for another coach's athlete", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const goal = await createRaceGoalForAthlete(app, coachB.accessToken, athleteB.id);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athleteB.id}/race-goals`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ raceName: 'Hijack', raceDate: new Date().toISOString(), distance: '10K' })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athleteB.id}/race-goals`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/race-goals/${goal.id}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ raceName: 'Hijacked' })
      .expect(404);
  });

  it("an athlete cannot create or read a peer athlete's race goal, even under the same coach", async () => {
    const coach = await registerCoach(app);
    const athlete1 = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athlete2 = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    await createRaceGoalForAthlete(app, coach.accessToken, athlete2.id);
    const athlete1Token = await loginAs(app, athlete1.email, athlete1.password);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete2.id}/race-goals`)
      .set('Authorization', `Bearer ${athlete1Token}`);
    expect([403, 404]).toContain(getRes.status);

    const postRes = await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete2.id}/race-goals`)
      .set('Authorization', `Bearer ${athlete1Token}`)
      .send({ raceName: 'Hijack', raceDate: new Date().toISOString(), distance: '10K' });
    expect([403, 404]).toContain(postRes.status);
  });
});
