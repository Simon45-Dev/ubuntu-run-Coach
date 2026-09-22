import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { WorkoutsService } from './workouts.service';
import { SubmitWorkoutResultDto } from './dto/submit-workout-result.dto';

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
}
