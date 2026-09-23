import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RaceGoalsService } from './race-goals.service';
import { CreateRaceGoalDto } from './dto/create-race-goal.dto';
import { UpdateRaceGoalDto } from './dto/update-race-goal.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';

@ApiTags('race-goals')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class RaceGoalsController {
  constructor(private readonly raceGoalsService: RaceGoalsService) {}

  @Post('athletes/:athleteId/race-goals')
  @ScopeResource('athlete', 'athleteId')
  create(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Body() dto: CreateRaceGoalDto,
  ) {
    return this.raceGoalsService.create(ctx, athleteId, dto);
  }

  @Get('athletes/:athleteId/race-goals')
  @ScopeResource('athlete', 'athleteId')
  findAllForAthlete(@CurrentUser() ctx: AuthContext, @Param('athleteId') athleteId: string) {
    return this.raceGoalsService.findAllForAthlete(ctx, athleteId);
  }

  @Patch('race-goals/:id')
  update(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateRaceGoalDto) {
    return this.raceGoalsService.update(ctx, id, dto);
  }

  @Delete('race-goals/:id')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.raceGoalsService.softDelete(ctx, id);
  }
}
