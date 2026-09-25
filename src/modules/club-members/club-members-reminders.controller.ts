import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ClubMembersService } from './club-members.service';

/**
 * Deliberately outside the normal JwtAuthGuard chain - meant for an external
 * cron pinger (cron-job.org, a scheduled GitHub Actions workflow, etc), not
 * a logged-in user. A 15-minute-lived user JWT isn't practical for a daily
 * external trigger, so this uses a long-lived shared secret instead. See
 * docs/deployment.md's "Expiry reminders" section for why this exists at
 * all - Render's free tier can't reliably fire an in-process cron job.
 */
@ApiExcludeController()
@Controller('club-members')
export class ClubMembersRemindersController {
  constructor(
    private readonly clubMembersService: ClubMembersService,
    private readonly configService: ConfigService,
  ) {}

  @Post('send-expiry-reminders')
  async sendExpiryReminders(@Headers('x-cron-secret') providedSecret?: string) {
    const expectedSecret = this.configService.get<string>('cronSecret');
    if (!expectedSecret || providedSecret !== expectedSecret) {
      throw new UnauthorizedException();
    }
    return this.clubMembersService.sendExpiryReminders();
  }
}
