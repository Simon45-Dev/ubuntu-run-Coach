import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createClubAdminForCoach, loginAs, registerCoach } from './utils/fixtures';

async function createMember(
  app: INestApplication,
  coachToken: string,
  organisationId: string,
  email: string,
) {
  const res = await request(app.getHttpServer())
    .post(`/api/v1/organisations/${organisationId}/club-members`)
    .set('Authorization', `Bearer ${coachToken}`)
    .send({ firstName: 'Test', lastName: 'Member', email })
    .expect(201);
  return { id: res.body.id as string, membershipNumber: res.body.membershipNumber as string };
}

describe('Club Events (e2e)', () => {
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

  it('a coach creates a draft event, adds results manually and via CSV, and the leaderboard ranks correctly', async () => {
    const coach = await registerCoach(app);
    const alice = await createMember(
      app,
      coach.accessToken,
      coach.organisationId,
      'alice@example.test',
    );
    const bob = await createMember(
      app,
      coach.accessToken,
      coach.organisationId,
      'bob@example.test',
    );
    const carol = await createMember(
      app,
      coach.accessToken,
      coach.organisationId,
      'carol@example.test',
    );

    const eventRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-events`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Spring 10K', eventDate: '2026-03-01', distance: '10km' })
      .expect(201);
    expect(eventRes.body.status).toBe('DRAFT');
    const eventId = eventRes.body.id as string;

    // Bob finishes faster than Alice.
    await request(app.getHttpServer())
      .post(`/api/v1/club-events/${eventId}/results`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ clubMemberId: alice.id, finishTimeSeconds: 2400 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/club-events/${eventId}/results`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ clubMemberId: bob.id, finishTimeSeconds: 2100 })
      .expect(201);

    // Carol's result comes in via CSV, as a DNF.
    const csv = `membershipNumber,finishTime,status\n${carol.membershipNumber},,DNF`;
    await request(app.getHttpServer())
      .post(`/api/v1/club-events/${eventId}/results/import`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', Buffer.from(csv), 'results.csv')
      .expect(201);

    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/club-events/${eventId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(detailRes.body.results).toHaveLength(3);
    const byMember = (id: string) =>
      detailRes.body.results.find((r: { clubMemberId: string }) => r.clubMemberId === id);
    expect(byMember(bob.id).rank).toBe(1);
    expect(byMember(alice.id).rank).toBe(2);
    expect(byMember(carol.id).rank).toBeNull();
    expect(byMember(carol.id).status).toBe('DNF');
  });

  it('rejects a CSV import referencing an unknown membership number, importing nothing', async () => {
    const coach = await registerCoach(app);
    const eventRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-events`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Spring 10K', eventDate: '2026-03-01' })
      .expect(201);

    const csv = 'membershipNumber,finishTime\n9999,25:00';
    const res = await request(app.getHttpServer())
      .post(`/api/v1/club-events/${eventRes.body.id}/results/import`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .attach('file', Buffer.from(csv), 'results.csv')
      .expect(400);
    expect(res.body.errors[0]).toContain('9999');

    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/club-events/${eventRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(detailRes.body.results).toHaveLength(0);
  });

  it('a club member cannot see a DRAFT event, but can see it once published, and cannot manage results', async () => {
    const coach = await registerCoach(app);
    const member = await createMember(
      app,
      coach.accessToken,
      coach.organisationId,
      'dana@example.test',
    );
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/club-members/${member.id}/invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(201);
    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'MemberPassword123!' })
      .expect(200);
    const memberToken = acceptRes.body.accessToken as string;

    const eventRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-events`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Spring 10K', eventDate: '2026-03-01' })
      .expect(201);
    const eventId = eventRes.body.id as string;

    await request(app.getHttpServer())
      .get(`/api/v1/club-events/${eventId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(404);
    const listWhileDraft = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-events`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(listWhileDraft.body).toHaveLength(0);

    await request(app.getHttpServer())
      .post(`/api/v1/club-events/${eventId}/results`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ clubMemberId: member.id, finishTimeSeconds: 2000 })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`/api/v1/club-events/${eventId}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/club-events/${eventId}`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    const listAfterPublish = await request(app.getHttpServer())
      .get(`/api/v1/organisations/${coach.organisationId}/club-events`)
      .set('Authorization', `Bearer ${memberToken}`)
      .expect(200);
    expect(listAfterPublish.body).toHaveLength(1);
  });

  it('a club admin can manage events in their own org; a coach from a different org cannot reach them', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const clubAdmin = await createClubAdminForCoach(app, coachA.accessToken, coachA.organisationId);
    const clubAdminToken = await loginAs(app, clubAdmin.email, clubAdmin.password);

    const eventRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-events`)
      .set('Authorization', `Bearer ${clubAdminToken}`)
      .send({ name: 'Club Champs', eventDate: '2026-04-01' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/api/v1/club-events/${eventRes.body.id}`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/api/v1/club-events/${eventRes.body.id}`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(404);
  });

  it('rejects adding a result for a club member from a different organisation', async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const memberB = await createMember(
      app,
      coachB.accessToken,
      coachB.organisationId,
      'eve@example.test',
    );

    const eventRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coachA.organisationId}/club-events`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ name: 'Spring 10K', eventDate: '2026-03-01' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/club-events/${eventRes.body.id}/results`)
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ clubMemberId: memberB.id, finishTimeSeconds: 2000 })
      .expect(400);
  });

  it('a coach can update and delete a result', async () => {
    const coach = await registerCoach(app);
    const member = await createMember(
      app,
      coach.accessToken,
      coach.organisationId,
      'frank@example.test',
    );
    const eventRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-events`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Spring 10K', eventDate: '2026-03-01' })
      .expect(201);
    const resultRes = await request(app.getHttpServer())
      .post(`/api/v1/club-events/${eventRes.body.id}/results`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ clubMemberId: member.id, finishTimeSeconds: 2000 })
      .expect(201);

    const updateRes = await request(app.getHttpServer())
      .patch(`/api/v1/club-event-results/${resultRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ finishTimeSeconds: 1900 })
      .expect(200);
    expect(updateRes.body.finishTimeSeconds).toBe(1900);

    await request(app.getHttpServer())
      .delete(`/api/v1/club-event-results/${resultRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);

    const detailRes = await request(app.getHttpServer())
      .get(`/api/v1/club-events/${eventRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(detailRes.body.results).toHaveLength(0);
  });
});
