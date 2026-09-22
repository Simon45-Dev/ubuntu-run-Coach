import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createTrainingPlanForAthlete,
  createWorkoutForPlan,
  registerCoach,
} from './utils/fixtures';

describe('Workouts (e2e)', () => {
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

  it('a coach creates, lists, and reschedules a workout within a plan', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const workout = await createWorkoutForPlan(app, coach.accessToken, plan.id, { type: 'TEMPO' });

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${plan.id}/workouts`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body.map((w: { id: string }) => w.id)).toContain(workout.id);

    const newDate = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/workouts/${workout.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ scheduledDate: newDate })
      .expect(200);
    expect(new Date(patchRes.body.scheduledDate).toISOString()).toBe(newDate);
  });

  it('rejects a workout scheduled outside the training plan dates', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id, {
      startDate: '2026-01-01T00:00:00.000Z',
      endDate: '2026-01-31T00:00:00.000Z',
    });

    await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${plan.id}/workouts`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ scheduledDate: '2026-03-01T00:00:00.000Z', type: 'EASY' })
      .expect(400);
  });

  it('rejects creating a workout under a training plan outside the coach scope', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const planB = await createTrainingPlanForAthlete(app, coachB.accessToken, athleteB.id);

    await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${planB.id}/workouts`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ scheduledDate: new Date().toISOString(), type: 'EASY' })
      .expect(404);
  });

  it('an athlete can view but not modify their scheduled workout', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const workout = await createWorkoutForPlan(app, coach.accessToken, plan.id);

    const athleteToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: athlete.email, password: athlete.password })
    ).body.accessToken as string;

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workout.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/workouts/${workout.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ instructions: 'self edit' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/workouts/${workout.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('soft-deletes a workout', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const workout = await createWorkoutForPlan(app, coach.accessToken, plan.id);

    await request(app.getHttpServer())
      .delete(`/api/v1/workouts/${workout.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workout.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(404);
  });
});
