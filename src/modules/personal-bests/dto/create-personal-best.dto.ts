import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PbSource } from '@prisma/client';
import { IsDateString, IsEnum, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class CreatePersonalBestDto {
  @ApiProperty({ description: 'e.g. "5K", "10K", "Half Marathon", "Marathon"' })
  @IsString()
  @MinLength(1)
  distance: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  timeSeconds: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  achievedDate?: string;

  @ApiPropertyOptional({ enum: PbSource, default: PbSource.SELF_REPORTED })
  @IsOptional()
  @IsEnum(PbSource)
  source?: PbSource;
}
