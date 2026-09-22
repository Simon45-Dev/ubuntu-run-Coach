import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { CreateTemplateWorkoutDto } from './dto/create-template-workout.dto';
import { UpdateTemplateWorkoutDto } from './dto/update-template-workout.dto';
import { ApplyTemplateDto } from './dto/apply-template.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

/** Coach-only content, never athlete-facing - every route is @Roles(COACH, PLATFORM_ADMIN). */
@ApiTags('templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Roles(Role.COACH, Role.PLATFORM_ADMIN)
@Controller()
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  @Post('coaches/:coachId/templates')
  @ScopeResource('coach', 'coachId')
  create(
    @CurrentUser() ctx: AuthContext,
    @Param('coachId') coachId: string,
    @Body() dto: CreateTemplateDto,
  ) {
    return this.templatesService.create(ctx, coachId, dto);
  }

  @Get('coaches/:coachId/templates')
  @ScopeResource('coach', 'coachId')
  findAllForCoach(@CurrentUser() ctx: AuthContext, @Param('coachId') coachId: string) {
    return this.templatesService.findAllForCoach(ctx, coachId);
  }

  @Get('templates/:id')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.templatesService.findOne(ctx, id);
  }

  @Patch('templates/:id')
  update(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateTemplateDto) {
    return this.templatesService.update(ctx, id, dto);
  }

  @Delete('templates/:id')
  @Audit('TEMPLATE_DELETED')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.templatesService.softDelete(ctx, id);
  }

  @Post('templates/:id/workouts')
  addWorkout(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: CreateTemplateWorkoutDto,
  ) {
    return this.templatesService.addWorkout(ctx, id, dto);
  }

  @Patch('template-workouts/:id')
  updateWorkout(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateWorkoutDto,
  ) {
    return this.templatesService.updateWorkout(ctx, id, dto);
  }

  @Delete('template-workouts/:id')
  removeWorkout(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.templatesService.removeWorkout(ctx, id);
  }

  @Post('templates/:id/apply')
  apply(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: ApplyTemplateDto) {
    return this.templatesService.apply(ctx, id, dto);
  }
}
