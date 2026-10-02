import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createAthleteForCoach, loginAs, registerCoach } from './utils/fixtures';

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
  return { id: res.body.id as string };
}

describe('Notifications (e2e)', () => {
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

  it('sending a message notifies the receiver, who can list and read it', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    const athleteMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);

    const sendRes = await request(app.getHttpServer())
      .post(`/api/v1/users/${athleteMe.body.userId}/messages`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ content: 'How did the long run go?' })
      .expect(201);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0].type).toBe('MESSAGE_RECEIVED');
    expect(listRes.body.items[0].payload.messageId).toBe(sendRes.body.id);
    expect(listRes.body.items[0].readAt).toBeNull();

    const readRes = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${listRes.body.items[0].id}/read`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(readRes.body.readAt).not.toBeNull();
  });

  it("a user cannot mark another user's notification as read", async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    const athleteMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${athleteMe.body.userId}/messages`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ content: 'Hello' })
      .expect(201);

    const athleteNotifications = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    const notificationId = athleteNotifications.body.items[0].id;

    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(404);
  });

  it('?unreadOnly=true excludes already-read notifications', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);
    const athleteMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${athleteMe.body.userId}/messages`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ content: 'First' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/users/${athleteMe.body.userId}/messages`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ content: 'Second' })
      .expect(201);

    const allRes = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(allRes.body.items).toHaveLength(2);

    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${allRes.body.items[0].id}/read`)
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);

    const unreadRes = await request(app.getHttpServer())
      .get('/api/v1/notifications?unreadOnly=true')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(unreadRes.body.items).toHaveLength(1);
    expect(unreadRes.body.items[0].id).toBe(allRes.body.items[1].id);
  });

  it("a user's notification list never includes another user's notifications", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const athleteA = await createAthleteForCoach(app, coachA.accessToken, coachA.coachId);
    const athleteB = await createAthleteForCoach(app, coachB.accessToken, coachB.coachId);
    const athleteAToken = await loginAs(app, athleteA.email, athleteA.password);
    const athleteBMe = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${await loginAs(app, athleteB.email, athleteB.password)}`)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/users/${athleteBMe.body.userId}/messages`)
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .send({ content: 'For athlete B only' })
      .expect(201);

    const athleteARes = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${athleteAToken}`)
      .expect(200);
    expect(athleteARes.body.items).toHaveLength(0);
  });

  it('assigning a training plan notifies the athlete', async () => {
    const coach = await registerCoach(app);
    const athlete = await createAthleteForCoach(app, coach.accessToken, coach.coachId);
    const athleteToken = await loginAs(app, athlete.email, athlete.password);

    const planRes = await request(app.getHttpServer())
      .post(`/api/v1/athletes/${athlete.id}/training-plans`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Base Phase', startDate: '2026-03-01' })
      .expect(201);

    const notificationsRes = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${athleteToken}`)
      .expect(200);
    expect(notificationsRes.body.items).toHaveLength(1);
    expect(notificationsRes.body.items[0].type).toBe('TRAINING_PLAN_ASSIGNED');
    expect(notificationsRes.body.items[0].payload.trainingPlanId).toBe(planRes.body.id);
  });

  it('publishing a club event notifies a linked club member but not emails-only members', async () => {
    const coach = await registerCoach(app);
    // An unlinked member (email-only) sits alongside the linked one, to
    // confirm the mixed case doesn't error and doesn't produce an extra
    // notification for anyone.
    await createMember(app, coach.accessToken, coach.organisationId, 'unlinked@example.test');
    const linkedMember = await createMember(
      app,
      coach.accessToken,
      coach.organisationId,
      'linked@example.test',
    );
    const inviteRes = await request(app.getHttpServer())
      .post(`/api/v1/club-members/${linkedMember.id}/invite`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(201);
    const acceptRes = await request(app.getHttpServer())
      .post('/api/v1/auth/accept-invite')
      .send({ token: inviteRes.body.inviteToken, password: 'MemberPassword123!' })
      .expect(200);
    const linkedMemberToken = acceptRes.body.accessToken as string;

    const eventRes = await request(app.getHttpServer())
      .post(`/api/v1/organisations/${coach.organisationId}/club-events`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ name: 'Spring 10K', eventDate: '2026-03-01' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/v1/club-events/${eventRes.body.id}`)
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ status: 'PUBLISHED' })
      .expect(200);

    const notificationsRes = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${linkedMemberToken}`)
      .expect(200);
    expect(notificationsRes.body.items).toHaveLength(1);
    expect(notificationsRes.body.items[0].type).toBe('CLUB_EVENT_PUBLISHED');
    expect(notificationsRes.body.items[0].payload.clubEventId).toBe(eventRes.body.id);
  });
});
