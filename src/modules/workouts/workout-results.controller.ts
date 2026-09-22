import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WorkoutResultsService } from './workout-results.service';
import { SubmitWorkoutResultDto } from './dto/submit-workout-result.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';

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
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.workoutResultsService.findOne(ctx, id);
  }
}
