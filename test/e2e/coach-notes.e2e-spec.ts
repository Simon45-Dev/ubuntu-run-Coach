import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  createAthleteForCoach,
  createCoachNote,
  createPlatformAdmin,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Coach notes (e2e)', () => {
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

  it('a coach creates a note about their own athlete, and can list and update it', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const note = await createCoachNote(app, coach.accessToken, athlete.id, {
      content: 'Reported mild calf tightness after long run.',
    });

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/notes`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(listRes.body[0].content).toContain('calf tightness');

    const patchRes = await request(app.getHttpServer())
      .patch(`/api/v1/notes/${note.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ content: 'Calf tightness resolved after rest day.' })
      .expect(200);
    expect(patchRes.body.content).toBe('Calf tightness resolved after rest day.');
  });

  it('an athlete-role token is rejected on every note route', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const note = await createCoachNote(app, coach.accessToken, athlete.id);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athlete.id}/notes`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/notes`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ content: 'Should fail' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/notes/${note.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ content: 'Should fail' })
      .expect(403);
  });

  it("a coach cannot create or read a note for another coach's athlete", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);

    await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athleteB.id}/notes`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ content: 'Hijack attempt' })
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/athletes/${athleteB.id}/notes`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);
  });

  it("a reassigned athlete's new coach cannot edit a note the previous coach wrote", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coachA.accessToken, coachA.coachId);
    const note = await createCoachNote(app, coachA.accessToken, athlete.id);

    const admin = await createPlatformAdmin(prisma);
    const adminToken = await loginAs(app, admin.email, admin.password);
    await request(app.getHttpServer())
      .patch(`/api/v1/athletes/${athlete.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ coachId: coachB.coachId })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/v1/notes/${note.id}`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .send({ content: 'Overwritten by new coach' })
      .expect(404);
  });
});
