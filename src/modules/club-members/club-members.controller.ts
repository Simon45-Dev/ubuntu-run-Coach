import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ClubMembersService } from './club-members.service';
import { CreateClubMemberDto } from './dto/create-club-member.dto';
import { UpdateClubMemberDto } from './dto/update-club-member.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('club-members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class ClubMembersController {
  constructor(private readonly clubMembersService: ClubMembersService) {}

  @Post('organisations/:organisationId/club-members')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('organisation', 'organisationId')
  create(@Param('organisationId') organisationId: string, @Body() dto: CreateClubMemberDto) {
    return this.clubMembersService.create(organisationId, dto);
  }

  @Get('organisations/:organisationId/club-members')
  @ScopeResource('organisation', 'organisationId')
  findAllForOrg(@CurrentUser() ctx: AuthContext, @Param('organisationId') organisationId: string) {
    return this.clubMembersService.findAllForOrg(ctx, organisationId);
  }

  @Get('club-members/:id')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.clubMembersService.findOne(ctx, id);
  }

  @Patch('club-members/:id')
  update(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateClubMemberDto,
  ) {
    return this.clubMembersService.update(ctx, id, dto);
  }

  @Delete('club-members/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.clubMembersService.softDelete(ctx, id);
  }

  @Post('club-members/:id/invite')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  invite(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.clubMembersService.invite(ctx, id);
  }

  @Post('club-members/:id/resend-invite')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  resendInvite(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.clubMembersService.resendInvite(ctx, id);
  }
}
