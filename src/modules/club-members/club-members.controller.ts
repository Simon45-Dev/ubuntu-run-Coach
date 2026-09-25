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
import { ClubMembersService } from './club-members.service';
import { CreateClubMemberDto } from './dto/create-club-member.dto';
import { UpdateClubMemberDto } from './dto/update-club-member.dto';
import { CreateClubMemberPaymentDto } from './dto/create-club-member-payment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ScopeResource } from '../../common/decorators/scope-resource.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
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

  @Post('organisations/:organisationId/club-members/import')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ScopeResource('organisation', 'organisationId')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1_000_000 } }))
  importCsv(
    @Param('organisationId') organisationId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.clubMembersService.importCsv(organisationId, file.buffer);
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

  @Post('club-members/:id/payments')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @Audit('CLUB_MEMBER_PAYMENT_RECORDED')
  createPayment(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: CreateClubMemberPaymentDto,
  ) {
    return this.clubMembersService.createPayment(ctx, id, dto);
  }

  @Get('club-members/:id/payments')
  listPayments(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.clubMembersService.listPayments(ctx, id);
  }

  @Delete('club-member-payments/:paymentId')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @Audit('CLUB_MEMBER_PAYMENT_DELETED')
  deletePayment(@CurrentUser() ctx: AuthContext, @Param('paymentId') paymentId: string) {
    return this.clubMembersService.deletePayment(ctx, paymentId);
  }
}
