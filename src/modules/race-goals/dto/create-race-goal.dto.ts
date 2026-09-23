import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsPositive, IsString, MinLength } from 'class-validator';

export class CreateRaceGoalDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  raceName: string;

  @ApiProperty()
  @IsDateString()
  raceDate: string;

  @ApiProperty({ description: 'e.g. "5K", "Half Marathon", "Marathon"' })
  @IsString()
  @MinLength(1)
  distance: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  targetTimeSeconds?: number;
}
