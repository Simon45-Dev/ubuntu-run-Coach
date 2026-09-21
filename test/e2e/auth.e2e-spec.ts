import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { authenticator } from 'otplib';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { registerCoach } from './utils/fixtures';

describe('Auth (e2e)', () => {
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

  it('registers, logs in, accesses a protected route, refreshes, then logs out', async () => {
    const email = 'auth-flow@example.test';
    const password = 'TestPassword123!';

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password, name: 'Auth Flow', organisationName: 'Flow Org' })
      .expect(201);

    const refreshCookie = registerRes.headers['set-cookie'];
    expect(refreshCookie).toBeDefined();

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registerRes.body.accessToken}`)
      .expect(200);

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    const loginRefreshCookie = loginRes.headers['set-cookie'];

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginRefreshCookie)
      .expect(200);
    expect(refreshRes.body.accessToken).toBeTruthy();
    const rotatedCookie = refreshRes.headers['set-cookie'];

    // The original, pre-rotation refresh token is now rejected (rotation-on-use).
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', loginRefreshCookie)
      .expect(401);

    // The rotated token still works.
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedCookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', rotatedCookie)
      .expect(204);
  });

  it('rejects login with the wrong password', async () => {
    const { email } = await registerCoach(app, { email: 'wrong-pw@example.test' });
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'not-the-right-password' })
      .expect(401);
  });

  it('rejects registering the same email twice', async () => {
    const email = 'dup@example.test';
    await registerCoach(app, { email });
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'TestPassword123!', name: 'Dup', organisationName: 'Dup Org' })
      .expect(409);
  });

  it('requires MFA code after enrolment, and rejects a wrong code', async () => {
    const coach = await registerCoach(app, { email: 'mfa-user@example.test' });

    const enrolRes = await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/enable')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(201);
    const secret = enrolRes.body.secret as string;

    const validCode = authenticator.generate(secret);
    await request(app.getHttpServer())
      .post('/api/v1/auth/mfa/verify')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ code: validCode })
      .expect(204);

    // Login without a code now fails...
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: coach.email, password: coach.password })
      .expect(401);

    // ...as does a wrong code...
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: coach.email, password: coach.password, mfaCode: '000000' })
      .expect(401);

    // ...but a fresh valid code succeeds.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: coach.email,
        password: coach.password,
        mfaCode: authenticator.generate(secret),
      })
      .expect(200);
  });

  it('rejects a protected route with a missing or malformed token', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });
});
