import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../../database/prisma.service';

export interface CreatePushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/**
 * Sends via the Web Push protocol (through the `web-push` package) when
 * VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are configured; otherwise logs the
 * payload instead of sending it - same dev-safe dual-mode convention as
 * EmailService. Callers never need to know which mode is active.
 */
@Injectable()
export class PushSubscriptionsService {
  private readonly logger = new Logger(PushSubscriptionsService.name);
  private readonly vapidConfigured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const publicKey = this.configService.get<string>('push.vapidPublicKey');
    const privateKey = this.configService.get<string>('push.vapidPrivateKey');
    const subject = this.configService.get<string>('push.vapidSubject');
    this.vapidConfigured = Boolean(publicKey && privateKey);
    if (this.vapidConfigured) {
      webpush.setVapidDetails(subject!, publicKey!, privateKey!);
    }
  }

  async subscribe(userId: string, dto: CreatePushSubscriptionInput) {
    return this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      create: { userId, ...dto },
      update: { userId, p256dh: dto.p256dh, auth: dto.auth, userAgent: dto.userAgent },
    });
  }

  /** Scoped by userId so a caller can never remove another user's subscription; idempotent. */
  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  /**
   * Best-effort - never throws. A notification row is the source of truth;
   * push is an enhancement on top of it, so a delivery failure here must
   * never affect the caller (see NotificationsService.create).
   */
  async sendPush(userId: string, payload: PushPayload): Promise<void> {
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId } });
    if (subscriptions.length === 0) {
      return;
    }

    if (!this.vapidConfigured) {
      this.logger.log(
        `[dev push - no VAPID keys configured] userId=${userId} subscriptions=${subscriptions.length} title="${payload.title}"`,
      );
      return;
    }

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
        ),
      ),
    );

    await Promise.all(
      results.map(async (result, index) => {
        if (result.status === 'fulfilled') {
          return;
        }
        const statusCode = (result.reason as { statusCode?: number } | undefined)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await this.prisma.pushSubscription.deleteMany({ where: { id: subscriptions[index].id } });
          return;
        }
        this.logger.warn(
          `Push delivery failed for subscription ${subscriptions[index].id}: ${result.reason}`,
        );
      }),
    );
  }
}
