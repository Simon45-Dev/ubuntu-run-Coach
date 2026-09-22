import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CheckInsService } from './check-ins.service';
import { SubmitCheckInDto } from './dto/submit-check-in.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { HealthDataScopeGuard } from '../../common/guards/health-data-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('check-ins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, HealthDataScopeGuard)
@Controller()
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Put('athletes/:athleteId/check-ins')
  @Roles(Role.ATHLETE)
  @ScopeResource('athlete', 'athleteId')
  submit(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Body() dto: SubmitCheckInDto,
  ) {
    return this.checkInsService.submit(ctx, athleteId, dto);
  }

  @Get('athletes/:athleteId/check-ins')
  @ScopeResource('athlete', 'athleteId')
  findAllForAthlete(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.checkInsService.findAllForAthlete(ctx, athleteId, pagination);
  }
}
