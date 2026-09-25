import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { generateInviteToken } from '../../common/invite-token';
import { EmailService } from '../email/email.service';
import { InviteClubAdminDto } from './dto/invite-club-admin.dto';

const CLUB_ADMIN_INCLUDE = {
  user: { select: { id: true, email: true, name: true, status: true } },
};

/**
 * Only COACH/PLATFORM_ADMIN may ever resolve a ClubAdmin record - a
 * CLUB_ADMIN cannot manage other club admins, and a CLUB_MEMBER has no
 * reason to see this list at all. Mirrors CoachesService's equivalent guard.
 */
function assertCanManageClubAdmins(ctx: AuthContext): void {
  if (ctx.role !== Role.PLATFORM_ADMIN && ctx.role !== Role.COACH) {
    throw new ForbiddenException();
  }
}

@Injectable()
export class ClubAdminsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * COACH (own organisation only, enforced by the controller's
   * @ScopeResource('organisation', ...) guard) or PLATFORM_ADMIN (any
   * organisation). Mirrors CoachesService.invite exactly: no password is
   * chosen here - the account starts INVITED with a placeholder password and
   * a one-time token, both emailed and returned directly to the inviter.
   */
  async invite(organisationId: string, dto: InviteClubAdminDto) {
    const org = await this.prisma.organisation.findFirst({
      where: { id: organisationId, deletedAt: null },
    });
    if (!org) {
      throw new NotFoundException('Organisation not found');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ForbiddenException('An account with this email already exists');
    }

    const { rawToken, tokenHash, expiresAt } = generateInviteToken();
    const placeholderPasswordHash = await argon2.hash(randomBytes(32).toString('hex'));

    const clubAdmin = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: placeholderPasswordHash,
          name: dto.name,
          role: Role.CLUB_ADMIN,
          status: UserStatus.INVITED,
          inviteTokenHash: tokenHash,
          inviteTokenExpiresAt: expiresAt,
        },
      });
      return tx.clubAdmin.create({
        data: { userId: user.id, organisationId },
        include: CLUB_ADMIN_INCLUDE,
      });
    });

    await this.sendInviteEmail(dto.email, rawToken);
    return { ...clubAdmin, inviteToken: rawToken, inviteTokenExpiresAt: expiresAt };
  }

  /**
   * Regenerates the invite token for a club admin who hasn't accepted yet.
   * COACH or PLATFORM_ADMIN - a coach may only resend within their own
   * organisation (404, not 403, matching findOne's existence-hiding
   * convention for an out-of-scope id).
   */
  async resendInvite(ctx: AuthContext, id: string) {
    assertCanManageClubAdmins(ctx);
    const clubAdmin = await this.prisma.clubAdmin.findFirst({
      where: { id, deletedAt: null },
      include: CLUB_ADMIN_INCLUDE,
    });
    if (!clubAdmin) {
      throw new NotFoundException('Club admin not found');
    }
    if (ctx.role === Role.COACH && ctx.organisationId !== clubAdmin.organisationId) {
      throw new NotFoundException('Club admin not found');
    }
    if (clubAdmin.user.status !== UserStatus.INVITED) {
      throw new BadRequestException('This club admin has already accepted their invite');
    }

    const { rawToken, tokenHash, expiresAt } = generateInviteToken();
    await this.prisma.user.update({
      where: { id: clubAdmin.userId },
      data: { inviteTokenHash: tokenHash, inviteTokenExpiresAt: expiresAt },
    });

    await this.sendInviteEmail(clubAdmin.user.email, rawToken);
    return { inviteToken: rawToken, inviteTokenExpiresAt: expiresAt };
  }

  private async sendInviteEmail(email: string, rawToken: string): Promise<void> {
    const acceptUrl = `${this.configService.get<string>('corsOrigin')}/accept-invite?token=${rawToken}`;
    await this.emailService.send({
      to: email,
      subject: "You've been invited to Ubuntu Run",
      text: `Set up your account here: ${acceptUrl}`,
    });
  }

  async findAllForOrganisation(ctx: AuthContext, organisationId: string) {
    assertCanManageClubAdmins(ctx);
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.organisationId !== organisationId) {
      throw new ForbiddenException();
    }
    return this.prisma.clubAdmin.findMany({
      where: { organisationId, deletedAt: null },
      include: CLUB_ADMIN_INCLUDE,
    });
  }

  async findOne(ctx: AuthContext, id: string) {
    assertCanManageClubAdmins(ctx);
    const clubAdmin = await this.prisma.clubAdmin.findFirst({
      where: { id, deletedAt: null },
      include: CLUB_ADMIN_INCLUDE,
    });
    if (!clubAdmin) {
      throw new NotFoundException('Club admin not found');
    }
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.organisationId !== clubAdmin.organisationId) {
      throw new NotFoundException('Club admin not found');
    }
    return clubAdmin;
  }

  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    const clubAdmin = await this.findOne(ctx, id);
    await this.prisma.clubAdmin.update({
      where: { id: clubAdmin.id },
      data: { deletedAt: new Date() },
    });
  }
}
