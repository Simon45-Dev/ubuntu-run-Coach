import { Module } from '@nestjs/common';
import { ClubEventsController } from './club-events.controller';
import { ClubEventsService } from './club-events.service';
import { EmailModule } from '../email/email.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [EmailModule, NotificationsModule],
  controllers: [ClubEventsController],
  providers: [ClubEventsService],
})
export class ClubEventsModule {}
