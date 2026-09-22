import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingPlanPhase } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTrainingPlanDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

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
}
