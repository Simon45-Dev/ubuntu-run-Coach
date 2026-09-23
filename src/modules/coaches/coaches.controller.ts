import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CoachesService } from './coaches.service';
import { InviteCoachDto } from './dto/invite-coach.dto';
import { UpdateCoachDto } from './dto/update-coach.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('coaches')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class CoachesController {
  constructor(private readonly coachesService: CoachesService) {}

  /**
   * COACH or PLATFORM_ADMIN. The @ScopeResource('organisation', ...) guard
   * already restricts a COACH caller's :organisationId to their own JWT
   * claim (org-scope.guard.ts's 'organisation' case), so a coach can only
   * ever invite into their own organisation - no extra check needed here.
   */
  @Post('organisations/:organisationId/coaches')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('organisation', 'organisationId')
  invite(@Param('organisationId') organisationId: string, @Body() dto: InviteCoachDto) {
    return this.coachesService.invite(organisationId, dto);
  }

  /**
   * COACH or PLATFORM_ADMIN. No :organisationId param on this route to
   * scope against, so the org-membership check happens in the service
   * layer instead (CoachesService.resendInvite), matching how
   * CoachesService.findOne/update already do it.
   */
  @Post('coaches/:id/resend-invite')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  resendInvite(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.coachesService.resendInvite(ctx, id);
  }

  @Get('organisations/:organisationId/coaches')
  @ScopeResource('organisation', 'organisationId')
  findAllForOrganisation(
    @CurrentUser() ctx: AuthContext,
    @Param('organisationId') organisationId: string,
  ) {
    return this.coachesService.findAllForOrganisation(ctx, organisationId);
  }

  @Get('coaches/:id')
  @ScopeResource('coach')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.coachesService.findOne(ctx, id);
  }

  @Patch('coaches/:id')
  @ScopeResource('coach')
  update(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateCoachDto) {
    return this.coachesService.update(ctx, id, dto);
  }

  @Delete('coaches/:id')
  @Roles(Role.PLATFORM_ADMIN)
  @Audit('COACH_DELETED')
  remove(@Param('id') id: string) {
    return this.coachesService.softDelete(id);
  }
}
