import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { buildTrainingPlanScopeFilter } from '../../common/scope/scope-filters';
import { CreateTrainingPlanDto } from './dto/create-training-plan.dto';
import { UpdateTrainingPlanDto } from './dto/update-training-plan.dto';

@Injectable()
export class TrainingPlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** Route is @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches here. */
  async create(ctx: AuthContext, athleteId: string, dto: CreateTrainingPlanDto) {
    const athlete = await this.prisma.athlete.findFirst({
      where: { id: athleteId, deletedAt: null },
    });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    if (ctx.role === Role.COACH && athlete.coachId !== ctx.coachId) {
      throw new NotFoundException('Athlete not found');
    }
    if (!athlete.coachId || !athlete.organisationId) {
      throw new BadRequestException(
        'Athlete has no assigned coach - cannot create a training plan',
      );
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('endDate must not be before startDate');
    }

    return this.prisma.trainingPlan.create({
      data: {
        organisationId: athlete.organisationId,
        coachId: athlete.coachId,
        athleteId: athlete.id,
        name: dto.name,
        startDate,
        endDate,
        goal: dto.goal,
        phase: dto.phase,
      },
    });
  }

  /** Coach must have this athlete on their own roster; admin/self unrestricted. */
  async findAllForAthlete(ctx: AuthContext, athleteId: string) {
    if (ctx.role === Role.COACH) {
      const athlete = await this.prisma.athlete.findFirst({
        where: { id: athleteId, deletedAt: null, coachId: ctx.coachId },
      });
      if (!athlete) {
        throw new NotFoundException('Athlete not found');
      }
    }
    return this.prisma.trainingPlan.findMany({
      where: { athleteId, deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
  }

  /** Self, own coach, or PLATFORM_ADMIN - the core data-isolation boundary. */
  async findOne(ctx: AuthContext, id: string) {
    const plan = await this.prisma.trainingPlan.findFirst({
      where: { id, deletedAt: null, ...buildTrainingPlanScopeFilter(ctx) },
    });
    if (!plan) {
      throw new NotFoundException('Training plan not found');
    }
    return plan;
  }

  /** Route is @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches here. */
  async update(ctx: AuthContext, id: string, dto: UpdateTrainingPlanDto) {
    const plan = await this.findOne(ctx, id);

    const startDate = dto.startDate ? new Date(dto.startDate) : plan.startDate;
    const endDate =
      dto.endDate !== undefined ? (dto.endDate ? new Date(dto.endDate) : null) : plan.endDate;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('endDate must not be before startDate');
    }

    return this.prisma.trainingPlan.update({
      where: { id: plan.id },
      data: {
        name: dto.name,
        startDate: dto.startDate ? startDate : undefined,
        endDate: dto.endDate !== undefined ? endDate : undefined,
        goal: dto.goal,
        phase: dto.phase,
        status: dto.status,
      },
    });
  }

  /**
   * Route is @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches here.
   * Cascades to the plan's own workouts so a "deleted" plan can't leave
   * independently-queryable workouts behind.
   */
  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const plan = await this.findOne(ctx, id);
    await this.prisma.$transaction([
      this.prisma.workout.updateMany({
        where: { trainingPlanId: plan.id, deletedAt: null },
        data: { deletedAt: new Date() },
      }),
      this.prisma.trainingPlan.update({
        where: { id: plan.id },
        data: { deletedAt: new Date() },
      }),
    ]);
  }
}
