import { ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipCategory } from '@prisma/client';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/**
 * Field-level authorisation, not DTO-level: ClubMembersService restricts
 * joinDate/membershipExpiryDate/lastRenewalDate to COACH/PLATFORM_ADMIN
 * callers - a CLUB_MEMBER caller (self-service) is rejected if these are
 * present, same reasoning as UpdateAthleteDto's coachId field.
 */
export class UpdateClubMemberDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  idNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: MembershipCategory })
  @IsOptional()
  @IsEnum(MembershipCategory)
  membershipCategory?: MembershipCategory;

  @ApiPropertyOptional({ description: 'Coach/admin-only' })
  @IsOptional()
  @IsDateString()
  joinDate?: string;

  @ApiPropertyOptional({ description: 'Coach/admin-only' })
  @IsOptional()
  @IsDateString()
  membershipExpiryDate?: string;

  @ApiPropertyOptional({ description: 'Coach/admin-only' })
  @IsOptional()
  @IsDateString()
  lastRenewalDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextOfKinName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextOfKinPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nextOfKinRelationship?: string;
}
