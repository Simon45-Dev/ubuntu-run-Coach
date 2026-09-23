import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class ListAuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Exact match, e.g. USER_STATUS_CHANGED' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ description: 'ISO date - entries at or after this instant' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date - entries at or before this instant' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
