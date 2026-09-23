import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { OrganisationType } from '@prisma/client';

export class CreateOrganisationDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional({ enum: OrganisationType, default: OrganisationType.SOLO })
  @IsOptional()
  @IsEnum(OrganisationType)
  type?: OrganisationType;
}
