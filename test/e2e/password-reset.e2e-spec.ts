import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { EmailService } from '../../src/modules/email/email.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { registerCoach } from './utils/fixtures';

describe('Password reset (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailService: EmailService;

  beforeAll(async () => {
    ({ app, prisma } = await createTestApp());
    emailService = app.get(EmailService);
  });

  afterEach(async () => {
    await cleanDatabase(prisma);
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  /** No SMTP configured in the test env, so EmailService logs rather than sends - spy on it to capture the raw token, the same way the console-log fallback surfaces it in dev. */
  async function requestResetAndCaptureToken(email: string): Promise<string> {
    const sendSpy = jest.spyOn(emailService, 'send').mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email })
      .expect(200);
    const emailText = sendSpy.mock.calls[0][0].text;
    const match = emailText.match(/token=([a-f0-9]+)/);
    if (!match) throw new Error('Reset email did not contain a token');
    return match[1];
  }

  it('forgot-password always returns the same generic response, known or unknown email', async () => {
    const coach = await registerCoach(app);
    const known = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: coach.email })
      .expect(200);
    const unknown = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'nobody@example.test' })
      .expect(200);
    expect(known.body).toEqual(unknown.body);
  });

  it('forgot-password never returns the raw token in the response', async () => {
    const coach = await registerCoach(app);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: coach.email })
      .expect(200);
    expect(JSON.stringify(res.body)).not.toMatch(/[0-9a-f]{60,}/);
  });

  it('resets the password, logs in with it, and the old password stops working', async () => {
    const coach = await registerCoach(app);
    const token = await requestResetAndCaptureToken(coach.email);

    const resetRes = await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'NewPassword123!' })
      .expect(200);
    expect(typeof resetRes.body.accessToken).toBe('string');

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: coach.email, password: 'NewPassword123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: coach.email, password: coach.password })
      .expect(401);
  });

  it('accepting with an invalid token is rejected', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'not-a-real-token', password: 'SomePassword123!' })
      .expect(401);
  });

  it('accepting with an expired token is rejected', async () => {
    const coach = await registerCoach(app);
    const token = await requestResetAndCaptureToken(coach.email);

    await prisma.user.update({
      where: { email: coach.email },
      data: { passwordResetTokenExpiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'SomePassword123!' })
      .expect(401);
  });

  it('reusing the same reset token twice fails the second time', async () => {
    const coach = await registerCoach(app);
    const token = await requestResetAndCaptureToken(coach.email);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'FirstReset123!' })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/reset-password')
      .send({ token, password: 'SecondReset123!' })
      .expect(401);
  });

  it('does not send a reset email for a SUSPENDED account, but still returns 200', async () => {
    const coach = await registerCoach(app);
    await prisma.user.update({ where: { email: coach.email }, data: { status: 'SUSPENDED' } });

    const sendSpy = jest.spyOn(emailService, 'send').mockResolvedValue(undefined);
    await request(app.getHttpServer())
      .post('/api/v1/auth/forgot-password')
      .send({ email: coach.email })
      .expect(200);
    expect(sendSpy).not.toHaveBeenCalled();
  });
});
