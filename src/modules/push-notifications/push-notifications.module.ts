import { Module } from '@nestjs/common';
import { PushSubscriptionsController } from './push-notifications.controller';
import { PushSubscriptionsService } from './push-notifications.service';

/**
 * Knows nothing about Notification/type/payload - it only ever sends a
 * title/body/url to a userId's devices. Do NOT import NotificationsModule
 * here; NotificationsModule imports this one, not the reverse (see
 * NotificationsService.create).
 */
@Module({
  controllers: [PushSubscriptionsController],
  providers: [PushSubscriptionsService],
  exports: [PushSubscriptionsService],
})
export class PushNotificationsModule {}
