import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { OrganisationType } from '@prisma/client';

export class UpdateOrganisationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ enum: OrganisationType })
  @IsOptional()
  @IsEnum(OrganisationType)
  type?: OrganisationType;
}
