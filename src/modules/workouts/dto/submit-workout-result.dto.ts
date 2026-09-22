import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class SubmitWorkoutResultDto {
  @ApiPropertyOptional({
    description:
      "Required when a coach/admin submits on behalf of an athlete for a group-assigned workout - there's no other way to know which member the result belongs to. Ignored for an athlete submitting their own result, and for individual-plan workouts (the plan's one athlete is used).",
  })
  @IsOptional()
  @IsUUID()
  athleteId?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedAt?: string;
}
