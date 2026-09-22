import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { buildTrainingPlanScopeFilter } from '../../common/scope/scope-filters';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';

@Injectable()
export class WorkoutsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Route is @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches here. */
  async create(ctx: AuthContext, trainingPlanId: string, dto: CreateWorkoutDto) {
    const plan = await this.prisma.trainingPlan.findFirst({
      where: { id: trainingPlanId, deletedAt: null, ...buildTrainingPlanScopeFilter(ctx) },
    });
    if (!plan) {
      throw new NotFoundException('Training plan not found');
    }

    const scheduledDate = new Date(dto.scheduledDate);
    if (scheduledDate < plan.startDate || (plan.endDate && scheduledDate > plan.endDate)) {
      throw new BadRequestException('scheduledDate must fall within the training plan dates');
    }

    return this.prisma.workout.create({
      data: {
        trainingPlanId: plan.id,
        scheduledDate,
        type: dto.type,
        distanceTargetKm: dto.distanceTargetKm,
        durationTargetSec: dto.durationTargetSec,
        paceTarget: dto.paceTarget,
        hrZoneTarget: dto.hrZoneTarget,
        rpeTarget: dto.rpeTarget,
        instructions: dto.instructions,
      },
    });
  }

  async findAllForPlan(ctx: AuthContext, trainingPlanId: string) {
    const plan = await this.prisma.trainingPlan.findFirst({
      where: { id: trainingPlanId, deletedAt: null, ...buildTrainingPlanScopeFilter(ctx) },
    });
    if (!plan) {
      throw new NotFoundException('Training plan not found');
    }
    return this.prisma.workout.findMany({
      where: { trainingPlanId: plan.id, deletedAt: null },
      orderBy: { scheduledDate: 'asc' },
    });
  }

  /**
   * The single place the Workout scope filter + deletedAt chain is written -
   * reused by WorkoutResultsService so result-scoping always matches
   * workout-scoping exactly.
   */
  async findScopedOrThrow(ctx: AuthContext, workoutId: string) {
    const workout = await this.prisma.workout.findFirst({
      where: {
        id: workoutId,
        deletedAt: null,
        trainingPlan: { deletedAt: null, ...buildTrainingPlanScopeFilter(ctx) },
      },
      include: { trainingPlan: true },
    });
    if (!workout) {
      throw new NotFoundException('Workout not found');
    }
    return workout;
  }

  async findOne(ctx: AuthContext, id: string) {
    return this.findScopedOrThrow(ctx, id);
  }

  /** Route is @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches here. */
  async update(ctx: AuthContext, id: string, dto: UpdateWorkoutDto) {
    const workout = await this.findScopedOrThrow(ctx, id);
    const plan = workout.trainingPlan;

    const scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : workout.scheduledDate;
    if (scheduledDate < plan.startDate || (plan.endDate && scheduledDate > plan.endDate)) {
      throw new BadRequestException('scheduledDate must fall within the training plan dates');
    }

    return this.prisma.workout.update({
      where: { id: workout.id },
      data: {
        scheduledDate: dto.scheduledDate ? scheduledDate : undefined,
        type: dto.type,
        distanceTargetKm: dto.distanceTargetKm,
        durationTargetSec: dto.durationTargetSec,
        paceTarget: dto.paceTarget,
        hrZoneTarget: dto.hrZoneTarget,
        rpeTarget: dto.rpeTarget,
        instructions: dto.instructions,
      },
    });
  }

  /** Route is @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches here. */
  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const workout = await this.findScopedOrThrow(ctx, id);
    await this.prisma.workout.update({
      where: { id: workout.id },
      data: { deletedAt: new Date() },
    });
  }
}
