import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkoutResultsService } from './workout-results.service';
import { SubmitWorkoutResultDto } from './dto/submit-workout-result.dto';
import { CreateStandaloneResultDto } from './dto/create-standalone-result.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('workout-results')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class WorkoutResultsController {
  constructor(private readonly workoutResultsService: WorkoutResultsService) {}

  @Put('workouts/:id/result')
  submit(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: SubmitWorkoutResultDto,
  ) {
    return this.workoutResultsService.submit(ctx, id, dto);
  }

  @Get('workouts/:id/result')
  findOne(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Query('athleteId') athleteId?: string,
  ) {
    return this.workoutResultsService.findOne(ctx, id, athleteId);
  }

  @Get('workouts/:id/results')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  findAllForWorkout(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.workoutResultsService.findAllForWorkout(ctx, id);
  }

  @Post('athletes/:athleteId/workout-results')
  @ScopeResource('athlete', 'athleteId')
  createStandalone(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Body() dto: CreateStandaloneResultDto,
  ) {
    return this.workoutResultsService.createStandalone(ctx, athleteId, dto);
  }

  @Get('athletes/:athleteId/workout-results')
  @ScopeResource('athlete', 'athleteId')
  findAllForAthlete(@CurrentUser() ctx: AuthContext, @Param('athleteId') athleteId: string) {
    return this.workoutResultsService.findAllForAthlete(ctx, athleteId);
  }

  @Delete('workout-results/:id')
  removeStandalone(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.workoutResultsService.removeStandalone(ctx, id);
  }
}
