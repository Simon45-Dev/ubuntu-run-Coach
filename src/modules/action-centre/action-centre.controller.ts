import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ActionCentreService } from './action-centre.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('action-centre')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class ActionCentreController {
  constructor(private readonly actionCentreService: ActionCentreService) {}

  @Get('coaches/:coachId/action-centre')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('coach', 'coachId')
  getAlerts(@CurrentUser() ctx: AuthContext, @Param('coachId') coachId: string) {
    return this.actionCentreService.getAlertsForCoach(ctx, coachId);
  }
}
