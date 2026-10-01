import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString, MinLength } from 'class-validator';

/** Always created DRAFT - see ClubEventsService.create. Publishing is a separate update(). */
export class CreateClubEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty()
  @IsDateString()
  eventDate: string;

  @ApiPropertyOptional({ description: 'Free text, e.g. "10km", "Half Marathon"' })
  @IsOptional()
  @IsString()
  distance?: string;
}
