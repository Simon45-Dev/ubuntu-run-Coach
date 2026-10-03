import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { TrainingPlanTemplate } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateTemplateWorkoutDto } from './dto/create-template-workout.dto';
import { UpdateTemplateWorkoutDto } from './dto/update-template-workout.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Route is @Roles(COACH, PLATFORM_ADMIN) - ATHLETE never reaches here. */
  async create(ctx: AuthContext, coachId: string, dto: CreateTemplateDto) {
    if (ctx.role === Role.COACH && ctx.coachId !== coachId) {
      throw new NotFoundException('Coach not found');
    }
    const coach = await this.prisma.coach.findFirst({ where: { id: coachId, deletedAt: null } });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }
    return this.prisma.trainingPlanTemplate.create({
      data: {
        coachId,
        organisationId: coach.organisationId,
        name: dto.name,
        goal: dto.goal,
        phase: dto.phase,
      },
    });
  }

  /** PLATFORM_ADMIN only (route-enforced) - publishes a template visible to every coach. */
  async createGlobal(dto: CreateTemplateDto) {
    return this.prisma.trainingPlanTemplate.create({
      data: {
        coachId: null,
        organisationId: null,
        isGlobal: true,
        name: dto.name,
        goal: dto.goal,
        phase: dto.phase,
      },
    });
  }

  async findAllGlobal() {
    return this.prisma.trainingPlanTemplate.findMany({
      where: { isGlobal: true, deletedAt: null },
      include: { workouts: { orderBy: { dayOffset: 'asc' } } },
    });
  }

  /** A coach's own templates plus every shared-library (isGlobal) template. */
  async findAllForCoach(ctx: AuthContext, coachId: string) {
    if (ctx.role === Role.COACH && ctx.coachId !== coachId) {
      throw new NotFoundException('Coach not found');
    }
    return this.prisma.trainingPlanTemplate.findMany({
      where: { deletedAt: null, OR: [{ coachId }, { isGlobal: true }] },
      include: { workouts: { orderBy: { dayOffset: 'asc' } } },
    });
  }

  /**
   * Coach-owner, PLATFORM_ADMIN, or anyone viewing a shared-library template
   * - templates are never athlete-facing. Read access alone does not imply
   * the caller may edit/delete it; see assertCanManage for that.
   */
  async findOne(ctx: AuthContext, id: string) {
    const template = await this.prisma.trainingPlanTemplate.findFirst({
      where: { id, deletedAt: null },
      include: { workouts: { orderBy: { dayOffset: 'asc' } } },
    });
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    if (ctx.role === Role.PLATFORM_ADMIN) {
      return template;
    }
    if (template.isGlobal) {
      return template;
    }
    if (ctx.role === Role.COACH && template.coachId === ctx.coachId) {
      return template;
    }
    throw new NotFoundException('Template not found');
  }

  /**
   * Viewing a shared-library template doesn't mean a coach may edit it -
   * only PLATFORM_ADMIN may mutate isGlobal content. A coach may still only
   * mutate their own personal templates, same as before this existed.
   */
  private assertCanManage(ctx: AuthContext, template: TrainingPlanTemplate): void {
    if (ctx.role === Role.PLATFORM_ADMIN) {
      return;
    }
    if (template.isGlobal) {
      throw new ForbiddenException();
    }
    if (ctx.role === Role.COACH && template.coachId === ctx.coachId) {
      return;
    }
    throw new NotFoundException('Template not found');
  }

  async update(ctx: AuthContext, id: string, dto: UpdateTemplateDto) {
    const template = await this.findOne(ctx, id);
    this.assertCanManage(ctx, template);
    return this.prisma.trainingPlanTemplate.update({
      where: { id: template.id },
      data: { name: dto.name, goal: dto.goal, phase: dto.phase },
      include: { workouts: { orderBy: { dayOffset: 'asc' } } },
    });
  }

  /** Soft delete - doesn't touch plans already created from this template (independent copies). */
  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const template = await this.findOne(ctx, id);
    this.assertCanManage(ctx, template);
    await this.prisma.trainingPlanTemplate.update({
      where: { id: template.id },
      data: { deletedAt: new Date() },
    });
  }

  async addWorkout(ctx: AuthContext, templateId: string, dto: CreateTemplateWorkoutDto) {
    const template = await this.findOne(ctx, templateId);
    this.assertCanManage(ctx, template);
    await this.prisma.templateWorkout.create({
      data: {
        templateId: template.id,
        dayOffset: dto.dayOffset,
        type: dto.type,
        distanceTargetKm: dto.distanceTargetKm,
        durationTargetSec: dto.durationTargetSec,
        paceTarget: dto.paceTarget,
        hrZoneTarget: dto.hrZoneTarget,
        rpeTarget: dto.rpeTarget,
        instructions: dto.instructions,
      },
    });
    return this.findOne(ctx, templateId);
  }

  /** Flat :id route - resolves the parent template for scoping, same shape as WorkoutsController's :id routes. */
  private async findWorkoutScopedOrThrow(ctx: AuthContext, id: string) {
    const workout = await this.prisma.templateWorkout.findFirst({
      where: { id },
      include: { template: true },
    });
    if (!workout || workout.template.deletedAt) {
      throw new NotFoundException('Template workout not found');
    }
    if (ctx.role === Role.COACH && workout.template.coachId !== ctx.coachId) {
      throw new NotFoundException('Template workout not found');
    }
    if (ctx.role !== Role.COACH && ctx.role !== Role.PLATFORM_ADMIN) {
      throw new NotFoundException('Template workout not found');
    }
    return workout;
  }

  async updateWorkout(ctx: AuthContext, id: string, dto: UpdateTemplateWorkoutDto) {
    const workout = await this.findWorkoutScopedOrThrow(ctx, id);
    return this.prisma.templateWorkout.update({
      where: { id: workout.id },
      data: {
        dayOffset: dto.dayOffset,
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

  async removeWorkout(ctx: AuthContext, id: string): Promise<void> {
    const workout = await this.findWorkoutScopedOrThrow(ctx, id);
    await this.prisma.templateWorkout.delete({ where: { id: workout.id } });
  }

  /**
   * Creates a real TrainingPlan (+ Workouts) from this template. Applying is
   * fully determined by each TemplateWorkout's dayOffset and the chosen
   * startDate - an endDate, if given, is not validated against the computed
   * workout dates (a structurally valid template shouldn't be rejected over
   * an incidentally-short endDate; the coach can adjust it afterwards).
   */
  async apply(ctx: AuthContext, templateId: string, dto: ApplyTemplateDto) {
    const template = await this.findOne(ctx, templateId);

    if (!dto.athleteId === !dto.groupId) {
      throw new BadRequestException('Specify exactly one of athleteId or groupId');
    }

    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('endDate must not be before startDate');
    }

    let athleteId: string | undefined;
    let groupId: string | undefined;
    let organisationId: string;
    // The plan's owning coach is always the athlete's/group's own coach, not
    // the template's - the only thing that made these coincide before was
    // that a personal template could only ever be applied by its own owner.
    // A shared-library template has no owning coach at all (coachId null),
    // so this can no longer be assumed.
    let coachId: string;

    if (dto.athleteId) {
      const athlete = await this.prisma.athlete.findFirst({
        where: { id: dto.athleteId, deletedAt: null },
      });
      if (!athlete || !athlete.coachId || !athlete.organisationId) {
        throw new NotFoundException('Athlete not found');
      }
      if (ctx.role === Role.COACH && athlete.coachId !== ctx.coachId) {
        throw new NotFoundException('Athlete not found');
      }
      athleteId = athlete.id;
      organisationId = athlete.organisationId;
      coachId = athlete.coachId;
    } else {
      const group = await this.prisma.group.findFirst({
        where: { id: dto.groupId, deletedAt: null },
      });
      if (!group) {
        throw new NotFoundException('Group not found');
      }
      if (ctx.role === Role.COACH && group.coachId !== ctx.coachId) {
        throw new NotFoundException('Group not found');
      }
      groupId = group.id;
      organisationId = group.organisationId;
      coachId = group.coachId;
    }

    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.trainingPlan.create({
        data: {
          organisationId,
          coachId,
          athleteId,
          groupId,
          name: dto.name ?? template.name,
          startDate,
          endDate,
          goal: template.goal,
          phase: template.phase,
          sourceTemplateId: template.id,
        },
      });

      if (template.workouts.length > 0) {
        await tx.workout.createMany({
          data: template.workouts.map((tw) => ({
            trainingPlanId: plan.id,
            scheduledDate: addDays(startDate, tw.dayOffset),
            type: tw.type,
            distanceTargetKm: tw.distanceTargetKm ?? undefined,
            durationTargetSec: tw.durationTargetSec,
            paceTarget: tw.paceTarget,
            hrZoneTarget: tw.hrZoneTarget,
            rpeTarget: tw.rpeTarget,
            instructions: tw.instructions,
          })),
        });
      }

      return tx.trainingPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { workouts: true },
      });
    });
  }
}
