import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { WorkoutsService } from './workouts.service';
import { SubmitWorkoutResultDto } from './dto/submit-workout-result.dto';

/**
 * A result never exists independently of a workout, and access to it must
 * match access to the workout exactly - both flow through
 * WorkoutsService.findScopedOrThrow rather than re-deriving scope here.
 */
@Injectable()
export class WorkoutResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workoutsService: WorkoutsService,
  ) {}

  /**
   * Caller must be the workout's own athlete, that plan's coach, or
   * PLATFORM_ADMIN - enforced entirely by findScopedOrThrow. Upsert keyed on
   * the unique workoutId: a resubmission (fixed reading, added comment) just
   * updates in place rather than needing a separate 409 path.
   */
  async submit(ctx: AuthContext, workoutId: string, dto: SubmitWorkoutResultDto) {
    const workout = await this.workoutsService.findScopedOrThrow(ctx, workoutId);
    const athleteId = workout.trainingPlan.athleteId;
    if (!athleteId) {
      throw new NotFoundException('Workout has no assigned athlete');
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
      where: { workoutId: workout.id },
      create: { workoutId: workout.id, athleteId, ...data },
      update: data,
    });
  }

  /** Distinct 404s: workout out of scope/missing vs. no result submitted yet. */
  async findOne(ctx: AuthContext, workoutId: string) {
    await this.workoutsService.findScopedOrThrow(ctx, workoutId);
    const result = await this.prisma.workoutResult.findUnique({ where: { workoutId } });
    if (!result) {
      throw new NotFoundException('No result submitted for this workout yet');
    }
    return result;
  }
}
