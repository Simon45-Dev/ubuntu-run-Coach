import { ApiProperty } from '@nestjs/swagger';
import { ConsentType } from '@prisma/client';
import { IsEnum, IsString, MinLength } from 'class-validator';

export class GrantConsentDto {
  @ApiProperty({ enum: ConsentType })
  @IsEnum(ConsentType)
  consentType: ConsentType;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  policyVersion: string;
}
