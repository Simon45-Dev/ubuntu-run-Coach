import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UnsupportedMediaTypeException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { OrganisationsService } from './organisations.service';
import { CreateOrganisationDto } from './dto/create-organisation.dto';
import { UpdateOrganisationDto } from './dto/update-organisation.dto';
import { SuspendOrganisationDto } from './dto/suspend-organisation.dto';
import { EXT_BY_MIME } from '../../common/storage/avatar-storage.service';
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

@ApiTags('organisations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('organisations')
export class OrganisationsController {
  constructor(private readonly organisationsService: OrganisationsService) {}

  @Post()
  @Roles(Role.PLATFORM_ADMIN)
  create(@Body() dto: CreateOrganisationDto) {
    return this.organisationsService.create(dto);
  }

  @Get()
  @Roles(Role.PLATFORM_ADMIN)
  findAll(@Query() pagination: PaginationQueryDto) {
    return this.organisationsService.findAll(pagination);
  }

  @Get(':id')
  @ScopeResource('organisation')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.organisationsService.findOne(ctx, id);
  }

  @Patch(':id')
  @ScopeResource('organisation')
  update(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @Body() dto: UpdateOrganisationDto,
  ) {
    return this.organisationsService.update(ctx, id, dto);
  }

  @Post(':id/logo')
  @ScopeResource('organisation')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 5_000_000 },
      fileFilter: (_req, file, cb) => {
        if (EXT_BY_MIME[file.mimetype]) {
          cb(null, true);
          return;
        }
        cb(new UnsupportedMediaTypeException('Only JPEG, PNG, or WebP images are allowed'), false);
      },
    }),
  )
  uploadLogo(
    @CurrentUser() ctx: AuthContext,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.organisationsService.uploadLogo(ctx, id, file.buffer, file.mimetype);
  }

  @Delete(':id/logo')
  @ScopeResource('organisation')
  deleteLogo(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.organisationsService.deleteLogo(ctx, id);
  }

  @Post(':id/suspend')
  @Roles(Role.PLATFORM_ADMIN)
  @Audit('ORGANISATION_SUSPENDED')
  suspend(@Param('id') id: string, @Body() dto: SuspendOrganisationDto) {
    return this.organisationsService.suspend(id, dto);
  }

  @Post(':id/reactivate')
  @Roles(Role.PLATFORM_ADMIN)
  @Audit('ORGANISATION_REACTIVATED')
  reactivate(@Param('id') id: string) {
    return this.organisationsService.reactivate(id);
  }
}
