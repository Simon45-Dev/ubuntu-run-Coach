import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateTemplateWorkoutDto {
  @ApiProperty({ description: 'Days from the plan start date this workout falls on (0-based)' })
  @IsInt()
  @Min(0)
  dayOffset: number;

  @ApiProperty({ enum: WorkoutType })
  @IsEnum(WorkoutType)
  type: WorkoutType;

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
