import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class CreatePushSubscriptionDto {
  @ApiProperty()
  @IsUrl()
  endpoint: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  p256dh: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  auth: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}
