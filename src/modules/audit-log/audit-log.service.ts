import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';

export interface RecordAuditEntryInput {
  actorUserId?: string | null;
  action: string;
  targetEntityType: string;
  targetEntityId: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown> | null;
}

/** AuditLog rows are append-only - findAll is PLATFORM_ADMIN-only, see audit-log.controller.ts. */
@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: RecordAuditEntryInput): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        action: input.action,
        targetEntityType: input.targetEntityType,
        targetEntityId: input.targetEntityId,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        metadata: (input.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
      },
    });
  }

  /**
   * `actorUserId` has no Prisma relation to User (it's a plain nullable
   * string, since an audit entry must survive a deleted user) - resolved
   * here with one extra batched query instead of a per-row lookup, so the
   * UI doesn't have to show raw UUIDs.
   */
  async findAll(query: ListAuditLogQueryDto) {
    const { page, pageSize, action, from, to } = query;
    const where: Prisma.AuditLogWhereInput = {
      ...(action ? { action } : {}),
      ...(from || to
        ? { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const actorIds = [...new Set(items.map((i) => i.actorUserId).filter((id): id is string => !!id))];
    const actors = actorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, name: true, email: true },
        })
      : [];
    const actorById = new Map(actors.map((a) => [a.id, a]));

    return {
      items: items.map((item) => ({
        ...item,
        actorName: item.actorUserId ? (actorById.get(item.actorUserId)?.name ?? null) : null,
        actorEmail: item.actorUserId ? (actorById.get(item.actorUserId)?.email ?? null) : null,
      })),
      total,
      page,
      pageSize,
    };
  }
}
