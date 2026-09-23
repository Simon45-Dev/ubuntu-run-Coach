import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { buildAthleteScopeFilter } from '../../common/scope/scope-filters';
import { CreateRaceGoalDto } from './dto/create-race-goal.dto';
import { UpdateRaceGoalDto } from './dto/update-race-goal.dto';

/**
 * Self, own coach, or PLATFORM_ADMIN may create/read/update/delete a race
 * goal - the same set buildAthleteScopeFilter already returns, reused for
 * both read and write authorisation here (unlike TrainingPlan, there's no
 * broader-read-than-write split needed for this resource).
 */
@Injectable()
export class RaceGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(ctx: AuthContext, athleteId: string, dto: CreateRaceGoalDto) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: athleteId, deletedAt: null, ...buildAthleteScopeFilter(ctx) },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    return this.prisma.raceGoal.create({
      data: {
        athleteId,
        raceName: dto.raceName,
        raceDate: new Date(dto.raceDate),
        distance: dto.distance,
        targetTimeSeconds: dto.targetTimeSeconds,
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
    return this.prisma.raceGoal.findMany({
      where: { athleteId, deletedAt: null },
      orderBy: { raceDate: 'asc' },
    });
  }

  /** The shared scoping gate every other method uses. */
  async findScopedOrThrow(ctx: AuthContext, id: string) {
    const raceGoal = await this.prisma.raceGoal.findFirst({
      where: {
        id,
        deletedAt: null,
        athlete: { deletedAt: null, ...buildAthleteScopeFilter(ctx) },
      },
    });
    if (!raceGoal) {
      throw new NotFoundException('Race goal not found');
    }
    return raceGoal;
  }

  async update(ctx: AuthContext, id: string, dto: UpdateRaceGoalDto) {
    const raceGoal = await this.findScopedOrThrow(ctx, id);
    return this.prisma.raceGoal.update({
      where: { id: raceGoal.id },
      data: {
        raceName: dto.raceName,
        raceDate: dto.raceDate ? new Date(dto.raceDate) : undefined,
        distance: dto.distance,
        targetTimeSeconds: dto.targetTimeSeconds,
        status: dto.status,
        actualTimeSeconds: dto.actualTimeSeconds,
      },
    });
  }

  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const raceGoal = await this.findScopedOrThrow(ctx, id);
    await this.prisma.raceGoal.update({
      where: { id: raceGoal.id },
      data: { deletedAt: new Date() },
    });
  }
}
