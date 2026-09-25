import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createClubAdminForCoach,
  createPlatformAdmin,
  createTrainingPlanForAthlete,
  createWorkoutForPlan,
  loginAs,
  registerCoach,
} from './utils/fixtures';

/**
 * The highest-risk area of this slice: one athlete must never see another
 * athlete's data, and a coach must never see another coach's roster, even
 * within the same organisation. See src/common/guards/org-scope.guard.ts
 * and src/common/scope/scope-filters.ts for the enforcement this exercises.
 */
describe('RBAC data isolation (e2e)', () => {
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

  it('an athlete cannot read another athlete from a different coach/org', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteA = await createAthleteForCoach(app, coachA.accessToken, coachA.coachId);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);

    const athleteAToken = await loginAs(app, athleteA.email, athleteA.password);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athleteB.id}`)
      .set('Authorization', `Bearer ${athleteAToken}`);
    expect([403, 404]).toContain(res.status);
  });

  it('an athlete cannot read a peer athlete under the SAME coach - the explicit red line', async () => {
    const coach = await registerCoach(app);
    const athlete1 = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athlete2 = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    const athlete1Token = await loginAs(app, athlete1.email, athlete1.password);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete2.id}`)
      .set('Authorization', `Bearer ${athlete1Token}`);
    expect([403, 404]).toContain(res.status);
  });

  it('an athlete can read their own record', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(res.body.id).toBe(athlete.id);
  });

  it("a coach cannot list another coach's roster", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coachB.coachId}/athletes`)
      .set('Authorization', `Bearer ${coachA.accessToken}`);
    expect([403, 404]).toContain(res.status);
  });

  it("a coach cannot read another coach's athlete directly by id", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athleteB.id}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`);
    expect([403, 404]).toContain(res.status);
  });

  it("a coach cannot read another organisation's Organisation or Subscription-bearing record", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);

    await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coachB.organisationId}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coachB.organisationId}/coaches`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(403);
  });

  it('PLATFORM_ADMIN can cross organisations (audited writes are covered in audit-log.e2e-spec.ts)', async () => {
    const coach = await registerCoach(app);
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.id).toBe(coach.organisationId);
  });

  it('an athlete-role token is rejected on a coach-only route (privilege escalation attempt)', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .post(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ email: 'escalation@example.test', password: 'TestPassword123!', name: 'X' })
      .expect(403);
  });

  it('an athlete cannot reassign their own coach', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coachA.accessToken, coachA.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .patch(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ coachId: coachB.coachId })
      .expect(403);
  });

  it("an athlete cannot read another athlete's training plan (different coach)", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteA = await createAthleteForCoach(app, coachA.accessToken, coachA.coachId);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const planB = await createTrainingPlanForAthlete(app, coachB.accessToken, athleteB.id);

    const athleteAToken = await loginAs(app, athleteA.email, athleteA.password);

    await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${planB.id}`)
      .set('Authorization', `Bearer ${athleteAToken}`)
      .expect(404);
  });

  it("an athlete cannot read a peer athlete's training plan under the SAME coach", async () => {
    const coach = await registerCoach(app);
    const athlete1 = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athlete2 = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan2 = await createTrainingPlanForAthlete(app, coach.accessToken, athlete2.id);

    const athlete1Token = await loginAs(app, athlete1.email, athlete1.password);

    await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${plan2.id}`)
      .set('Authorization', `Bearer ${athlete1Token}`)
      .expect(404);
  });

  it("a coach cannot read another coach's training plan or workout, even same org", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const planB = await createTrainingPlanForAthlete(app, coachB.accessToken, athleteB.id);
    const workoutB = await createWorkoutForPlan(app, coachB.accessToken, planB.id);

    await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${planB.id}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workoutB.id}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);
  });

  it("an athlete cannot read or submit a result for another athlete's workout", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteA = await createAthleteForCoach(app, coachA.accessToken, coachA.coachId);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const planB = await createTrainingPlanForAthlete(app, coachB.accessToken, athleteB.id);
    const workoutB = await createWorkoutForPlan(app, coachB.accessToken, planB.id);

    const athleteAToken = await loginAs(app, athleteA.email, athleteA.password);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workoutB.id}/result`)
      .set('Authorization', `Bearer ${athleteAToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .put(`/api/v1/workouts/${workoutB.id}/result`)
      .set('Authorization', `Bearer ${athleteAToken}`)
      .send({ rpe: 5 })
      .expect(404);
  });

  it('an athlete-role token is rejected on training-plan/workout write routes (privilege escalation attempt)', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const workout = await createWorkoutForPlan(app, coach.accessToken, plan.id);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/training-plans`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ name: 'Escalation', startDate: new Date().toISOString() })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${plan.id}/workouts`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ scheduledDate: new Date().toISOString(), type: 'EASY' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/workouts/${workout.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('PLATFORM_ADMIN can read training plans and workouts across organisations', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const workout = await createWorkoutForPlan(app, coach.accessToken, plan.id);
    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);

    await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${plan.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/workouts/${workout.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
  });

  it('a coach cannot read the message thread between another coach and their own athlete', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const athleteBToken = await loginAs(app, athleteB.email, athleteB.password);
    const athleteBMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${athleteBToken}`)
      .expect(200);

    // Coach A guessing at Athlete B's userId can't read a thread they were
    // never part of - the relationship check, not just object ownership,
    // is what blocks this.
    await request(app.getHttpServer())
      .get(`/api/v1/users/${athleteBMe.body.userId}/messages`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);
  });

  it('a CLUB_ADMIN token is rejected on athlete- and training-plan-scoped routes (privilege escalation attempt)', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const clubAdmin = await createClubAdminForCoach(app, coach.accessToken, coach.organisationId);
    const clubAdminToken = await loginAs(app, clubAdmin.email, clubAdmin.password);

    await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .expect(403);

    // No @Roles() on this route - OrgScopeGuard's 'athlete' branch is a
    // no-op for CLUB_ADMIN, so this is rejected by buildAthleteScopeFilter's
    // default case instead (a synchronous throw, before any DB lookup).
    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/training-plans`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ name: 'Escalation', startDate: new Date().toISOString() })
      .expect(403);

    // Coach-profile hardening: a CLUB_ADMIN can't read a coach's profile
    // either, even within their own organisation.
    await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .expect(403);
  });
});
