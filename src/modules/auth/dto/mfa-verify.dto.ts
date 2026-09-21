import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class MfaVerifyDto {
  @ApiProperty({ description: '6-digit TOTP code from the authenticator app' })
  @IsString()
  @Length(6, 6)
  code: string;
}
