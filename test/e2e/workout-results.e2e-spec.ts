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

  async function createGroupWorkout(
    app: INestApplication,
    coach: { accessToken: string; coachId: string },
  ) {
    const group = await createGroupForCoach(app, coach.accessToken, coach.coachId);
    const planRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${group.id}/training-plans`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Group Plan', startDate: new Date().toISOString() })
      .expect(201);
    const workoutRes = await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${planRes.body.id}/workouts`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ scheduledDate: new Date().toISOString(), type: 'EASY' })
      .expect(201);
    return { groupId: group.id as string, workoutId: workoutRes.body.id as string };
  }

  it('two members of the same group each get an independent result for the same shared workout', async () => {
    const coach = await registerCoach(app);
    const memberA = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const memberB = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const { groupId, workoutId } = await createGroupWorkout(app, coach);
    await addGroupMember(app, coach.accessToken, groupId, memberA.id);
    await addGroupMember(app, coach.accessToken, groupId, memberB.id);

    await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workoutId}/result`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ athleteId: memberA.id, rpe: 3 })
      .expect(200);
    await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workoutId}/result`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ athleteId: memberB.id, rpe: 8 })
      .expect(200);

    const allRes = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workoutId}/results`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(allRes.body).toHaveLength(2);
    const rpeByAthlete = Object.fromEntries(
      allRes.body.map((r: { athleteId: string; rpe: number }) => [r.athleteId, r.rpe]),
    );
    expect(rpeByAthlete[memberA.id]).toBe(3);
    expect(rpeByAthlete[memberB.id]).toBe(8);
  });

  it('a group member submits their own result for a shared workout without specifying athleteId', async () => {
    const coach = await registerCoach(app);
    const member = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const { groupId, workoutId } = await createGroupWorkout(app, coach);
    await addGroupMember(app, coach.accessToken, groupId, member.id);
    const memberToken = await loginAs(app, member.email, member.password);

    await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workoutId}/result`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ rpe: 6 })
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workoutId}/result`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(res.body.rpe).toBe(6);
  });

  it('GET /workouts/:id/result without ?athleteId= on a group workout is rejected for a coach', async () => {
    const coach = await registerCoach(app);
    const { workoutId } = await createGroupWorkout(app, coach);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workoutId}/result`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(400);
  });

  it('a coach cannot submit a group result for an athlete who is not a member', async () => {
    const coach = await registerCoach(app);
    const outsider = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const { workoutId } = await createGroupWorkout(app, coach);

    await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workoutId}/result`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ athleteId: outsider.id, rpe: 5 })
      .expect(404);
  });
});
