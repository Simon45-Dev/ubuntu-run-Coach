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
