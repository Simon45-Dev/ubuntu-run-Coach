import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationPriority, NotificationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

export interface CreateNotificationInput {
  recipientId: string;
  type: string;
  priority?: NotificationPriority;
  payload?: Record<string, unknown>;
}

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
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput) {
    return this.prisma.notification.create({
      data: {
        recipientId: input.recipientId,
        type: input.type,
        priority: input.priority ?? NotificationPriority.MEDIUM,
        payload: input.payload as Prisma.InputJsonValue | undefined,
        status: NotificationStatus.SENT,
        sentAt: new Date(),
      },
    });
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
