import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createPlatformAdmin,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Athletes (e2e)', () => {
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

  it('a coach creates and lists athletes on their own roster', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId, {
      name: 'Roster Athlete',
    });

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body.map((a: { id: string }) => a.id)).toContain(athlete.id);
  });

  it("an athlete can update their own goal and availability, but not other athletes' fields", async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ goal: 'Sub-20 5K', availability: { days: ['Tue', 'Thu'] } })
      .expect(200);
    expect(res.body.goal).toBe('Sub-20 5K');
  });

  it('a coach can reassign an athlete to another coach in the same organisation', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);
    const secondCoachRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/coaches`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'reassign-target@example.test', name: 'Second Coach' })
      .expect(201);

    const secondCoachId = secondCoachRes.body.id as string;
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ coachId: secondCoachId })
      .expect(200);
    expect(res.body.coachId).toBe(secondCoachId);
  });

  it('rejects reassigning an athlete to a coach that does not exist', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    await request(app.getHttpServer())
      .patch(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ coachId: '00000000-0000-0000-0000-000000000000' })
      .expect(404);
  });

  it('validates athlete creation input (missing required fields)', async () => {
    const coach = await registerCoach(app);
    await request(app.getHttpServer())
      .post(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ email: 'incomplete@example.test' })
      .expect(400);
  });

  it('soft-deletes an athlete, and PLATFORM_ADMIN can no longer see them on the roster', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

    await request(app.getHttpServer())
      .delete(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coach.coachId}/athletes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body.map((a: { id: string }) => a.id)).not.toContain(athlete.id);
  });
});
