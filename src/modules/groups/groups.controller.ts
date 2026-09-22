import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { GroupsService } from './groups.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Post('coaches/:coachId/groups')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('coach', 'coachId')
  create(
    @CurrentUser() ctx: AuthContext,
    @Param('coachId') coachId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.groupsService.create(ctx, coachId, dto);
  }

  @Get('coaches/:coachId/groups')
  @ScopeResource('coach', 'coachId')
  findAllForCoach(@CurrentUser() ctx: AuthContext, @Param('coachId') coachId: string) {
    return this.groupsService.findAllForCoach(ctx, coachId);
  }

  @Get('groups/:id')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.groupsService.findOne(ctx, id);
  }

  @Patch('groups/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  update(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupsService.update(ctx, id, dto);
  }

  @Delete('groups/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @Audit('GROUP_DELETED')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.groupsService.softDelete(ctx, id);
  }

  @Post('groups/:id/members')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  addMember(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: AddGroupMemberDto,
  ) {
    return this.groupsService.addMember(ctx, id, dto);
  }

  @Delete('groups/:id/members/:athleteId')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  removeMember(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Param('athleteId') athleteId: string,
  ) {
    return this.groupsService.removeMember(ctx, id, athleteId);
  }
}
