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
import { UsersService } from './users.service';
import { EXT_BY_MIME } from '../../common/storage/avatar-storage.service';
import { UpdateMeDto } from './dto/update-me.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  me(@CurrentUser() ctx: AuthContext) {
    return this.usersService.findMe(ctx);
  }

  @Patch('me')
  updateMe(@CurrentUser() ctx: AuthContext, @Body() dto: UpdateMeDto) {
    return this.usersService.updateMe(ctx, dto);
  }

  @Post('me/avatar')
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
  uploadAvatar(@CurrentUser() ctx: AuthContext, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.usersService.uploadAvatar(ctx, file.buffer, file.mimetype);
  }

  @Delete('me/avatar')
  deleteAvatar(@CurrentUser() ctx: AuthContext) {
    return this.usersService.deleteAvatar(ctx);
  }

  @Get()
  @Roles(Role.PLATFORM_ADMIN)
  findAll(@Query() query: ListUsersQueryDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.usersService.findOne(ctx, id);
  }

  @Patch(':id/status')
  @Roles(Role.PLATFORM_ADMIN)
  @Audit('USER_STATUS_CHANGED')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateUserStatusDto) {
    return this.usersService.updateStatus(id, dto.status);
  }

  @Delete(':id')
  @Roles(Role.PLATFORM_ADMIN)
  @Audit('USER_DELETED')
  remove(@Param('id') id: string) {
    return this.usersService.softDelete(id);
  }
}
