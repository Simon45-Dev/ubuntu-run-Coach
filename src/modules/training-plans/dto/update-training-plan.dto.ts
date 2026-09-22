import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingPlanPhase, TrainingPlanStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTrainingPlanDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional({ enum: TrainingPlanPhase })
  @IsOptional()
  @IsEnum(TrainingPlanPhase)
  phase?: TrainingPlanPhase;

  @ApiPropertyOptional({ enum: TrainingPlanStatus })
  @IsOptional()
  @IsEnum(TrainingPlanStatus)
  status?: TrainingPlanStatus;
}
