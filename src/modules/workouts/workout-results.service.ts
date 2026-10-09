import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { buildAthleteScopeFilter } from '../../common/scope/scope-filters';
import { WorkoutsService } from './workouts.service';
import { SubmitWorkoutResultDto } from './dto/submit-workout-result.dto';
import { CreateStandaloneResultDto } from './dto/create-standalone-result.dto';

/**
 * A result never exists independently of a workout, and access to it must
 * match access to the workout exactly - both flow through
 * WorkoutsService.findScopedOrThrow rather than re-deriving scope here.
 *
 * There's one row per (workout, athlete), not per workout - a group-assigned
 * workout needs an independent result per member. An individual-plan
 * workout only ever has one possible athlete (the plan's own athleteId),
 * so that case is unambiguous and its existing behaviour is unchanged.
 */
@Injectable()
export class WorkoutResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workoutsService: WorkoutsService,
  ) {}

  /**
   * - ATHLETE caller: always their own result (any athleteId in the body is
   *   ignored - a result can't be submitted in someone else's name).
   * - individual-plan workout: the plan's one athlete, regardless of caller
   *   role - unchanged from before groups existed (a coach may submit on
   *   behalf of their athlete).
   * - group-assigned workout, COACH/PLATFORM_ADMIN caller: `dto.athleteId`
   *   is required and must be a member of the plan's group.
   */
  async submit(ctx: AuthContext, workoutId: string, dto: SubmitWorkoutResultDto) {
    const workout = await this.workoutsService.findScopedOrThrow(ctx, workoutId);
    const plan = workout.trainingPlan;

    let athleteId: string;
    if (ctx.role === Role.ATHLETE) {
      athleteId = ctx.athleteId!;
    } else if (plan.athleteId) {
      athleteId = plan.athleteId;
    } else if (plan.groupId) {
      if (!dto.athleteId) {
        throw new BadRequestException(
          'athleteId is required to submit a result on behalf of an athlete for a group-assigned workout',
        );
      }
      const membership = await this.prisma.groupMembership.findFirst({
        where: { groupId: plan.groupId, athleteId: dto.athleteId },
      });
      if (!membership) {
        throw new NotFoundException('Athlete is not a member of this group');
      }
      athleteId = dto.athleteId;
    } else {
      throw new NotFoundException('Workout has no assigned athlete or group');
    }

    const data = {
      actualDistanceKm: dto.actualDistanceKm,
      actualDurationSec: dto.actualDurationSec,
      actualPace: dto.actualPace,
      avgHr: dto.avgHr,
      maxHr: dto.maxHr,
      rpe: dto.rpe,
      comments: dto.comments,
      completedAt: dto.completedAt ? new Date(dto.completedAt) : new Date(),
    };

    return this.prisma.workoutResult.upsert({
      where: { workoutId_athleteId: { workoutId: workout.id, athleteId } },
      create: { workoutId: workout.id, athleteId, ...data },
      update: data,
    });
  }

  /**
   * - ATHLETE caller: their own result, always.
   * - individual-plan workout: the plan's one athlete's result, for any
   *   allowed caller - unchanged from before groups existed.
   * - group-assigned workout, COACH/PLATFORM_ADMIN caller: requires
   *   `athleteIdQuery` (the `?athleteId=` query param) - there's no single
   *   "the" result to return for a shared workout. Use findAllForWorkout to
   *   see every member's result at once.
   */
  async findOne(ctx: AuthContext, workoutId: string, athleteIdQuery?: string) {
    const workout = await this.workoutsService.findScopedOrThrow(ctx, workoutId);
    const plan = workout.trainingPlan;

    let athleteId: string;
    if (ctx.role === Role.ATHLETE) {
      athleteId = ctx.athleteId!;
    } else if (plan.athleteId) {
      athleteId = plan.athleteId;
    } else if (athleteIdQuery) {
      athleteId = athleteIdQuery;
    } else {
      throw new BadRequestException(
        'Specify ?athleteId= or use GET /workouts/:id/results to see every result for a group-assigned workout',
      );
    }

    const result = await this.prisma.workoutResult.findUnique({
      where: { workoutId_athleteId: { workoutId, athleteId } },
    });
    if (!result) {
      throw new NotFoundException('No result submitted for this workout yet');
    }
    return result;
  }

  /** Route is @Roles(COACH, PLATFORM_ADMIN) - every submitted result for this workout. */
  async findAllForWorkout(ctx: AuthContext, workoutId: string) {
    const workout = await this.workoutsService.findScopedOrThrow(ctx, workoutId);
    return this.prisma.workoutResult.findMany({
      where: { workoutId: workout.id },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Resolves and scope-checks an athleteId. Uses AND rather than spreading
   * buildAthleteScopeFilter's `{ id: ctx.athleteId }` (ATHLETE role) directly
   * into this object - that key would silently clash with and override the
   * explicit `id: athleteId` below, making the check always pass for an
   * ATHLETE caller regardless of which athleteId was actually requested.
   * Routes elsewhere get away with the spread form because a
   * @ScopeResource('athlete', ...) guard already rejects a mismatched
   * athleteId before the service runs - this method is also called from
   * removeStandalone, reached via `/workout-results/:id`, which has no
   * :athleteId param for that guard to check.
   */
  private async assertAthleteAccessible(ctx: AuthContext, athleteId: string) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { AND: [{ id: athleteId, deletedAt: null }, buildAthleteScopeFilter(ctx)] },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    return athlete;
  }

  /**
   * A quick-logged run with no planned Workout behind it - an athlete logging
   * their own run, or their coach/PLATFORM_ADMIN logging on their behalf.
   * Each call creates its own row (never an upsert) - there's no natural
   * dedupe key for a free-floating log entry the way workoutId_athleteId is
   * for a planned one.
   */
  async createStandalone(ctx: AuthContext, athleteId: string, dto: CreateStandaloneResultDto) {
    await this.assertAthleteAccessible(ctx, athleteId);
    return this.prisma.workoutResult.create({
      data: {
        athleteId,
        workoutId: null,
        completedAt: new Date(dto.completedAt),
        actualDistanceKm: dto.actualDistanceKm,
        actualDurationSec: dto.actualDurationSec,
        actualPace: dto.actualPace,
        avgHr: dto.avgHr,
        maxHr: dto.maxHr,
        rpe: dto.rpe,
        comments: dto.comments,
      },
    });
  }

  /**
   * Every result for this athlete, plan-linked and standalone together,
   * newest-first by whichever date applies (a planned workout's own
   * scheduledDate, or the result's own completedAt for a standalone one) -
   * Prisma can't ORDER BY COALESCE across a relation, so the merge/sort
   * happens in application code instead.
   */
  async findAllForAthlete(ctx: AuthContext, athleteId: string) {
    await this.assertAthleteAccessible(ctx, athleteId);
    const results = await this.prisma.workoutResult.findMany({
      where: { athleteId },
      include: { workout: { select: { scheduledDate: true, type: true } } },
    });
    return results
      .map((r) => ({
        ...r,
        effectiveDate: r.workout?.scheduledDate ?? r.completedAt ?? r.createdAt,
      }))
      .sort((a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime());
  }

  /** Only ever removes a standalone entry - a plan-linked result stays managed through its workout. */
  async removeStandalone(ctx: AuthContext, id: string): Promise<void> {
    const result = await this.prisma.workoutResult.findFirst({ where: { id, workoutId: null } });
    if (!result) {
      throw new NotFoundException('Result not found');
    }
    await this.assertAthleteAccessible(ctx, result.athleteId);
    await this.prisma.workoutResult.delete({ where: { id: result.id } });
  }
}
