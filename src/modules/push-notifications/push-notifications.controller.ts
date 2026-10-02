import { Body, Controller, Delete, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PushSubscriptionsService } from './push-notifications.service';
import { CreatePushSubscriptionDto } from './dto/create-push-subscription.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { OrgScopeGuard } from '../../common/guards/org-scope.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthContext } from '../../common/auth-context';

/**
 * Self-only, like NotificationsController - a push subscription is tied to
 * one device/browser for one user, with no org-scoping concept.
 */
@ApiTags('push-subscriptions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, OrgScopeGuard)
@Controller('push-subscriptions')
export class PushSubscriptionsController {
  constructor(private readonly pushSubscriptionsService: PushSubscriptionsService) {}

  @Post()
  subscribe(@CurrentUser() ctx: AuthContext, @Body() dto: CreatePushSubscriptionDto) {
    return this.pushSubscriptionsService.subscribe(ctx.userId, dto);
  }

  /**
   * Takes `endpoint` as a query param, not a :endpoint route param - it's a
   * full URL containing slashes, which query-string encoding (via
   * URLSearchParams/axios) handles more reliably than an encoded path segment.
   */
  @Delete()
  async unsubscribe(@CurrentUser() ctx: AuthContext, @Query('endpoint') endpoint: string) {
    await this.pushSubscriptionsService.unsubscribe(ctx.userId, endpoint);
  }
}
