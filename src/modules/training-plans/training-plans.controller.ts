import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TrainingPlansService } from './training-plans.service';
import { CreateTrainingPlanDto } from './dto/create-training-plan.dto';
import { UpdateTrainingPlanDto } from './dto/update-training-plan.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('training-plans')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class TrainingPlansController {
  constructor(private readonly trainingPlansService: TrainingPlansService) {}

  @Post('athletes/:athleteId/training-plans')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('athlete', 'athleteId')
  create(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Body() dto: CreateTrainingPlanDto,
  ) {
    return this.trainingPlansService.create(ctx, athleteId, dto);
  }

  @Get('athletes/:athleteId/training-plans')
  @ScopeResource('athlete', 'athleteId')
  findAllForAthlete(@CurrentUser() ctx: AuthContext, @Param('athleteId') athleteId: string) {
    return this.trainingPlansService.findAllForAthlete(ctx, athleteId);
  }

  @Post('groups/:groupId/training-plans')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  createForGroup(
    @CurrentUser() ctx: AuthContext,
    @Param('groupId') groupId: string,
    @Body() dto: CreateTrainingPlanDto,
  ) {
    return this.trainingPlansService.createForGroup(ctx, groupId, dto);
  }

  @Get('groups/:groupId/training-plans')
  findAllForGroup(@CurrentUser() ctx: AuthContext, @Param('groupId') groupId: string) {
    return this.trainingPlansService.findAllForGroup(ctx, groupId);
  }

  @Get('training-plans/:id')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.trainingPlansService.findOne(ctx, id);
  }

  @Patch('training-plans/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  update(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateTrainingPlanDto,
  ) {
    return this.trainingPlansService.update(ctx, id, dto);
  }

  @Delete('training-plans/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @Audit('TRAINING_PLAN_DELETED')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.trainingPlansService.softDelete(ctx, id);
  }
}
