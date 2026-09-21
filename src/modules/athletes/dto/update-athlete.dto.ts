import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Field-level authorisation, not DTO-level: AthletesService restricts which
 * of these an ATHLETE caller may set on themselves (goal, availability,
 * trainingBackground) versus which only a COACH/PLATFORM_ADMIN may set
 * (coachId reassignment) - see AthletesService.update.
 */
export class UpdateAthleteDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  goal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  availability?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  trainingBackground?: string;

  @ApiPropertyOptional({ description: 'Coach-only: reassign this athlete to a different coach' })
  @IsOptional()
  @IsUUID()
  coachId?: string;
}
