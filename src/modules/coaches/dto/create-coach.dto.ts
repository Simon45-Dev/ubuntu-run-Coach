import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, Min, MinLength } from 'class-validator';

/**
 * Creates a User(role=COACH) + Coach in an existing organisation. Used for
 * PLATFORM_ADMIN-driven coach creation now, and by the (future) org-owner
 * "invite a second coach" flow the multi-coach schema shape already supports.
 */
export class CreateCoachDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  password: string;

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
