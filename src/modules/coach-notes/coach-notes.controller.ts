import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CoachNotesService } from './coach-notes.service';
import { CreateCoachNoteDto } from './dto/create-coach-note.dto';
import { UpdateCoachNoteDto } from './dto/update-coach-note.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

/** Private coach content, never athlete-facing - every route is @Roles(COACH, PLATFORM_ADMIN). */
@ApiTags('coach-notes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Roles(Role.COACH, Role.PLATFORM_ADMIN)
@Controller()
export class CoachNotesController {
  constructor(private readonly coachNotesService: CoachNotesService) {}

  @Post('athletes/:athleteId/notes')
  @ScopeResource('athlete', 'athleteId')
  create(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Body() dto: CreateCoachNoteDto,
  ) {
    return this.coachNotesService.create(ctx, athleteId, dto);
  }

  @Get('athletes/:athleteId/notes')
  @ScopeResource('athlete', 'athleteId')
  findAllForAthlete(@CurrentUser() ctx: AuthContext, @Param('athleteId') athleteId: string) {
    return this.coachNotesService.findAllForAthlete(ctx, athleteId);
  }

  @Patch('notes/:id')
  update(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateCoachNoteDto,
  ) {
    return this.coachNotesService.update(ctx, id, dto);
  }

  @Delete('notes/:id')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.coachNotesService.softDelete(ctx, id);
  }
}
