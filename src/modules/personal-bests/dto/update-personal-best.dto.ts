import { ApiPropertyOptional } from '@nestjs/swagger';
import { PbSource } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MinLength,
} from 'class-validator';

export class UpdatePersonalBestDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  distance?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  timeSeconds?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  achievedDate?: string;

  @ApiPropertyOptional({ enum: PbSource })
  @IsOptional()
  @IsEnum(PbSource)
  source?: PbSource;
}
