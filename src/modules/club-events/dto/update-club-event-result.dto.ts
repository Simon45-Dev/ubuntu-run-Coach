import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClubEventResultStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';

export class UpdateClubEventResultDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @IsPositive()
  finishTimeSeconds?: number;

  @ApiPropertyOptional({ enum: ClubEventResultStatus })
  @IsOptional()
  @IsEnum(ClubEventResultStatus)
  status?: ClubEventResultStatus;
}
