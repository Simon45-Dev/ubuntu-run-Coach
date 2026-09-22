import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createAthleteForCoach, loginAs, registerCoach } from './utils/fixtures';

describe('Consents (e2e)', () => {
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

  it('an athlete grants consent for themselves', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/consents`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ consentType: 'HEALTH_CHECKIN_DATA', policyVersion: 'v1' })
      .expect(201);

    expect(res.body.consentType).toBe('HEALTH_CHECKIN_DATA');
    expect(res.body.withdrawnAt).toBeNull();
  });

  it('a coach cannot grant consent for their own athlete', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/consents`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ consentType: 'HEALTH_CHECKIN_DATA', policyVersion: 'v1' })
      .expect(403);
  });

  it('an athlete withdraws their own consent, and withdrawing again is idempotent', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    const grantRes = await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/consents`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ consentType: 'HEALTH_CHECKIN_DATA', policyVersion: 'v1' })
      .expect(201);

    const withdrawRes = await request(app.getHttpServer())
      .patch(`/api/v1/consents/${grantRes.body.id}/withdraw`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(withdrawRes.body.withdrawnAt).not.toBeNull();

    const secondWithdrawRes = await request(app.getHttpServer())
      .patch(`/api/v1/consents/${grantRes.body.id}/withdraw`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(secondWithdrawRes.body.withdrawnAt).toBe(withdrawRes.body.withdrawnAt);
  });

  it("an athlete cannot withdraw another athlete's consent", async () => {
    const coach = await registerCoach(app);
    const athleteA = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteB = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteAToken = await loginAs(app, athleteA.email, athleteA.password);
    const athleteBToken = await loginAs(app, athleteB.email, athleteB.password);

    const grantRes = await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athleteB.id}/consents`)
      .set('Authorization', `Bearer ${athleteBToken}`)
      .send({ consentType: 'HEALTH_CHECKIN_DATA', policyVersion: 'v1' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/consents/${grantRes.body.id}/withdraw`)
      .set('Authorization', `Bearer ${athleteAToken}`)
      .expect(404);
  });

  it("a coach can list their own roster athlete's consent status, but not another coach's athlete", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coachA.accessToken, coachA.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/consents`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ consentType: 'HEALTH_CHECKIN_DATA', policyVersion: 'v1' })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/consents`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(200);
    expect(listRes.body.items).toHaveLength(1);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/consents`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .expect(404);
  });
});
