import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { buildAthleteScopeFilter } from '../../common/scope/scope-filters';
import { CreatePersonalBestDto } from './dto/create-personal-best.dto';
import { UpdatePersonalBestDto } from './dto/update-personal-best.dto';

/**
 * Self, own coach, or PLATFORM_ADMIN may create/read/update/delete a
 * personal best - same set buildAthleteScopeFilter already returns, reused
 * for both read and write authorisation (mirrors RaceGoalsService's own
 * reasoning: no broader-read-than-write split needed for this resource).
 */
@Injectable()
export class PersonalBestsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: AuthContext, athleteId: string, dto: CreatePersonalBestDto) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: athleteId, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    return this.prisma.personalBest.create({
      data: {
        athleteId,
        distance: dto.distance,
        timeSeconds: dto.timeSeconds,
        achievedDate: dto.achievedDate ? new Date(dto.achievedDate) : undefined,
        source: dto.source,
      },
    });
  }

  async findAllForAthlete(ctx: AuthContext, athleteId: string) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: athleteId, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    return this.prisma.personalBest.findMany({
      where: { athleteId, deletedAt: null },
      orderBy: { timeSeconds: 'asc' },
    });
  }

  /** The shared scoping gate every other method uses. */
  async findScopedOrThrow(ctx: AuthContext, id: string) {
    const personalBest = await this.prisma.personalBest.findFirst({
      where: {
        id,
        deletedAt: null,
        athlete: { deletedAt: null, ...buildAthleteScopeFilter(ctx) },
      },
    });
    if (!personalBest) {
      throw new NotFoundException('Personal best not found');
    }
    return personalBest;
  }

  async update(ctx: AuthContext, id: string, dto: UpdatePersonalBestDto) {
    const personalBest = await this.findScopedOrThrow(ctx, id);
    return this.prisma.personalBest.update({
      where: { id: personalBest.id },
      data: {
        distance: dto.distance,
        timeSeconds: dto.timeSeconds,
        achievedDate: dto.achievedDate ? new Date(dto.achievedDate) : undefined,
        source: dto.source,
      },
    });
  }

  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const personalBest = await this.findScopedOrThrow(ctx, id);
    await this.prisma.personalBest.update({
      where: { id: personalBest.id },
      data: { deletedAt: new Date() },
    });
  }
}
