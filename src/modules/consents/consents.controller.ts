import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConsentsService } from './consents.service';
import { GrantConsentDto } from './dto/grant-consent.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';

@ApiTags('consents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class ConsentsController {
  constructor(private readonly consentsService: ConsentsService) {}

  @Post('athletes/:athleteId/consents')
  @Roles(Role.ATHLETE)
  @ScopeResource('athlete', 'athleteId')
  @Audit('CONSENT_GRANTED')
  grant(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Body() dto: GrantConsentDto,
  ) {
    return this.consentsService.grant(ctx, athleteId, dto);
  }

  @Get('athletes/:athleteId/consents')
  @ScopeResource('athlete', 'athleteId')
  findAllForAthlete(
    @CurrentUser() ctx: AuthContext,
    @Param('athleteId') athleteId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.consentsService.findAllForAthlete(ctx, athleteId, pagination);
  }

  @Patch('consents/:id/withdraw')
  @Roles(Role.ATHLETE, Role.PLATFORM_ADMIN)
  @Audit('CONSENT_WITHDRAWN')
  withdraw(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.consentsService.withdraw(ctx, id);
  }
}
