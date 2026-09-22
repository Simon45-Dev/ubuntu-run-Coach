import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, IsUUID } from 'class-validator';

export class ApplyTemplateDto {
  @ApiPropertyOptional({ description: 'Exactly one of athleteId/groupId must be set' })
  @IsOptional()
  @IsUUID()
  athleteId?: string;

  @ApiPropertyOptional({ description: 'Exactly one of athleteId/groupId must be set' })
  @IsOptional()
  @IsUUID()
  groupId?: string;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ description: 'Defaults to the template name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
