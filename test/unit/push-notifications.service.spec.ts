import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PushSubscriptionsService } from '../../src/modules/push-notifications/push-notifications.service';

jest.mock('web-push');

function configServiceWith(values: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('PushSubscriptionsService', () => {
  const subscriptionRow = {
    id: 'sub-1',
    userId: 'user-1',
    endpoint: 'https://push.example.test/abc',
    p256dh: 'p256dh-value',
    auth: 'auth-value',
    userAgent: null,
    createdAt: new Date(),
  };

  function prismaMock() {
    return {
      pushSubscription: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
      },
    };
  }

  afterEach(() => jest.clearAllMocks());

  it('subscribe upserts by endpoint, not by userId', async () => {
    const prisma = prismaMock();
    const service = new PushSubscriptionsService(prisma as never, configServiceWith({}));

    await service.subscribe('user-1', {
      endpoint: 'https://push.example.test/abc',
      p256dh: 'p256dh-value',
      auth: 'auth-value',
    });

    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { endpoint: 'https://push.example.test/abc' } }),
    );
  });

  it('unsubscribe is scoped by both userId and endpoint', async () => {
    const prisma = prismaMock();
    const service = new PushSubscriptionsService(prisma as never, configServiceWith({}));

    await service.unsubscribe('user-1', 'https://push.example.test/abc');

    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', endpoint: 'https://push.example.test/abc' },
    });
  });

  it('sendPush with no VAPID keys configured logs and never calls web-push', async () => {
    const prisma = prismaMock();
    prisma.pushSubscription.findMany.mockResolvedValue([subscriptionRow]);
    const service = new PushSubscriptionsService(prisma as never, configServiceWith({}));

    await service.sendPush('user-1', { title: 'Hi', body: 'There' });

    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it('sendPush with VAPID keys configured sends to every subscription for that user', async () => {
    const prisma = prismaMock();
    prisma.pushSubscription.findMany.mockResolvedValue([subscriptionRow]);
    (webpush.sendNotification as jest.Mock).mockResolvedValue(undefined);
    const service = new PushSubscriptionsService(
      prisma as never,
      configServiceWith({
        'push.vapidPublicKey': 'public-key',
        'push.vapidPrivateKey': 'private-key',
        'push.vapidSubject': 'mailto:test@example.test',
      }),
    );

    await service.sendPush('user-1', { title: 'Hi', body: 'There' });

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:test@example.test',
      'public-key',
      'private-key',
    );
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
  });

  it('sendPush deletes a subscription that 410s, but leaves one that 500s', async () => {
    const prisma = prismaMock();
    prisma.pushSubscription.findMany.mockResolvedValue([subscriptionRow]);
    const service = new PushSubscriptionsService(
      prisma as never,
      configServiceWith({
        'push.vapidPublicKey': 'public-key',
        'push.vapidPrivateKey': 'private-key',
        'push.vapidSubject': 'mailto:test@example.test',
      }),
    );

    (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({ statusCode: 410 });
    await service.sendPush('user-1', { title: 'Hi', body: 'There' });
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: 'sub-1' } });

    prisma.pushSubscription.deleteMany.mockClear();
    (webpush.sendNotification as jest.Mock).mockRejectedValueOnce({ statusCode: 500 });
    await service.sendPush('user-1', { title: 'Hi', body: 'There' });
    expect(prisma.pushSubscription.deleteMany).not.toHaveBeenCalled();
  });
});
