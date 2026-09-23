import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async send(ctx: AuthContext, receiverId: string, dto: SendMessageDto) {
    await this.assertValidCounterpart(ctx, receiverId);
    const message = await this.prisma.message.create({
      data: { senderId: ctx.userId, receiverId, content: dto.content },
    });
    await this.notificationsService.create({
      recipientId: receiverId,
      type: 'MESSAGE_RECEIVED',
      payload: { messageId: message.id, senderId: ctx.userId },
    });
    return message;
  }

  async findThread(ctx: AuthContext, counterpartId: string, pagination: PaginationQueryDto) {
    await this.assertValidCounterpart(ctx, counterpartId);
    const { page, pageSize } = pagination;
    const where = {
      OR: [
        { senderId: ctx.userId, receiverId: counterpartId },
        { senderId: counterpartId, receiverId: ctx.userId },
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.message.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /** Only the message's own receiver may mark it read; idempotent if already read. */
  async markRead(ctx: AuthContext, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: { id: messageId, receiverId: ctx.userId },
    });
    if (!message) {
      throw new NotFoundException('Message not found');
    }
    if (message.readAt) {
      return message;
    }
    return this.prisma.message.update({
      where: { id: message.id },
      data: { readAt: new Date() },
    });
  }

  /**
   * Messaging is scoped by relationship, not ownership: can the caller
   * legitimately message this specific user. A failed check is a 404
   * ("Recipient not found"), not 403 - same existence-hiding convention used
   * everywhere else in this codebase (e.g. AthletesService.findOne).
   */
  private async assertValidCounterpart(ctx: AuthContext, counterpartUserId: string): Promise<void> {
    if (ctx.role === Role.PLATFORM_ADMIN) {
      return;
    }
    if (counterpartUserId === ctx.userId) {
      throw new BadRequestException('Cannot message yourself');
    }

    if (ctx.role === Role.COACH) {
      const athlete = await this.prisma.athlete.findFirst({
        where: { coachId: ctx.coachId, userId: counterpartUserId, deletedAt: null },
      });
      if (!athlete) {
        throw new NotFoundException('Recipient not found');
      }
      return;
    }

    if (ctx.role === Role.ATHLETE) {
      const self = await this.prisma.athlete.findFirst({
        where: { id: ctx.athleteId, deletedAt: null },
        include: { coach: { include: { user: true } } },
      });
      if (!self?.coach || self.coach.user.id !== counterpartUserId) {
        throw new NotFoundException('Recipient not found');
      }
      return;
    }

    throw new ForbiddenException('Unknown role');
  }
}
