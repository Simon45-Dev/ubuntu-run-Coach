import { ApiPropertyOptional } from '@nestjs/swagger';
import { RaceGoalStatus } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdateRaceGoalDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  raceName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  raceDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  distance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  targetTimeSeconds?: number;

  @ApiPropertyOptional({ enum: RaceGoalStatus })
  @IsOptional()
  @IsEnum(RaceGoalStatus)
  status?: RaceGoalStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  actualTimeSeconds?: number;
}
