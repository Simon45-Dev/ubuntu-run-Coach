import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import {
  addGroupMember,
  createAthleteForCoach,
  createGroupForCoach,
  loginAs,
  registerCoach,
} from './utils/fixtures';

describe('Groups (e2e)', () => {
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

  it('a coach creates a group, adds two of their own athletes, and both appear as members', async () => {
    const coach = await registerCoach(app);
    const athleteA = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteB = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const group = await createGroupForCoach(app, coach.accessToken, coach.coachId);

    await addGroupMember(app, coach.accessToken, group.id, athleteA.id);
    await addGroupMember(app, coach.accessToken, group.id, athleteB.id);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/groups/${group.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    const memberIds = res.body.memberships.map((m: { athleteId: string }) => m.athleteId);
    expect(memberIds).toEqual(expect.arrayContaining([athleteA.id, athleteB.id]));
  });

  it("a coach cannot add another coach's athlete to their group", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const groupA = await createGroupForCoach(app, coachA.accessToken, coachA.coachId);

    await request(app.getHttpServer())
      .post(`/api/v1/groups/${groupA.id}/members`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ athleteId: athleteB.id })
      .expect(404);
  });

  it("a coach cannot list or read another coach's group", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const groupB = await createGroupForCoach(app, coachB.accessToken, coachB.coachId);

    await request(app.getHttpServer())
      .get(`/api/v1/groups/${groupB.id}`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/coaches/${coachB.coachId}/groups`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .expect(403);
  });

  it('a member athlete can read their own group; a non-member athlete cannot', async () => {
    const coach = await registerCoach(app);
    const member = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const nonMember = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const group = await createGroupForCoach(app, coach.accessToken, coach.coachId);
    await addGroupMember(app, coach.accessToken, group.id, member.id);

    const memberToken = await loginAs(app, member.email, member.password);
    await request(app.getHttpServer())
      .get(`/api/v1/groups/${group.id}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);

    const nonMemberToken = await loginAs(app, nonMember.email, nonMember.password);
    await request(app.getHttpServer())
      .get(`/api/v1/groups/${group.id}`)
      .set('Authorization', `Bearer ${nonMemberToken}`)
      .expect(404);
  });

  it('removing a member is reflected in the membership list', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const group = await createGroupForCoach(app, coach.accessToken, coach.coachId);
    await addGroupMember(app, coach.accessToken, group.id, athlete.id);

    await request(app.getHttpServer())
      .delete(`/api/v1/groups/${group.id}/members/${athlete.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/groups/${group.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(res.body.memberships).toHaveLength(0);
  });

  it('deleting a group soft-deletes it but leaves its training plans intact', async () => {
    const coach = await registerCoach(app);
    const group = await createGroupForCoach(app, coach.accessToken, coach.coachId);
    const planRes = await request(app.getHttpServer())
      .post(`/api/v1/groups/${group.id}/training-plans`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Group Plan', startDate: new Date().toISOString() })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/api/v1/groups/${group.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/groups/${group.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(404);

    const plan = await prisma.trainingPlan.findUnique({ where: { id: planRes.body.id } });
    expect(plan?.deletedAt).toBeNull();
  });
});
