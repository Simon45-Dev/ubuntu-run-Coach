import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkoutType } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class UpdateTemplateWorkoutDto {
  @ApiPropertyOptional({
    description: 'Days from the plan start date this workout falls on (0-based)',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  dayOffset?: number;

  @ApiPropertyOptional({ enum: WorkoutType })
  @IsOptional()
  @IsEnum(WorkoutType)
  type?: WorkoutType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  distanceTargetKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  durationTargetSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paceTarget?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  hrZoneTarget?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rpeTarget?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;
}
