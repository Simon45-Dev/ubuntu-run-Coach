import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AthletesService } from './athletes.service';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('athletes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class AthletesController {
  constructor(private readonly athletesService: AthletesService) {}

  @Post('coaches/:coachId/athletes')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('coach', 'coachId')
  create(
    @CurrentUser() ctx: AuthContext,
    @Param('coachId') coachId: string,
    @Body() dto: CreateAthleteDto,
  ) {
    return this.athletesService.create(ctx, coachId, dto);
  }

  @Get('coaches/:coachId/athletes')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('coach', 'coachId')
  findAllForCoach(@CurrentUser() ctx: AuthContext, @Param('coachId') coachId: string) {
    return this.athletesService.findAllForCoach(ctx, coachId);
  }

  @Get('athletes/:id')
  @ScopeResource('athlete')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.athletesService.findOne(ctx, id);
  }

  @Patch('athletes/:id')
  @ScopeResource('athlete')
  update(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateAthleteDto) {
    return this.athletesService.update(ctx, id, dto);
  }

  @Delete('athletes/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('athlete')
  @Audit('ATHLETE_DELETED')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.athletesService.softDelete(ctx, id);
  }
}
