import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationPriority, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  PushSubscriptionsService,
  PushPayload,
} from '../push-notifications/push-notifications.service';

export interface CreateNotificationInput {
  recipientId: string;
  type: string;
  priority?: NotificationPriority;
  payload?: Record<string, unknown>;
}

/**
 * Short, generic copy per notification type - a push payload needs a
 * ready-made string (it can't defer to client-side rendering the way the
 * in-app list humanises type+payload), so this is deliberately kept simple
 * for v1 rather than threading payload-derived details (e.g. a sender's
 * name) into the text. Unlisted/future types fall back to a generic push.
 */
const PUSH_COPY: Record<string, PushPayload> = {
  MESSAGE_RECEIVED: { title: 'New message', body: 'You have a new message', url: '/messages' },
  TRAINING_PLAN_ASSIGNED: {
    title: 'New training plan',
    body: 'A new training plan has been assigned to you',
    url: '/plans',
  },
  CLUB_EVENT_PUBLISHED: {
    title: 'Event results published',
    body: 'Results for a club event have been published',
    url: '/events',
  },
};
const DEFAULT_PUSH_COPY: PushPayload = {
  title: 'Ubuntu Run',
  body: 'You have a new notification',
  url: '/notifications',
};

/**
 * Notifications are always self-only - nobody, not even a coach or
 * PLATFORM_ADMIN, reads another user's inbox. Simpler than every other
 * module here: no roster/coach scoping, just a straight recipientId match.
 *
 * `create` is the internal building block other services call (e.g.
 * MessagesService.send) - never exposed as a public POST route, since a
 * client shouldn't be able to fabricate a notification for anyone.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pushSubscriptionsService: PushSubscriptionsService,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        type: input.type,
        priority: input.priority ?? NotificationPriority.MEDIUM,
        payload: input.payload as Prisma.InputJsonValue | undefined,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });

    // Fire-and-forget: the notification row above is the source of truth,
    // push is a best-effort enhancement on top of it and must never affect
    // whether this call succeeds.
    void this.pushSubscriptionsService
      .sendPush(input.recipientId, PUSH_COPY[input.type] ?? DEFAULT_PUSH_COPY)
      .catch((err: unknown) =>
        this.logger.warn(`Push delivery failed for ${notification.id}: ${err}`),
      );

    return notification;
  }

  async findAllForUser(ctx: AuthContext, pagination: PaginationQueryDto, unreadOnly?: boolean) {
    const { page, pageSize } = pagination;
    const where = {
      recipientId: ctx.userId,
      ...(unreadOnly ? { readAt: null } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.notification.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Only the notification's own recipient may mark it read; idempotent if already read. */
  async markRead(ctx: AuthContext, id: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, recipientId: ctx.userId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.readAt) {
      return notification;
    }
    return this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });
  }
}
