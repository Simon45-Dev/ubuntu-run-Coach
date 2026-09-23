import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createRaceGoalForAthlete,
  createTrainingPlanForAthlete,
  createWorkoutForPlan,
  grantHealthConsent,
  loginAs,
  registerCoach,
} from './utils/fixtures';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();
}

describe('Action Centre (e2e)', () => {
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

  it('a coach sees a MISSED_TRAINING alert for an athlete with 2+ unmet past-due workouts', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id, {
      startDate: daysAgo(20),
    });
    await createWorkoutForPlan(app, coach.accessToken, plan.id, { scheduledDate: daysAgo(10) });
    await createWorkoutForPlan(app, coach.accessToken, plan.id, { scheduledDate: daysAgo(5) });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/action-centre`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const missed = res.body.alerts.find(
      (a: { type: string; athleteId: string }) =>
        a.type === 'MISSED_TRAINING' && a.athleteId === athlete.id,
    );
    expect(missed).toBeDefined();
    expect(missed.priority).toBe('MEDIUM');
  });

  it('a PAIN_INJURY alert only appears after consent is granted and pain logged, and disappears if consent is withdrawn', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    const noConsentRes = await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/action-centre`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(noConsentRes.body.alerts.some((a: { type: string }) => a.type === 'PAIN_INJURY')).toBe(
      false,
    );

    const consent = await grantHealthConsent(app, athleteToken, athlete.id);
    await request(app.getHttpServer())
      .put(`/api/v1/athletes/${athlete.id}/check-ins`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ date: new Date().toISOString(), pain: 'Sharp pain in left knee' })
      .expect(200);

    const withPainRes = await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/action-centre`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    const painAlert = withPainRes.body.alerts.find(
      (a: { type: string }) => a.type === 'PAIN_INJURY',
    );
    expect(painAlert).toBeDefined();
    expect(painAlert.priority).toBe('HIGH');

    await request(app.getHttpServer())
      .patch(`/api/v1/consents/${consent.id}/withdraw`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);

    const afterWithdrawRes = await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/action-centre`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(
      afterWithdrawRes.body.alerts.some((a: { type: string }) => a.type === 'PAIN_INJURY'),
    ).toBe(false);
  });

  it("a coach cannot fetch another coach's action centre", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);

    await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coachB.coachId}/action-centre`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(403);
  });

  it('an athlete-role token is rejected', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/action-centre`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);
  });

  it('RACE_APPROACHING appears for a race within 14 days and not for one further out', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    await createRaceGoalForAthlete(app, coach.accessToken, athlete.id, {
      raceName: 'Near Race',
      raceDate: daysFromNow(10),
    });
    await createRaceGoalForAthlete(app, coach.accessToken, athlete.id, {
      raceName: 'Far Race',
      raceDate: daysFromNow(60),
    });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/action-centre`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const raceAlerts = res.body.alerts.filter(
      (a: { type: string }) => a.type === 'RACE_APPROACHING',
    );
    expect(raceAlerts).toHaveLength(1);
    expect(raceAlerts[0].payload.raceName).toBe('Near Race');
  });
});
