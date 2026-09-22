import { ApiPropertyOptional } from '@nestjs/swagger';
import { TrainingPlanPhase } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional({ enum: TrainingPlanPhase })
  @IsOptional()
  @IsEnum(TrainingPlanPhase)
  phase?: TrainingPlanPhase;
}
