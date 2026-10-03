import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  addGroupMember,
  addTemplateWorkout,
  createAthleteForCoach,
  createGroupForCoach,
  createPlatformAdmin,
  createTemplateForCoach,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Templates (e2e)', () => {
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

  it('a coach creates a template, adds workouts, and reads it back ordered by dayOffset', async () => {
    const coach = await registerCoach(app);
    const template = await createTemplateForCoach(app, coach.accessToken, coach.coachId, {
      name: 'Base Build',
      goal: 'Sub-4 marathon',
    });
    await addTemplateWorkout(app, coach.accessToken, template.id, { dayOffset: 3, type: 'TEMPO' });
    await addTemplateWorkout(app, coach.accessToken, template.id, { dayOffset: 0, type: 'EASY' });

    const res = await request(app.getHttpServer())
      .get(`/api/v1/templates/${template.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(res.body.name).toBe('Base Build');
    expect(res.body.workouts.map((w: { dayOffset: number }) => w.dayOffset)).toEqual([0, 3]);
  });

  it("a coach cannot read, update, or delete another coach's template", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const template = await createTemplateForCoach(app, coachB.accessToken, coachB.coachId);

    await request(app.getHttpServer())
      .get(`/api/v1/templates/${template.id}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/api/v1/templates/${template.id}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ name: 'Hijacked' })
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/templates/${template.id}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);
  });

  it('an athlete-role token is rejected on every template route', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const template = await createTemplateForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    await request(app.getHttpServer())
      .get(`/api/v1/templates/${template.id}`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/coaches/${coach.coachId}/templates`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ name: 'Should fail' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/templates/${template.id}/apply`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .send({ athleteId: athlete.id, startDate: new Date().toISOString() })
      .expect(403);
  });

  it('applying a template to an individual athlete creates a real plan on the correct computed dates', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const template = await createTemplateForCoach(app, coach.accessToken, coach.coachId, {
      name: 'Base Build',
      goal: 'Sub-4 marathon',
    });
    await addTemplateWorkout(app, coach.accessToken, template.id, { dayOffset: 0, type: 'EASY' });
    await addTemplateWorkout(app, coach.accessToken, template.id, {
      dayOffset: 7,
      type: 'LONG_RUN',
    });

    const startDate = new Date('2026-01-01T00:00:00.000Z');
    const res = await request(app.getHttpServer())
      .post(`/api/v1/templates/${template.id}/apply`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ athleteId: athlete.id, startDate: startDate.toISOString() })
      .expect(201);

    expect(res.body.athleteId).toBe(athlete.id);
    expect(res.body.goal).toBe('Sub-4 marathon');
    const scheduledDates = res.body.workouts
      .map((w: { scheduledDate: string }) => w.scheduledDate)
      .sort();
    expect(scheduledDates).toEqual(['2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z']);
  });

  it('applying a template to a group creates a group-targeted plan visible to every member', async () => {
    const coach = await registerCoach(app);
    const memberA = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const memberB = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const group = await createGroupForCoach(app, coach.accessToken, coach.coachId);
    await addGroupMember(app, coach.accessToken, group.id, memberA.id);
    await addGroupMember(app, coach.accessToken, group.id, memberB.id);
    const template = await createTemplateForCoach(app, coach.accessToken, coach.coachId);
    await addTemplateWorkout(app, coach.accessToken, template.id, { dayOffset: 0 });

    const applyRes = await request(app.getHttpServer())
      .post(`/api/v1/templates/${template.id}/apply`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ groupId: group.id, startDate: new Date().toISOString() })
      .expect(201);
    expect(applyRes.body.groupId).toBe(group.id);

    const memberAToken = await loginAs(app, memberA.email, memberA.password);
    await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${applyRes.body.id}`)
      .set('Authorization', `Bearer ${memberAToken}`)
      .expect(200);
  });

  it('applying with both athleteId and groupId, or neither, is rejected', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const group = await createGroupForCoach(app, coach.accessToken, coach.coachId);
    const template = await createTemplateForCoach(app, coach.accessToken, coach.coachId);

    await request(app.getHttpServer())
      .post(`/api/v1/templates/${template.id}/apply`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ athleteId: athlete.id, groupId: group.id, startDate: new Date().toISOString() })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/templates/${template.id}/apply`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ startDate: new Date().toISOString() })
      .expect(400);
  });

  it("applying a template to another coach's athlete or group is rejected", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const template = await createTemplateForCoach(app, coachA.accessToken, coachA.coachId);

    await request(app.getHttpServer())
      .post(`/api/v1/templates/${template.id}/apply`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ athleteId: athleteB.id, startDate: new Date().toISOString() })
      .expect(404);
  });

  it("deleting a template doesn't affect a plan already created from it", async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const template = await createTemplateForCoach(app, coach.accessToken, coach.coachId);

    const applyRes = await request(app.getHttpServer())
      .post(`/api/v1/templates/${template.id}/apply`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ athleteId: athlete.id, startDate: new Date().toISOString() })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/templates/${template.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/training-plans/${applyRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
  });

  describe('shared/global templates', () => {
    it('a coach cannot create a global template', async () => {
      const coach = await registerCoach(app);
      await request(app.getHttpServer())
        .post('/api/v1/templates/global')
        .set('Authorization', `Bearer ${coach.accessToken}`)
        .send({ name: '10K - Sub 50:00' })
        .expect(403);
    });

    it('a platform admin creates a global template, visible to any coach', async () => {
      const admin = await createPlatformAdmin(prisma);
      const adminToken = await loginAs(app, admin.email, admin.password);
      const coachA = await registerCoach(app);
      const coachB = await registerCoach(app);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/templates/global')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '10K - Sub 50:00', goal: 'Finish a 10K in under 50:00' })
        .expect(201);
      const templateId = createRes.body.id;
      await request(app.getHttpServer())
        .post(`/api/v1/templates/${templateId}/workouts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dayOffset: 1, type: 'EASY', paceTarget: '6:10/km' })
        .expect(201);

      // Visible via GET /templates/global.
      const globalListRes = await request(app.getHttpServer())
        .get('/api/v1/templates/global')
        .set('Authorization', `Bearer ${coachA.accessToken}`)
        .expect(200);
      expect(globalListRes.body.some((t: { id: string }) => t.id === templateId)).toBe(true);

      // Mixed into each coach's own template list, regardless of org.
      for (const coach of [coachA, coachB]) {
        const listRes = await request(app.getHttpServer())
          .get(`/api/v1/coaches/${coach.coachId}/templates`)
          .set('Authorization', `Bearer ${coach.accessToken}`)
          .expect(200);
        expect(listRes.body.some((t: { id: string }) => t.id === templateId)).toBe(true);
      }

      // Directly readable by any coach.
      const readRes = await request(app.getHttpServer())
        .get(`/api/v1/templates/${templateId}`)
        .set('Authorization', `Bearer ${coachA.accessToken}`)
        .expect(200);
      expect(readRes.body.isGlobal).toBe(true);
      expect(readRes.body.workouts).toHaveLength(1);
    });

    it('a coach cannot edit, add workouts to, or delete a global template', async () => {
      const admin = await createPlatformAdmin(prisma);
      const adminToken = await loginAs(app, admin.email, admin.password);
      const coach = await registerCoach(app);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/templates/global')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '10K - Sub 60:00' })
        .expect(201);
      const templateId = createRes.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/templates/${templateId}`)
        .set('Authorization', `Bearer ${coach.accessToken}`)
        .send({ name: 'Hijacked' })
        .expect(403);

      await request(app.getHttpServer())
        .post(`/api/v1/templates/${templateId}/workouts`)
        .set('Authorization', `Bearer ${coach.accessToken}`)
        .send({ dayOffset: 0, type: 'EASY' })
        .expect(403);

      await request(app.getHttpServer())
        .delete(`/api/v1/templates/${templateId}`)
        .set('Authorization', `Bearer ${coach.accessToken}`)
        .expect(403);
    });

    it("applying a global template to an athlete produces a plan owned by the athlete's own coach", async () => {
      const admin = await createPlatformAdmin(prisma);
      const adminToken = await loginAs(app, admin.email, admin.password);
      const coach = await registerCoach(app);
      const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);

      const createRes = await request(app.getHttpServer())
        .post('/api/v1/templates/global')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: '10K - Sub 70:00' })
        .expect(201);
      const templateId = createRes.body.id;
      await request(app.getHttpServer())
        .post(`/api/v1/templates/${templateId}/workouts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dayOffset: 0, type: 'EASY' })
        .expect(201);

      const applyRes = await request(app.getHttpServer())
        .post(`/api/v1/templates/${templateId}/apply`)
        .set('Authorization', `Bearer ${coach.accessToken}`)
        .send({ athleteId: athlete.id, startDate: new Date().toISOString() })
        .expect(201);
      expect(applyRes.body.coachId).toBe(coach.coachId);
      expect(applyRes.body.athleteId).toBe(athlete.id);
    });
  });
});
