import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { generateInviteToken } from '../../common/invite-token';
import { EmailService } from '../email/email.service';
import { InviteCoachDto } from './dto/invite-coach.dto';
import { UpdateCoachDto } from './dto/update-coach.dto';

const COACH_INCLUDE = { user: { select: { id: true, email: true, name: true, status: true } } };

@Injectable()
export class CoachesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * COACH (own organisation only, enforced by the controller's
   * @ScopeResource('organisation', ...) guard) or PLATFORM_ADMIN (any
   * organisation). Mirrors AthletesService.invite: no password is chosen
   * here - the account starts INVITED with a placeholder password and a
   * one-time token, both emailed (EmailService) and returned directly to
   * the inviter, since the same POST /auth/accept-invite endpoint
   * activates any invited user regardless of role.
   */
  async invite(organisationId: string, dto: InviteCoachDto) {
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

    const coach = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash: placeholderPasswordHash,
          name: dto.name,
          role: Role.COACH,
          status: UserStatus.INVITED,
          inviteTokenHash: tokenHash,
          inviteTokenExpiresAt: expiresAt,
        },
      });
      return tx.coach.create({
        data: {
          userId: user.id,
          organisationId,
          bio: dto.bio,
          experienceYears: dto.experienceYears,
        },
        include: COACH_INCLUDE,
      });
    });

    await this.sendInviteEmail(dto.email, rawToken);
    return { ...coach, inviteToken: rawToken, inviteTokenExpiresAt: expiresAt };
  }

  /**
   * Regenerates the invite token for a coach who hasn't accepted yet.
   * COACH or PLATFORM_ADMIN - a coach may only resend within their own
   * organisation (404, not 403, matching findOne's existence-hiding
   * convention for an out-of-scope id).
   */
  async resendInvite(ctx: AuthContext, id: string) {
    const coach = await this.prisma.coach.findFirst({
      where: { id, deletedAt: null },
      include: COACH_INCLUDE,
    });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }
    if (ctx.role === Role.COACH && ctx.organisationId !== coach.organisationId) {
      throw new NotFoundException('Coach not found');
    }
    if (coach.user.status !== UserStatus.INVITED) {
      throw new BadRequestException('This coach has already accepted their invite');
    }

    const { rawToken, tokenHash, expiresAt } = generateInviteToken();
    await this.prisma.user.update({
      where: { id: coach.userId },
      data: { inviteTokenHash: tokenHash, inviteTokenExpiresAt: expiresAt },
    });

    await this.sendInviteEmail(coach.user.email, rawToken);
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
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.organisationId !== organisationId) {
      throw new ForbiddenException();
    }
    return this.prisma.coach.findMany({
      where: { organisationId, deletedAt: null },
      include: COACH_INCLUDE,
    });
  }

  async findOne(ctx: AuthContext, id: string) {
    const coach = await this.prisma.coach.findFirst({
      where: { id, deletedAt: null },
      include: COACH_INCLUDE,
    });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }
    if (ctx.role !== Role.PLATFORM_ADMIN && ctx.organisationId !== coach.organisationId) {
      throw new NotFoundException('Coach not found');
    }
    return coach;
  }

  async update(ctx: AuthContext, id: string, dto: UpdateCoachDto) {
    const coach = await this.findOne(ctx, id);
    if (ctx.role === Role.COACH && ctx.coachId !== id) {
      throw new ForbiddenException();
    }
    return this.prisma.coach.update({
      where: { id: coach.id },
      data: dto,
      include: COACH_INCLUDE,
    });
  }

  async softDelete(id: string): Promise<void> {
    const coach = await this.prisma.coach.findFirst({ where: { id, deletedAt: null } });
    if (!coach) {
      throw new NotFoundException('Coach not found');
    }
    await this.prisma.coach.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
