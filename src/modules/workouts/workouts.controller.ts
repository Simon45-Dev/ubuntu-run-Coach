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
import { WorkoutsService } from './workouts.service';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { UpdateWorkoutDto } from './dto/update-workout.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Audit } from '../../common/decorators/audit.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';

@ApiTags('workouts')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller()
export class WorkoutsController {
  constructor(private readonly workoutsService: WorkoutsService) {}

  @Post('training-plans/:trainingPlanId/workouts')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  create(
    @CurrentUser() ctx: AuthContext,
    @Param('trainingPlanId') trainingPlanId: string,
    @Body() dto: CreateWorkoutDto,
  ) {
    return this.workoutsService.create(ctx, trainingPlanId, dto);
  }

  @Post('training-plans/:trainingPlanId/workouts/import')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 1_000_000 } }))
  importCsv(
    @CurrentUser() ctx: AuthContext,
    @Param('trainingPlanId') trainingPlanId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.workoutsService.importCsv(ctx, trainingPlanId, file.buffer);
  }

  @Get('training-plans/:trainingPlanId/workouts')
  findAllForPlan(@CurrentUser() ctx: AuthContext, @Param('trainingPlanId') trainingPlanId: string) {
    return this.workoutsService.findAllForPlan(ctx, trainingPlanId);
  }

  @Get('workouts/:id')
  findOne(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.workoutsService.findOne(ctx, id);
  }

  @Patch('workouts/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  update(@CurrentUser() ctx: AuthContext, @Param('id') id: string, @Body() dto: UpdateWorkoutDto) {
    return this.workoutsService.update(ctx, id, dto);
  }

  @Delete('workouts/:id')
  @Roles(Role.COACH, Role.PLATFORM_ADMIN)
  @Audit('WORKOUT_DELETED')
  remove(@CurrentUser() ctx: AuthContext, @Param('id') id: string) {
    return this.workoutsService.softDelete(ctx, id);
  }
}
