import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';

@ApiTags('analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('athletes/:athleteId/analytics')
  @ScopeResource('athlete', 'athleteId')
  getSummary(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Query() query: AnalyticsQueryDto,
  ) {
    return this.analyticsService.getSummary(ctx, athleteId, query);
  }
}
