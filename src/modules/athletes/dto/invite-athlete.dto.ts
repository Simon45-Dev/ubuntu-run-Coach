import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class InviteAthleteDto {
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
  goal?: string;

  @ApiPropertyOptional({ description: 'Free-form availability structure, e.g. days/times' })
  @IsOptional()
  @IsObject()
  availability?: Record<string, unknown>;
}
