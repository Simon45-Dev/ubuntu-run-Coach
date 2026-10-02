import { NotificationsService } from '../../src/modules/notifications/notifications.service';
import { PushSubscriptionsService } from '../../src/modules/push-notifications/push-notifications.service';

describe('NotificationsService', () => {
  function prismaMock(createdRow: unknown) {
    return { notification: { create: jest.fn().mockResolvedValue(createdRow) } };
  }

  it('create() still returns the notification row even when push delivery fails', async () => {
    const createdRow = { id: 'notif-1', recipientId: 'user-1', type: 'MESSAGE_RECEIVED' };
    const prisma = prismaMock(createdRow);
    const pushSubscriptionsService = {
      sendPush: jest.fn().mockRejectedValue(new Error('push service unreachable')),
    } as unknown as PushSubscriptionsService;
    const service = new NotificationsService(prisma as never, pushSubscriptionsService);

    const result = await service.create({ recipientId: 'user-1', type: 'MESSAGE_RECEIVED' });

    expect(result).toBe(createdRow);
    // Let the fire-and-forget .catch() handler run before the test ends.
    await new Promise((resolve) => setImmediate(resolve));
  });

  it('create() calls sendPush with the recipientId and known push copy for the type', async () => {
    const prisma = prismaMock({ id: 'notif-1' });
    const pushSubscriptionsService = {
      sendPush: jest.fn().mockResolvedValue(undefined),
    } as unknown as PushSubscriptionsService;
    const service = new NotificationsService(prisma as never, pushSubscriptionsService);

    await service.create({ recipientId: 'user-1', type: 'MESSAGE_RECEIVED' });

    expect(pushSubscriptionsService.sendPush).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: 'New message' }),
    );
  });

  it('create() falls back to generic push copy for an unmapped type', async () => {
    const prisma = prismaMock({ id: 'notif-1' });
    const pushSubscriptionsService = {
      sendPush: jest.fn().mockResolvedValue(undefined),
    } as unknown as PushSubscriptionsService;
    const service = new NotificationsService(prisma as never, pushSubscriptionsService);

    await service.create({ recipientId: 'user-1', type: 'SOME_FUTURE_TYPE' });

    expect(pushSubscriptionsService.sendPush).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ title: 'Ubuntu Run' }),
    );
  });
});
