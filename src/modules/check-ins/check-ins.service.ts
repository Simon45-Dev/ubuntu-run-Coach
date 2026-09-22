import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConsentType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildAthleteScopeFilter } from '../../common/scope/scope-filters';
import { SubmitCheckInDto } from './dto/submit-check-in.dto';

function toUtcMidnight(dateInput: string): Date {
  const date = new Date(dateInput);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

@Injectable()
export class CheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Only the athlete may submit their own check-in - HealthDataScopeGuard has
   * already confirmed a live consent exists for this athleteId before this
   * runs, but the consent row itself is re-resolved here (not passed through
   * from the guard) to get its id for the FK, matching the codebase's
   * existing convention of keeping guard and service DB lookups independent.
   */
  async submit(ctx: AuthContext, athleteId: string, dto: SubmitCheckInDto) {
    if (ctx.role !== Role.ATHLETE || ctx.athleteId !== athleteId) {
      throw new ForbiddenException('A check-in can only be submitted by the athlete themselves');
    }

    const liveConsent = await this.prisma.consent.findFirst({
      where: { athleteId, consentType: ConsentType.HEALTH_CHECKIN_DATA, withdrawnAt: null },
    });
    if (!liveConsent) {
      throw new ForbiddenException('No active consent on record for health check-in data');
    }

    const date = toUtcMidnight(dto.date);
    return this.prisma.checkIn.upsert({
      where: { athleteId_date: { athleteId, date } },
      create: {
        athleteId,
        date,
        consentId: liveConsent.id,
        sleepQuality: dto.sleepQuality,
        energy: dto.energy,
        soreness: dto.soreness,
        stress: dto.stress,
        motivation: dto.motivation,
        pain: dto.pain,
      },
      update: {
        consentId: liveConsent.id,
        sleepQuality: dto.sleepQuality,
        energy: dto.energy,
        soreness: dto.soreness,
        stress: dto.stress,
        motivation: dto.motivation,
        pain: dto.pain,
      },
    });
  }

  /** Self, own coach, or PLATFORM_ADMIN - guarded by HealthDataScopeGuard for a live consent. */
  async findAllForAthlete(ctx: AuthContext, athleteId: string, pagination: PaginationQueryDto) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: athleteId, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }

    const { page, pageSize } = pagination;
    const where = { athleteId, deletedAt: null };
    const [items, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.checkIn.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }
}
