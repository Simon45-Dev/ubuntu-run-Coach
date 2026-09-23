import { INestApplication } from '@nestjs/common';
import * as argon2 from 'argon2';
import request from 'supertest';
import { PrismaService } from '../../../src/database/prisma.service';
import { Role, UserStatus } from '@prisma/client';

const DEFAULT_PASSWORD = 'TestPassword123!';

export async function registerCoach(
  app: INestApplication,
  overrides: Partial<{
    email: string;
    password: string;
    name: string;
    organisationName: string;
  }> = {},
) {
  const email =
    overrides.email ?? `coach-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({
      email,
      password: overrides.password ?? DEFAULT_PASSWORD,
      name: overrides.name ?? 'Test Coach',
      organisationName: overrides.organisationName ?? 'Test Org',
    })
    .expect(201);

  const accessToken = res.body.accessToken as string;
  const me = await request(app.getHttpServer())
    .get('/api/v1/auth/me')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);

  return {
    email,
    password: overrides.password ?? DEFAULT_PASSWORD,
    accessToken,
    userId: me.body.userId as string,
    coachId: me.body.coachId as string,
    organisationId: me.body.organisationId as string,
  };
}

export async function createAthleteForCoach(
  app: INestApplication,
  coachAccessToken: string,
  coachId: string,
  overrides: Partial<{ email: string; password: string; name: string }> = {},
) {
  const email =
    overrides.email ?? `athlete-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const res = await request(app.getHttpServer())
    .post(`/api/v1/coaches/${coachId}/athletes`)
    .set('Authorization', `Bearer ${coachAccessToken}`)
    .send({
      email,
      password: overrides.password ?? DEFAULT_PASSWORD,
      name: overrides.name ?? 'Test Athlete',
    })
    .expect(201);

  return { id: res.body.id as string, email, password: overrides.password ?? DEFAULT_PASSWORD };
}

export async function loginAs(app: INestApplication, email: string, password: string) {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return res.body.accessToken as string;
}

export async function createTrainingPlanForAthlete(
  app: INestApplication,
  coachAccessToken: string,
  athleteId: string,
  overrides: Partial<{
    name: string;
    startDate: string;
    endDate: string;
    goal: string;
  }> = {},
) {
  const startDate = overrides.startDate ?? new Date().toISOString();
  const endDate =
    overrides.endDate ?? new Date(Date.now() + 84 * 24 * 60 * 60 * 1000).toISOString();
  const res = await request(app.getHttpServer())
    .post(`/api/v1/athletes/${athleteId}/training-plans`)
    .set('Authorization', `Bearer ${coachAccessToken}`)
    .send({
      name: overrides.name ?? 'Test Training Plan',
      startDate,
      endDate,
      goal: overrides.goal,
    })
    .expect(201);

  return { id: res.body.id as string, startDate, endDate };
}

export async function createWorkoutForPlan(
  app: INestApplication,
  coachAccessToken: string,
  trainingPlanId: string,
  overrides: Partial<{ scheduledDate: string; type: string; instructions: string }> = {},
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/training-plans/${trainingPlanId}/workouts`)
    .set('Authorization', `Bearer ${coachAccessToken}`)
    .send({
      scheduledDate: overrides.scheduledDate ?? new Date().toISOString(),
      type: overrides.type ?? 'EASY',
      instructions: overrides.instructions,
    })
    .expect(201);

  return { id: res.body.id as string };
}

export async function createGroupForCoach(
  app: INestApplication,
  coachAccessToken: string,
  coachId: string,
  overrides: Partial<{ name: string }> = {},
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/coaches/${coachId}/groups`)
    .set('Authorization', `Bearer ${coachAccessToken}`)
    .send({ name: overrides.name ?? 'Test Group' })
    .expect(201);

  return { id: res.body.id as string };
}

export async function addGroupMember(
  app: INestApplication,
  coachAccessToken: string,
  groupId: string,
  athleteId: string,
) {
  await request(app.getHttpServer())
    .post(`/api/v1/groups/${groupId}/members`)
    .set('Authorization', `Bearer ${coachAccessToken}`)
    .send({ athleteId })
    .expect(201);
}

export async function createTemplateForCoach(
  app: INestApplication,
  coachAccessToken: string,
  coachId: string,
  overrides: Partial<{ name: string; goal: string }> = {},
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/coaches/${coachId}/templates`)
    .set('Authorization', `Bearer ${coachAccessToken}`)
    .send({ name: overrides.name ?? 'Test Template', goal: overrides.goal })
    .expect(201);

  return { id: res.body.id as string };
}

export async function addTemplateWorkout(
  app: INestApplication,
  coachAccessToken: string,
  templateId: string,
  overrides: Partial<{ dayOffset: number; type: string }> = {},
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/templates/${templateId}/workouts`)
    .set('Authorization', `Bearer ${coachAccessToken}`)
    .send({ dayOffset: overrides.dayOffset ?? 0, type: overrides.type ?? 'EASY' })
    .expect(201);

  return res.body;
}

export async function createRaceGoalForAthlete(
  app: INestApplication,
  accessToken: string,
  athleteId: string,
  overrides: Partial<{ raceName: string; raceDate: string; distance: string }> = {},
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/athletes/${athleteId}/race-goals`)
    .set('Authorization', `Bearer ${accessToken}`)
    .send({
      raceName: overrides.raceName ?? 'Test City Marathon',
      raceDate: overrides.raceDate ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      distance: overrides.distance ?? 'Marathon',
    })
    .expect(201);

  return { id: res.body.id as string };
}

export async function createCoachNote(
  app: INestApplication,
  coachAccessToken: string,
  athleteId: string,
  overrides: Partial<{ content: string }> = {},
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/athletes/${athleteId}/notes`)
    .set('Authorization', `Bearer ${coachAccessToken}`)
    .send({ content: overrides.content ?? 'Test note content' })
    .expect(201);

  return { id: res.body.id as string };
}

export async function grantHealthConsent(
  app: INestApplication,
  athleteAccessToken: string,
  athleteId: string,
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/athletes/${athleteId}/consents`)
    .set('Authorization', `Bearer ${athleteAccessToken}`)
    .send({ consentType: 'HEALTH_CHECKIN_DATA', policyVersion: 'v1' })
    .expect(201);

  return { id: res.body.id as string };
}

/**
 * PLATFORM_ADMIN has no self-registration route by design (the API only
 * exposes coach self-signup) - seeded directly for tests, matching how a
 * real admin account would be provisioned out-of-band.
 */
export async function createPlatformAdmin(prisma: PrismaService) {
  const email = `admin-${Date.now()}-${Math.random().toString(36).slice(2)}@example.test`;
  const passwordHash = await argon2.hash(DEFAULT_PASSWORD);
  await prisma.user.create({
    data: {
      email,
      passwordHash,
      name: 'Test Admin',
      role: Role.PLATFORM_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  return { email, password: DEFAULT_PASSWORD };
}
