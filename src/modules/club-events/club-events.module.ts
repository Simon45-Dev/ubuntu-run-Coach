import { Module } from '@nestjs/common';
import { ClubEventsController } from './club-events.controller';
import { ClubEventsService } from './club-events.service';

@Module({
  controllers: [ClubEventsController],
  providers: [ClubEventsService],
})
export class ClubEventsModule {}
