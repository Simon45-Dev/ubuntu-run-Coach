import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

/**
 * Invites a coach into an existing organisation - PLATFORM_ADMIN only. No
 * password is set here: the account starts INVITED with a placeholder
 * password and a one-time token the coach uses to activate their own
 * account via POST /auth/accept-invite, mirroring InviteAthleteDto exactly.
 */
export class InviteCoachDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  experienceYears?: number;
}
