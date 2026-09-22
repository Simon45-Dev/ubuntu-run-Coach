import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddGroupMemberDto {
  @ApiProperty()
  @IsUUID()
  athleteId: string;
}
