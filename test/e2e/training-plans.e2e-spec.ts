import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  addGroupMember,
  createAthleteForCoach,
  createGroupForCoach,
  createTrainingPlanForAthlete,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Training plans (e2e)', () => {
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

  it('a coach creates and lists training plans for their own athlete', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id, {
      name: '10K Base Build',
    });

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/training-plans`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body.map((p: { id: string }) => p.id)).toContain(plan.id);

    const getRes = await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${plan.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(getRes.body.name).toBe('10K Base Build');
    expect(getRes.body.status).toBe('DRAFT');
  });

  it('a coach cannot create a training plan for an athlete outside their roster', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athleteB.id}/training-plans`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ name: 'Hijack Plan', startDate: new Date().toISOString() })
      .expect(404);
  });

  it('rejects an endDate before startDate on create', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/training-plans`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({
        name: 'Bad Dates',
        startDate: '2026-06-01T00:00:00.000Z',
        endDate: '2026-05-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('a coach can update plan status and phase', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/training-plans/${plan.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ status: 'ACTIVE', phase: 'BUILD' })
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.phase).toBe('BUILD');
  });

  it('an athlete cannot create, update, or delete a training plan', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const athleteToken = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: athlete.email, password: athlete.password })
    ).body.accessToken as string;

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/training-plans`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ name: 'Self-assigned', startDate: new Date().toISOString() })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/training-plans/${plan.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ name: 'Renamed' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/training-plans/${plan.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('deleting a plan cascades to hide its workouts', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);

    const workoutRes = await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${plan.id}/workouts`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ scheduledDate: new Date().toISOString(), type: 'EASY' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/training-plans/${plan.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workoutRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${plan.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(404);
  });

  it('a group-assigned plan is visible to every member, but not to a non-member on the same roster', async () => {
    const coach = await registerCoach(app);
    const memberA = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const memberB = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const nonMember = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const group = await createGroupForCoach(app, coach.accessToken, coach.coachId);
    await addGroupMember(app, coach.accessToken, group.id, memberA.id);
    await addGroupMember(app, coach.accessToken, group.id, memberB.id);

    const planRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${group.id}/training-plans`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Group Base Build', startDate: new Date().toISOString() })
      .expect(201);

    for (const member of [memberA, memberB]) {
      const memberToken = await loginAs(app, member.email, member.password);
      await request(app.getHttpServer())
        .get(`/api/v1/training-plans/${planRes.body.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);

      const listRes = await request(app.getHttpServer())
        .get(`/api/v1/athletes/${member.id}/training-plans`)
        .set('Authorization', `Bearer ${memberToken}`)
        .expect(200);
      expect(listRes.body.map((p: { id: string }) => p.id)).toContain(planRes.body.id);
    }

    const nonMemberToken = await loginAs(app, nonMember.email, nonMember.password);
    await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${planRes.body.id}`)
      .set('Authorization', `Bearer ${nonMemberToken}`)
      .expect(404);
  });
});
