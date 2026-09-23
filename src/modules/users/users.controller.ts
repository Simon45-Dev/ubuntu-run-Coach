import { Body, Controller, Delete, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
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
