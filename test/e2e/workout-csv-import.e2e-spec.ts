import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createTrainingPlanForAthlete,
  loginAs,
  registerCoach,
} from './utils/fixtures';

function daysFromNow(n: number): string {
  return new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

describe('Workout CSV import (e2e)', () => {
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

  it('imports every row from a valid CSV', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);

    const csv = [
      'date,type,distanceKm,durationSec,rpeTarget,instructions',
      `${daysFromNow(1)},EASY,8,2400,4,Keep it conversational`,
      `${daysFromNow(3)},TEMPO,10,,7,`,
      `${daysFromNow(5)},LONG_RUN,20,7200,6,`,
    ].join('\n');

    const res = await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${plan.id}/workouts/import`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', Buffer.from(csv), 'workouts.csv')
      .expect(201);

    expect(res.body).toHaveLength(3);
    expect(res.body.map((w: { type: string }) => w.type)).toEqual(['EASY', 'TEMPO', 'LONG_RUN']);
    expect(res.body[0].distanceTargetKm).toBe('8');
    expect(res.body[0].instructions).toBe('Keep it conversational');

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${plan.id}/workouts`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(3);
  });

  it('rejects the whole import when one row has an out-of-range date, creating nothing', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);

    const csv = ['date,type', `${daysFromNow(1)},EASY`, `${daysFromNow(9999)},EASY`].join('\n');

    const res = await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${plan.id}/workouts/import`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', Buffer.from(csv), 'workouts.csv')
      .expect(400);
    expect(res.body.errors[0]).toMatch(/Row 3/);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${plan.id}/workouts`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body).toHaveLength(0);
  });

  it('rejects an invalid workout type with a row-numbered message', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);

    const csv = ['date,type', `${daysFromNow(1)},SPRINT`].join('\n');

    const res = await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${plan.id}/workouts/import`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', Buffer.from(csv), 'workouts.csv')
      .expect(400);
    expect(res.body.errors[0]).toMatch(/Row 2.*type/);
  });

  it('an athlete cannot import workouts', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const plan = await createTrainingPlanForAthlete(app, coach.accessToken, athlete.id);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    const csv = ['date,type', `${daysFromNow(1)},EASY`].join('\n');

    await request(app.getHttpServer())
      .post(`/api/v1/training-plans/${plan.id}/workouts/import`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .attach('file', Buffer.from(csv), 'workouts.csv')
      .expect(403);
  });
});
