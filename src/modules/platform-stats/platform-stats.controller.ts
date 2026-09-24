import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformStatsService } from './platform-stats.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';

@ApiTags('platform-stats')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('platform-stats')
export class PlatformStatsController {
  constructor(private readonly platformStatsService: PlatformStatsService) {}

  @Get()
  @Roles(Role.PLATFORM_ADMIN)
  getStats() {
    return this.platformStatsService.getStats();
  }
}
