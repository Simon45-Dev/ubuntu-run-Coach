import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SuspendOrganisationDto {
  @ApiProperty({
    description: 'Why this organisation is being suspended (non-payment, compliance, etc.)',
  })
  @IsString()
  @MinLength(1)
  reason: string;
}
