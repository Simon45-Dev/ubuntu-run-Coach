import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ClubEventResultStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsPositive, IsUUID } from 'class-validator';

export class CreateClubEventResultDto {
  @ApiProperty()
  @IsUUID()
  clubMemberId: string;

  @ApiPropertyOptional({ description: 'Omit for a DNF/DNS result' })
  @IsOptional()
  @IsInt()
  @IsPositive()
  finishTimeSeconds?: number;

  @ApiPropertyOptional({ enum: ClubEventResultStatus, description: 'Defaults to FINISHED' })
  @IsOptional()
  @IsEnum(ClubEventResultStatus)
  status?: ClubEventResultStatus;
}
