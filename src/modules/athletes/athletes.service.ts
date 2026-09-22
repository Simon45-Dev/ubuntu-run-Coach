import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { buildAthleteScopeFilter } from '../../common/scope/scope-filters';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';

// `coach` is included (not just coachId) so an athlete's own profile response
// can surface who their coach is - e.g. for the web dashboard's messaging UI,
// which needs the coach's userId to address a message without a separate
// lookup the athlete isn't permitted to make (GET /coaches/:id is COACH/ADMIN
// only - see OrgScopeGuard's 'coach' scope case).
const ATHLETE_INCLUDE = {
  user: { select: { id: true, email: true, name: true, status: true } },
  coach: { select: { id: true, user: { select: { id: true, name: true } } } },
};

/**
 * `Record<string, unknown>` (the DTO's type) isn't structurally assignable
 * to Prisma's InputJsonValue even though the shapes match at runtime - this
 * narrows at the one place it's written, rather than casting at each call
 * site.
 */
function toJsonInput(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  return value as Prisma.InputJsonValue | undefined;
}

@Injectable()
export class AthletesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Coach creates on their own roster (coachId is always the caller's own), or PLATFORM_ADMIN. */
  async create(ctx: AuthContext, coachId: string, dto: CreateAthleteDto) {
    if (ctx.role === Role.COACH && ctx.coachId !== coachId) {
      throw new ForbiddenException();
    }
    const coach = await this.prisma.coach.findFirst({ where: { id: coachId, deletedAt: null } });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ForbiddenException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: Role.ATHLETE,
          status: UserStatus.ACTIVE,
        },
      });
      return tx.athlete.create({
        data: {
          userId: user.id,
          coachId,
          organisationId: coach.organisationId,
          goal: dto.goal,
          availability: toJsonInput(dto.availability),
        },
        include: ATHLETE_INCLUDE,
      });
    });
  }

  /** Own roster only - a coach never sees another coach's athletes. */
  async findAllForCoach(ctx: AuthContext, coachId: string) {
    if (ctx.role === Role.COACH && ctx.coachId !== coachId) {
      throw new ForbiddenException();
    }
    if (ctx.role === Role.PLATFORM_ADMIN) {
      return this.prisma.athlete.findMany({
        where: { coachId, deletedAt: null },
        include: ATHLETE_INCLUDE,
      });
    }
    return this.prisma.athlete.findMany({
      where: { coachId, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
      include: ATHLETE_INCLUDE,
    });
  }

  /** Self, own coach, or PLATFORM_ADMIN - the core data-isolation boundary. */
  async findOne(ctx: AuthContext, id: string) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
      include: ATHLETE_INCLUDE,
    });
    if (!athlete) {
      // 404, not 403: an out-of-scope athlete's existence isn't confirmed
      // to a caller who isn't their coach and isn't them.
      throw new NotFoundException('Athlete not found');
    }
    return athlete;
  }

  async update(ctx: AuthContext, id: string, dto: UpdateAthleteDto) {
    const athlete = await this.findOne(ctx, id);

    if (ctx.role === Role.ATHLETE) {
      if (dto.coachId) {
        throw new ForbiddenException('Athletes cannot reassign their own coach');
      }
      return this.prisma.athlete.update({
        where: { id: athlete.id },
        data: {
          goal: dto.goal,
          availability: toJsonInput(dto.availability),
          trainingBackground: dto.trainingBackground,
        },
        include: ATHLETE_INCLUDE,
      });
    }

    // COACH or PLATFORM_ADMIN may additionally reassign coachId.
    if (dto.coachId) {
      const targetCoach = await this.prisma.coach.findFirst({
        where: { id: dto.coachId, deletedAt: null },
      });
      if (!targetCoach) {
        throw new NotFoundException('Target coach not found');
      }
      if (ctx.role === Role.COACH && targetCoach.organisationId !== ctx.organisationId) {
        throw new ForbiddenException('Cannot reassign athlete outside your organisation');
      }
    }

    return this.prisma.athlete.update({
      where: { id: athlete.id },
      data: {
        goal: dto.goal,
        availability: toJsonInput(dto.availability),
        trainingBackground: dto.trainingBackground,
        coachId: dto.coachId,
        organisationId: dto.coachId
          ? (await this.prisma.coach.findUniqueOrThrow({ where: { id: dto.coachId } }))
              .organisationId
          : undefined,
      },
      include: ATHLETE_INCLUDE,
    });
  }

  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const athlete = await this.findOne(ctx, id);
    if (ctx.role === Role.ATHLETE) {
      throw new ForbiddenException();
    }
    await this.prisma.athlete.update({
      where: { id: athlete.id },
      data: { deletedAt: new Date() },
    });
  }
}
