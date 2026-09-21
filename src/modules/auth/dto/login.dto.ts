import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password: string;

  @ApiProperty({ required: false, description: '6-digit TOTP code, required once MFA is enabled' })
  @IsOptional()
  @IsString()
  @MinLength(6)
  mfaCode?: string;
}
