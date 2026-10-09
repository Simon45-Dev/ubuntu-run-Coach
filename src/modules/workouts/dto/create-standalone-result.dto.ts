import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';

/**
 * No athleteId/workoutId field here - the route param supplies the athlete,
 * and a standalone result has no workout by definition. Unlike
 * SubmitWorkoutResultDto, completedAt is required: there's no
 * Workout.scheduledDate to fall back on for when the run happened.
 */
export class CreateStandaloneResultDto {
  @ApiProperty()
  @IsDateString()
  completedAt: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @IsPositive()
  actualDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  actualDurationSec?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actualPace?: string;

  @ApiPropertyOptional({ minimum: 30, maximum: 250 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(250)
  avgHr?: number;

  @ApiPropertyOptional({ minimum: 30, maximum: 250 })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(250)
  maxHr?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rpe?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  comments?: string;
}
