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

describe('Workout results (e2e)', () => {
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

  it('GET before any submission returns 404', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const workout = await createWorkoutForPlan(app, coach.accessToken, plan.id);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workout.id}/result`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(404);
  });

  it('an athlete submits their own result, and the coach can view it', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const workout = await createWorkoutForPlan(app, coach.accessToken, plan.id);

    const athleteToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: athlete.email, password: athlete.password })
    ).body.accessToken as string;

    const putRes = await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workout.id}/result`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ actualDistanceKm: 5.2, rpe: 6, comments: 'Felt good' })
      .expect(200);
    expect(putRes.body.rpe).toBe(6);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workout.id}/result`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(getRes.body.comments).toBe('Felt good');
  });

  it('a coach can submit a result on behalf of their athlete', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const workout = await createWorkoutForPlan(app, coach.accessToken, plan.id);

    await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workout.id}/result`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ rpe: 4 })
      .expect(200);
  });

  it('re-submitting updates the existing result rather than erroring', async () => {
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
      .put(`/api/v1/workouts/${workout.id}/result`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ rpe: 5 })
      .expect(200);

    const secondRes = await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workout.id}/result`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ rpe: 7, comments: 'Correcting my earlier entry' })
      .expect(200);
    expect(secondRes.body.rpe).toBe(7);
    expect(secondRes.body.comments).toBe('Correcting my earlier entry');

    const results = await prisma.workoutResult.findMany({ where: { workoutId: workout.id } });
    expect(results).toHaveLength(1);
  });
});
