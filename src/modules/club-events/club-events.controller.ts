import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { ClubEventsService } from './club-events.service';
import { CreateClubEventDto } from './dto/create-club-event.dto';
import { UpdateClubEventDto } from './dto/update-club-event.dto';
import { CreateClubEventResultDto } from './dto/create-club-event-result.dto';
import { UpdateClubEventResultDto } from './dto/update-club-event-result.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('club-events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class ClubEventsController {
  constructor(private readonly clubEventsService: ClubEventsService) {}

  @Post('organisations/:organisationId/club-events')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN, Role.CLUB_ADMIN)
  @ScopeResource('organisation', 'organisationId')
  create(@Param('organisationId') organisationId: string, @Body() dto: CreateClubEventDto) {
    return this.clubEventsService.create(organisationId, dto);
  }

  @Get('organisations/:organisationId/club-events')
  @ScopeResource('organisation', 'organisationId')
  findAllForOrg(@CurrentUser() ctx: AuthContext, @Param('organisationId') organisationId: string) {
    return this.clubEventsService.findAllForOrg(ctx, organisationId);
  }

  @Get('club-events/:id')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.clubEventsService.findOne(ctx, id);
  }

  @Patch('club-events/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN, Role.CLUB_ADMIN)
  update(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateClubEventDto,
  ) {
    return this.clubEventsService.update(ctx, id, dto);
  }

  @Delete('club-events/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN, Role.CLUB_ADMIN)
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.clubEventsService.softDelete(ctx, id);
  }

  @Post('club-events/:id/results')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN, Role.CLUB_ADMIN)
  addResult(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: CreateClubEventResultDto,
  ) {
    return this.clubEventsService.addResult(ctx, id, dto);
  }

  @Post('club-events/:id/results/import')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN, Role.CLUB_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1_000_000 } }))
  importResults(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.clubEventsService.importResultsCsv(ctx, id, file.buffer);
  }

  @Patch('club-event-results/:resultId')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN, Role.CLUB_ADMIN)
  updateResult(
    @CurrentUser() ctx: AuthContext,
    @Param('resultId') resultId: string,
    @Body() dto: UpdateClubEventResultDto,
  ) {
    return this.clubEventsService.updateResult(ctx, resultId, dto);
  }

  @Delete('club-event-results/:resultId')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN, Role.CLUB_ADMIN)
  deleteResult(@CurrentUser() ctx: AuthContext, @Param('resultId') resultId: string) {
    return this.clubEventsService.deleteResult(ctx, resultId);
  }
}
