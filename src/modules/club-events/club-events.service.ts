import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ClubEventResultStatus, ClubEventStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { CreateClubEventDto } from './dto/create-club-event.dto';
import { UpdateClubEventDto } from './dto/update-club-event.dto';
import { CreateClubEventResultDto } from './dto/create-club-event-result.dto';
import { UpdateClubEventResultDto } from './dto/update-club-event-result.dto';
import { parseClubEventResultsCsv } from './club-event-results-csv-import.util';

const RESULT_MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  membershipNumber: true,
  membershipCategory: true,
} as const;

function isManager(ctx: AuthContext): boolean {
  return (
    ctx.role === Role.COACH || ctx.role === Role.PLATFORM_ADMIN || ctx.role === Role.CLUB_ADMIN
  );
}

/** Rank is computed here, never stored - a corrected time never leaves a stale ranking behind. */
function rankResults<T extends { status: ClubEventResultStatus; finishTimeSeconds: number | null }>(
  results: T[],
): (T & { rank: number | null })[] {
  const finished = results
    .filter((r) => r.status === ClubEventResultStatus.FINISHED)
    .sort((a, b) => (a.finishTimeSeconds ?? 0) - (b.finishTimeSeconds ?? 0));
  const others = results.filter((r) => r.status !== ClubEventResultStatus.FINISHED);
  return [
    ...finished.map((r, i) => ({ ...r, rank: i + 1 })),
    ...others.map((r) => ({ ...r, rank: null })),
  ];
}

@Injectable()
export class ClubEventsService {
  constructor(private readonly prisma: PrismaService) {}

  /** COACH/PLATFORM_ADMIN/CLUB_ADMIN only (enforced by the controller's @Roles) - always created DRAFT. */
  async create(organisationId: string, dto: CreateClubEventDto) {
    return this.prisma.clubEvent.create({
      data: {
        organisationId,
        name: dto.name,
        eventDate: new Date(dto.eventDate),
        distance: dto.distance,
      },
    });
  }

  /**
   * The route's @ScopeResource('organisation', 'organisationId') guard
   * already restricts a non-admin caller's :organisationId to their own JWT
   * claim, so the only thing left to filter here is DRAFT visibility - a
   * CLUB_MEMBER never sees a staged event before it's published.
   */
  async findAllForOrg(ctx: AuthContext, organisationId: string) {
    return this.prisma.clubEvent.findMany({
      where: {
        organisationId,
        deletedAt: null,
        ...(isManager(ctx) ? {} : { status: ClubEventStatus.PUBLISHED }),
      },
      orderBy: { eventDate: 'desc' },
    });
  }

  /** Self, any manager in the club, or PLATFORM_ADMIN - 404s (not 403) for both out-of-scope and still-DRAFT. */
  async findOne(ctx: AuthContext, id: string) {
    const event = await this.prisma.clubEvent.findFirst({
      where: { id, deletedAt: null },
      include: { results: { include: { clubMember: { select: RESULT_MEMBER_SELECT } } } },
    });
    if (!event) {
      throw new NotFoundException('Club event not found');
    }
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.organisationId !== event.organisationId) {
      throw new NotFoundException('Club event not found');
    }
    if (!isManager(ctx) && event.status !== ClubEventStatus.PUBLISHED) {
      throw new NotFoundException('Club event not found');
    }
    return { ...event, results: rankResults(event.results) };
  }

  /** COACH/PLATFORM_ADMIN/CLUB_ADMIN only - name/date/distance, or publishing via status. */
  async update(ctx: AuthContext, id: string, dto: UpdateClubEventDto) {
    const event = await this.findEventForManager(ctx, id);
    return this.prisma.clubEvent.update({
      where: { id: event.id },
      data: {
        name: dto.name,
        eventDate: dto.eventDate ? new Date(dto.eventDate) : undefined,
        distance: dto.distance,
        status: dto.status,
      },
    });
  }

  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const event = await this.findEventForManager(ctx, id);
    await this.prisma.clubEvent.update({
      where: { id: event.id },
      data: { deletedAt: new Date() },
    });
  }

  async addResult(ctx: AuthContext, eventId: string, dto: CreateClubEventResultDto) {
    const event = await this.findEventForManager(ctx, eventId);
    const member = await this.prisma.clubMember.findFirst({
      where: { id: dto.clubMemberId, organisationId: event.organisationId, deletedAt: null },
    });
    if (!member) {
      throw new BadRequestException('That club member is not in this organisation');
    }
    return this.prisma.clubEventResult.create({
      data: {
        clubEventId: event.id,
        clubMemberId: member.id,
        finishTimeSeconds: dto.finishTimeSeconds,
        status: dto.status ?? ClubEventResultStatus.FINISHED,
      },
      include: { clubMember: { select: RESULT_MEMBER_SELECT } },
    });
  }

  /**
   * All-or-nothing, same convention as ClubMembersService.importCsv: parses
   * and resolves every row's membershipNumber before touching the database,
   * so a mid-import failure never leaves a partial result set behind.
   */
  async importResultsCsv(ctx: AuthContext, eventId: string, buffer: Buffer) {
    const event = await this.findEventForManager(ctx, eventId);
    const parsed = parseClubEventResultsCsv(buffer);
    if ('errors' in parsed) {
      throw new BadRequestException({ message: 'CSV import failed', errors: parsed.errors });
    }

    const members = await this.prisma.clubMember.findMany({
      where: { organisationId: event.organisationId, deletedAt: null },
      select: { id: true, membershipNumber: true },
    });
    const memberByNumber = new Map(members.map((m) => [m.membershipNumber, m.id]));

    const errors: string[] = [];
    const data: Prisma.ClubEventResultCreateManyInput[] = [];
    parsed.rows.forEach((row, index) => {
      const memberId = memberByNumber.get(row.membershipNumber);
      if (!memberId) {
        errors.push(
          `Row ${index + 2}: no club member with membership number "${row.membershipNumber}"`,
        );
        return;
      }
      data.push({
        clubEventId: event.id,
        clubMemberId: memberId,
        finishTimeSeconds: row.finishTimeSeconds,
        status: row.status,
      });
    });
    if (errors.length > 0) {
      throw new BadRequestException({ message: 'CSV import failed', errors });
    }

    await this.prisma.clubEventResult.createMany({ data, skipDuplicates: false });
    return this.findOne(ctx, eventId);
  }

  async updateResult(ctx: AuthContext, resultId: string, dto: UpdateClubEventResultDto) {
    const result = await this.findResultForManager(ctx, resultId);
    return this.prisma.clubEventResult.update({
      where: { id: result.id },
      data: { finishTimeSeconds: dto.finishTimeSeconds, status: dto.status },
      include: { clubMember: { select: RESULT_MEMBER_SELECT } },
    });
  }

  async deleteResult(ctx: AuthContext, resultId: string): Promise<void> {
    const result = await this.findResultForManager(ctx, resultId);
    await this.prisma.clubEventResult.delete({ where: { id: result.id } });
  }

  /** COACH/PLATFORM_ADMIN/CLUB_ADMIN only, scoped to their own org - 404s otherwise (existence-hiding). */
  private async findEventForManager(ctx: AuthContext, id: string) {
    const event = await this.prisma.clubEvent.findFirst({ where: { id, deletedAt: null } });
    if (!event) {
      throw new NotFoundException('Club event not found');
    }
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.organisationId !== event.organisationId) {
      throw new NotFoundException('Club event not found');
    }
    return event;
  }

  private async findResultForManager(ctx: AuthContext, resultId: string) {
    const result = await this.prisma.clubEventResult.findUnique({ where: { id: resultId } });
    if (!result) {
      throw new NotFoundException('Result not found');
    }
    await this.findEventForManager(ctx, result.clubEventId);
    return result;
  }
}
