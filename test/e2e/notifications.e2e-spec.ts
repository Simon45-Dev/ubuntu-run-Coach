import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { createAthleteForCoach, loginAs, registerCoach } from './utils/fixtures';

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
});
