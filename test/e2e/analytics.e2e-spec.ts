import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  addGroupMember,
  createAthleteForCoach,
  createGroupForCoach,
  createTrainingPlanForAthlete,
  createWorkoutForPlan,
  loginAs,
  registerCoach,
} from './utils/fixtures';

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

describe('Analytics (e2e)', () => {
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

  it("a coach can fetch their athlete's analytics summary after some workouts are completed and some missed", async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const workout1 = await createWorkoutForPlan(app, coach.accessToken, plan.id, {
      scheduledDate: daysFromNow(1),
    });
    await createWorkoutForPlan(app, coach.accessToken, plan.id, {
      scheduledDate: daysFromNow(3),
    });

    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workout1.id}/result`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ actualDistanceKm: 8, actualDurationSec: 2400 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/analytics?from=${daysFromNow(0)}&to=${daysFromNow(10)}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    expect(res.body.adherence).toEqual({ scheduled: 2, completed: 1, rate: 0.5 });
    expect(res.body.volume.totalDistanceKm).toBeCloseTo(8);
    expect(res.body.volume.totalDurationSec).toBe(2400);
    expect(Array.isArray(res.body.weeklyTrend)).toBe(true);
  });

  it("a coach cannot fetch another coach's athlete's analytics", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athleteB.id}/analytics`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);
  });

  it('rejects from after to', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/analytics?from=${daysFromNow(10)}&to=${daysFromNow(0)}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(400);
  });

  it("a group workout result submitted by one member only counts toward that athlete's own summary", async () => {
    const coach = await registerCoach(app);
    const memberA = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const memberB = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const group = await createGroupForCoach(app, coach.accessToken, coach.coachId);
    await addGroupMember(app, coach.accessToken, group.id, memberA.id);
    await addGroupMember(app, coach.accessToken, group.id, memberB.id);

    const planRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${group.id}/training-plans`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Group Plan', startDate: daysFromNow(0) })
      .expect(201);
    const workoutRes = await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${planRes.body.id}/workouts`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ scheduledDate: daysFromNow(2), type: 'EASY' })
      .expect(201);

    const memberAToken = await loginAs(app, memberA.email, memberA.password);
    await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workoutRes.body.id}/result`)
      .set('Authorization', `Bearer ${memberAToken}`)
      .send({ actualDistanceKm: 6 })
      .expect(200);

    const rangeQuery = `from=${daysFromNow(0)}&to=${daysFromNow(10)}`;
    const aRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${memberA.id}/analytics?${rangeQuery}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(aRes.body.adherence).toEqual({ scheduled: 1, completed: 1, rate: 1 });

    const bRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${memberB.id}/analytics?${rangeQuery}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(bRes.body.adherence).toEqual({ scheduled: 1, completed: 0, rate: 0 });
  });
});
