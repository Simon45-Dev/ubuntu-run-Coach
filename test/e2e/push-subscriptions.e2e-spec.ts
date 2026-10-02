import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/database/prisma.service';
import { createTestApp, cleanDatabase } from './utils/test-app';
import { registerCoach } from './utils/fixtures';

describe('Push Subscriptions (e2e)', () => {
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

  it('subscribing creates a row owned by the caller', async () => {
    const coach = await registerCoach(app);

    await request(app.getHttpServer())
      .post('/api/v1/push-subscriptions')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ endpoint: 'https://push.example.test/sub-1', p256dh: 'p256dh', auth: 'auth' })
      .expect(201);

    const rows = await prisma.pushSubscription.findMany({
      where: { endpoint: 'https://push.example.test/sub-1' },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].userId).toBe(coach.userId);
  });

  it('subscribing the same endpoint twice upserts rather than duplicating', async () => {
    const coach = await registerCoach(app);
    const body = { endpoint: 'https://push.example.test/sub-2', p256dh: 'p256dh', auth: 'auth' };

    await request(app.getHttpServer())
      .post('/api/v1/push-subscriptions')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send(body)
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/v1/push-subscriptions')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ ...body, p256dh: 'p256dh-rotated' })
      .expect(201);

    const rows = await prisma.pushSubscription.findMany({ where: { endpoint: body.endpoint } });
    expect(rows).toHaveLength(1);
    expect(rows[0].p256dh).toBe('p256dh-rotated');
  });

  it('unsubscribing removes the row and is idempotent', async () => {
    const coach = await registerCoach(app);
    const endpoint = 'https://push.example.test/sub-3';
    await request(app.getHttpServer())
      .post('/api/v1/push-subscriptions')
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .send({ endpoint, p256dh: 'p256dh', auth: 'auth' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/api/v1/push-subscriptions')
      .query({ endpoint })
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
    expect(await prisma.pushSubscription.findMany({ where: { endpoint } })).toHaveLength(0);

    // Idempotent - unsubscribing again is not an error.
    await request(app.getHttpServer())
      .delete('/api/v1/push-subscriptions')
      .query({ endpoint })
      .set('Authorization', `Bearer ${coach.accessToken}`)
      .expect(200);
  });

  it("a user cannot unsubscribe another user's endpoint", async () => {
    const coachA = await registerCoach(app);
    const coachB = await registerCoach(app);
    const endpoint = 'https://push.example.test/sub-4';
    await request(app.getHttpServer())
      .post('/api/v1/push-subscriptions')
      .set('Authorization', `Bearer ${coachA.accessToken}`)
      .send({ endpoint, p256dh: 'p256dh', auth: 'auth' })
      .expect(201);

    await request(app.getHttpServer())
      .delete('/api/v1/push-subscriptions')
      .query({ endpoint })
      .set('Authorization', `Bearer ${coachB.accessToken}`)
      .expect(200);

    // Still there - coachB's delete call matched zero rows.
    expect(await prisma.pushSubscription.findMany({ where: { endpoint } })).toHaveLength(1);
  });
});
