import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClubAdminsService } from './club-admins.service';
import { InviteClubAdminDto } from './dto/invite-club-admin.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('club-admins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class ClubAdminsController {
  constructor(private readonly clubAdminsService: ClubAdminsService) {}

  /**
   * COACH or PLATFORM_ADMIN. The @ScopeResource('organisation', ...) guard
   * already restricts a COACH caller's :organisationId to their own JWT
   * claim, so a coach can only ever invite a club admin into their own
   * organisation - no extra check needed here.
   */
  @Post('organisations/:organisationId/club-admins')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('organisation', 'organisationId')
  invite(@Param('organisationId') organisationId: string, @Body() dto: InviteClubAdminDto) {
    return this.clubAdminsService.invite(organisationId, dto);
  }

  @Post('club-admins/:id/resend-invite')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  resendInvite(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.clubAdminsService.resendInvite(ctx, id);
  }

  @Get('organisations/:organisationId/club-admins')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('organisation', 'organisationId')
  findAllForOrganisation(
    @CurrentUser() ctx: AuthContext,
    @Param('organisationId') organisationId: string,
  ) {
    return this.clubAdminsService.findAllForOrganisation(ctx, organisationId);
  }

  /**
   * COACH or PLATFORM_ADMIN - unlike coach deletion (PLATFORM_ADMIN only),
   * the inviting coach can remove their own club admin, since this role is
   * their own delegated administrative appointment, not a peer.
   */
  @Delete('club-admins/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @Audit('CLUB_ADMIN_DELETED')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.clubAdminsService.softDelete(ctx, id);
  }
}
