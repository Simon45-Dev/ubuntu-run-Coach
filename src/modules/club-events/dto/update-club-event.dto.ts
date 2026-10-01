import { ApiPropertyOptional } from '@nestjs/swagger';
import { ClubEventStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

/** status is how a coach/admin publishes an event - see ClubEventsService.update. */
export class UpdateClubEventDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  eventDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  distance?: string;

  @ApiPropertyOptional({ enum: ClubEventStatus })
  @IsOptional()
  @IsEnum(ClubEventStatus)
  status?: ClubEventStatus;
}
