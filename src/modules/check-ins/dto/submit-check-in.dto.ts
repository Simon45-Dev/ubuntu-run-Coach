import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class SubmitCheckInDto {
  @ApiProperty()
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  sleepQuality?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  energy?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  soreness?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  stress?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 10 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  motivation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pain?: string;
}
