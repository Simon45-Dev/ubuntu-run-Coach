import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { buildAthleteScopeFilter } from '../../common/scope/scope-filters';
import { GrantConsentDto } from './dto/grant-consent.dto';

@Injectable()
export class ConsentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consent can only be granted by the data subject themselves - the athlete
   * route is @Roles(ATHLETE) so no other role reaches this, but the identity
   * check is repeated here defensively, matching the rest of the codebase's
   * convention of not trusting guard-level checks alone.
   */
  async grant(ctx: AuthContext, athleteId: string, dto: GrantConsentDto) {
    if (ctx.role !== Role.ATHLETE || ctx.athleteId !== athleteId) {
      throw new ForbiddenException('Consent can only be granted by the athlete themselves');
    }
    return this.prisma.consent.create({
      data: {
        athleteId,
        consentType: dto.consentType,
        policyVersion: dto.policyVersion,
      },
    });
  }

  /** Self, own coach, or PLATFORM_ADMIN - status/dates only, not check-in content. */
  async findAllForAthlete(ctx: AuthContext, athleteId: string, pagination: PaginationQueryDto) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: athleteId, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }

    const { page, pageSize } = pagination;
    const where = { athleteId };
    const [items, total] = await Promise.all([
      this.prisma.consent.findMany({
        where,
        orderBy: { grantedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.consent.count({ where }),
    ]);
    return { items, total, page, pageSize };
  }

  /**
   * Withdrawal is self (the athlete who granted it) or PLATFORM_ADMIN acting
   * on a support/compliance request - never a coach. Idempotent if already
   * withdrawn. 404, not 403, for a consent that isn't the caller's own - same
   * existence-hiding convention used everywhere else.
   */
  async withdraw(ctx: AuthContext, consentId: string) {
    const consent = await this.prisma.consent.findUnique({ where: { id: consentId } });
    if (!consent) {
      throw new NotFoundException('Consent not found');
    }
    if (ctx.role === Role.ATHLETE && consent.athleteId !== ctx.athleteId) {
      throw new NotFoundException('Consent not found');
    }
    if (ctx.role !== Role.ATHLETE && ctx.role !== Role.PLATFORM_ADMIN) {
      throw new ForbiddenException();
    }
    if (consent.withdrawnAt) {
      return consent;
    }
    return this.prisma.consent.update({
      where: { id: consent.id },
      data: { withdrawnAt: new Date() },
    });
  }
}
