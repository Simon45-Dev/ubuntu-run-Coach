import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  token: string;

  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  password: string;
}
