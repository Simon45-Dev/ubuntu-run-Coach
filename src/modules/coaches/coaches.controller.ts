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

  @Post('organisations/:organisationId/coaches')
  @Roles(Role.PLATFORM_ADMIN)
  @ScopeResource('organisation', 'organisationId')
  invite(@Param('organisationId') organisationId: string, @Body() dto: InviteCoachDto) {
    return this.coachesService.invite(organisationId, dto);
  }

  @Post('coaches/:id/resend-invite')
  @Roles(Role.PLATFORM_ADMIN)
  resendInvite(@Param('id') id: string) {
    return this.coachesService.resendInvite(id);
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
