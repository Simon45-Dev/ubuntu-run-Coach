import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PersonalBestsService } from './personal-bests.service';
import { CreatePersonalBestDto } from './dto/create-personal-best.dto';
import { UpdatePersonalBestDto } from './dto/update-personal-best.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';

@ApiTags('personal-bests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class PersonalBestsController {
  constructor(private readonly personalBestsService: PersonalBestsService) {}

  @Post('athletes/:athleteId/personal-bests')
  @ScopeResource('athlete', 'athleteId')
  create(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Body() dto: CreatePersonalBestDto,
  ) {
    return this.personalBestsService.create(ctx, athleteId, dto);
  }

  @Get('athletes/:athleteId/personal-bests')
  @ScopeResource('athlete', 'athleteId')
  findAllForAthlete(@CurrentUser() ctx: AuthContext, @Param('athleteId') athleteId: string) {
    return this.personalBestsService.findAllForAthlete(ctx, athleteId);
  }

  @Patch('personal-bests/:id')
  update(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdatePersonalBestDto) {
    return this.personalBestsService.update(ctx, id, dto);
  }

  @Delete('personal-bests/:id')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.personalBestsService.softDelete(ctx, id);
  }
}
