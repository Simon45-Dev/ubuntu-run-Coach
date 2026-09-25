import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { randomBytes } from 'crypto';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { buildClubMemberScopeFilter } from '../../common/scope/scope-filters';
import { generateInviteToken } from '../../common/invite-token';
import { EmailService } from '../email/email.service';
import { CreateClubMemberDto } from './dto/create-club-member.dto';
import { UpdateClubMemberDto } from './dto/update-club-member.dto';
import { CreateClubMemberPaymentDto } from './dto/create-club-member-payment.dto';
import { parseClubMembersCsv } from './club-members-csv-import.util';
import { getMembershipStatus } from './club-membership-status.util';

const CLUB_MEMBER_INCLUDE = {
  user: { select: { id: true, email: true, name: true, status: true } },
};

@Injectable()
export class ClubMembersService {
  private readonly logger = new Logger(ClubMembersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * COACH or PLATFORM_ADMIN. @ScopeResource('organisation', 'organisationId')
   * on the route already restricts a COACH's :organisationId to their own
   * JWT claim, so no extra check needed here - matches CoachesService.invite.
   * membershipNumber is generated atomically via a single UPDATE...RETURNING
   * inside the transaction, so concurrent creates for the same club can
   * never collide or skip a number.
   */
  async create(organisationId: string, dto: CreateClubMemberDto) {
    return this.prisma.$transaction(async (tx) => {
      const [{ nextMembershipNumber }] = await tx.$queryRaw<{ nextMembershipNumber: number }[]>`
        UPDATE organisations
        SET "nextMembershipNumber" = "nextMembershipNumber" + 1
        WHERE id = ${organisationId}
        RETURNING "nextMembershipNumber"
      `;
      const membershipNumber = String(nextMembershipNumber).padStart(4, '0');

      return tx.clubMember.create({
        data: {
          organisationId,
          membershipNumber,
          firstName: dto.firstName,
          lastName: dto.lastName,
          idNumber: dto.idNumber,
          email: dto.email,
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          address: dto.address,
          joinDate: dto.joinDate ? new Date(dto.joinDate) : new Date(),
          nextOfKinName: dto.nextOfKinName,
          nextOfKinPhone: dto.nextOfKinPhone,
          nextOfKinRelationship: dto.nextOfKinRelationship,
        },
        include: CLUB_MEMBER_INCLUDE,
      });
    });
  }

  /**
   * Coach/admin-only. Parses the whole file first (validating every row) and
   * only touches the database if every row is valid; all rows are then
   * created inside one transaction, so a mid-import failure (e.g. a
   * duplicate email the CSV-level check couldn't catch) rolls back
   * everything rather than leaving a partial import.
   */
  async importCsv(organisationId: string, buffer: Buffer) {
    const parsed = parseClubMembersCsv(buffer);
    if ('errors' in parsed) {
      throw new BadRequestException({ message: 'CSV import failed', errors: parsed.errors });
    }

    return this.prisma.$transaction(async (tx) => {
      const created = [];
      for (const row of parsed.rows) {
        const [{ nextMembershipNumber }] = await tx.$queryRaw<{ nextMembershipNumber: number }[]>`
          UPDATE organisations
          SET "nextMembershipNumber" = "nextMembershipNumber" + 1
          WHERE id = ${organisationId}
          RETURNING "nextMembershipNumber"
        `;
        const membershipNumber = String(nextMembershipNumber).padStart(4, '0');
        created.push(
          await tx.clubMember.create({
            data: {
              organisationId,
              membershipNumber,
              firstName: row.firstName,
              lastName: row.lastName,
              idNumber: row.idNumber,
              email: row.email,
              phone: row.phone,
              dateOfBirth: row.dateOfBirth,
              address: row.address,
              joinDate: row.joinDate ?? new Date(),
              nextOfKinName: row.nextOfKinName,
              nextOfKinPhone: row.nextOfKinPhone,
              nextOfKinRelationship: row.nextOfKinRelationship,
            },
            include: CLUB_MEMBER_INCLUDE,
          }),
        );
      }
      return created;
    });
  }

  /** Any coach in the club (not tied to one specific coach), or PLATFORM_ADMIN. */
  async findAllForOrg(ctx: AuthContext, organisationId: string) {
    return this.prisma.clubMember.findMany({
      where: { organisationId, deletedAt: null, ...buildClubMemberScopeFilter(ctx) },
      include: CLUB_MEMBER_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Self, any coach in the club, or PLATFORM_ADMIN. */
  async findOne(ctx: AuthContext, id: string) {
    const member = await this.prisma.clubMember.findFirst({
      where: { id, deletedAt: null, ...buildClubMemberScopeFilter(ctx) },
      include: CLUB_MEMBER_INCLUDE,
    });
    if (!member) {
      // 404, not 403 - existence isn't confirmed to an out-of-scope caller.
      throw new NotFoundException('Club member not found');
    }
    return member;
  }

  async update(ctx: AuthContext, id: string, dto: UpdateClubMemberDto) {
    if (
      ctx.role === Role.CLUB_MEMBER &&
      (dto.joinDate !== undefined ||
        dto.membershipExpiryDate !== undefined ||
        dto.lastRenewalDate !== undefined)
    ) {
      throw new ForbiddenException('Members cannot change their own join date or membership dates');
    }

    const member = await this.findOne(ctx, id);
    return this.prisma.clubMember.update({
      where: { id: member.id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        idNumber: dto.idNumber,
        email: dto.email,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        address: dto.address,
        joinDate: dto.joinDate ? new Date(dto.joinDate) : undefined,
        membershipExpiryDate: dto.membershipExpiryDate
          ? new Date(dto.membershipExpiryDate)
          : undefined,
        // Re-arms future reminders - without this, a member renewed after
        // being reminded once would never be reminded again next cycle.
        lastReminderSentAt: dto.membershipExpiryDate ? null : undefined,
        lastRenewalDate: dto.lastRenewalDate ? new Date(dto.lastRenewalDate) : undefined,
        nextOfKinName: dto.nextOfKinName,
        nextOfKinPhone: dto.nextOfKinPhone,
        nextOfKinRelationship: dto.nextOfKinRelationship,
      },
      include: CLUB_MEMBER_INCLUDE,
    });
  }

  async softDelete(ctx: AuthContext, id: string): Promise<void> {
    if (ctx.role === Role.CLUB_MEMBER) {
      throw new ForbiddenException();
    }
    const member = await this.findOne(ctx, id);
    await this.prisma.clubMember.update({
      where: { id: member.id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Coach/admin-only, mirrors AthletesService.invite: creates a User (role
   * CLUB_MEMBER, INVITED, placeholder password) and links it via
   * ClubMember.userId, using the member's already-stored email - no
   * separate email input, unlike inviting an athlete.
   */
  async invite(ctx: AuthContext, id: string) {
    if (ctx.role === Role.CLUB_MEMBER) {
      throw new ForbiddenException();
    }
    const member = await this.findOne(ctx, id);
    if (member.userId) {
      throw new BadRequestException('This member has already been invited');
    }
    const existing = await this.prisma.user.findUnique({ where: { email: member.email } });
    if (existing) {
      throw new ForbiddenException('An account with this email already exists');
    }

    const { rawToken, tokenHash, expiresAt } = generateInviteToken();
    const placeholderPasswordHash = await argon2.hash(randomBytes(32).toString('hex'));

    const updated = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: member.email,
          passwordHash: placeholderPasswordHash,
          name: `${member.firstName} ${member.lastName}`,
          role: Role.CLUB_MEMBER,
          status: UserStatus.INVITED,
          inviteTokenHash: tokenHash,
          inviteTokenExpiresAt: expiresAt,
        },
      });
      return tx.clubMember.update({
        where: { id: member.id },
        data: { userId: user.id },
        include: CLUB_MEMBER_INCLUDE,
      });
    });

    await this.sendInviteEmail(member.email, rawToken);
    return { ...updated, inviteToken: rawToken, inviteTokenExpiresAt: expiresAt };
  }

  /** Regenerates the invite token for a member who hasn't accepted yet. */
  async resendInvite(ctx: AuthContext, id: string) {
    if (ctx.role === Role.CLUB_MEMBER) {
      throw new ForbiddenException();
    }
    const member = await this.findOne(ctx, id);
    if (!member.userId || member.user?.status !== UserStatus.INVITED) {
      throw new BadRequestException('This member has no pending invite to resend');
    }

    const { rawToken, tokenHash, expiresAt } = generateInviteToken();
    await this.prisma.user.update({
      where: { id: member.userId },
      data: { inviteTokenHash: tokenHash, inviteTokenExpiresAt: expiresAt },
    });

    await this.sendInviteEmail(member.email, rawToken);
    return { inviteToken: rawToken, inviteTokenExpiresAt: expiresAt };
  }

  /**
   * Best-effort - only fires if the service happens to be awake at 08:00.
   * Render's free web service sleeps after 15 minutes idle and doesn't wake
   * itself on a timer, so this is a bonus, not the guarantee - the real
   * guarantee is an external pinger hitting
   * POST /club-members/send-expiry-reminders (see
   * ClubMembersRemindersController and docs/deployment.md), which also
   * wakes a sleeping instance since it's a real HTTP request.
   */
  @Cron('0 8 * * *')
  async handleExpiryReminderCron() {
    const result = await this.sendExpiryReminders();
    this.logger.log(`Scheduled expiry reminder run sent ${result.sent} email(s)`);
  }

  /**
   * Reminds every non-deleted member (across every organisation) whose
   * membership is EXPIRING_SOON or EXPIRED and who hasn't been reminded
   * since their current expiry date was set. Emails the member's own
   * stored address, not their User.email - works even for members with no
   * self-service login at all.
   */
  async sendExpiryReminders(): Promise<{ sent: number }> {
    const now = new Date();
    const candidates = await this.prisma.clubMember.findMany({
      where: {
        deletedAt: null,
        membershipExpiryDate: { not: null },
        lastReminderSentAt: null,
      },
    });

    const toRemind = candidates.filter(
      (member) => getMembershipStatus(member.membershipExpiryDate, now) !== 'ACTIVE',
    );

    for (const member of toRemind) {
      await this.emailService.send({
        to: member.email,
        subject: 'Your Ubuntu Run club membership is expiring soon',
        text: `Hi ${member.firstName}, your club membership (#${member.membershipNumber}) is expiring or has expired. Please contact your club to renew.`,
      });
      await this.prisma.clubMember.update({
        where: { id: member.id },
        data: { lastReminderSentAt: now },
      });
    }

    return { sent: toRemind.length };
  }

  /** Coach/admin-only - recording a payment is administrative, not something a member attests to themselves. */
  async createPayment(ctx: AuthContext, clubMemberId: string, dto: CreateClubMemberPaymentDto) {
    if (ctx.role === Role.CLUB_MEMBER) {
      throw new ForbiddenException();
    }
    const member = await this.findOne(ctx, clubMemberId);
    return this.prisma.clubMemberPayment.create({
      data: {
        clubMemberId: member.id,
        amount: dto.amount,
        method: dto.method,
        paidAt: new Date(dto.paidAt),
        note: dto.note,
        recordedByUserId: ctx.userId,
      },
    });
  }

  /** Self, any coach in the club, or PLATFORM_ADMIN - same scope as viewing the member record. */
  async listPayments(ctx: AuthContext, clubMemberId: string) {
    const member = await this.findOne(ctx, clubMemberId);
    return this.prisma.clubMemberPayment.findMany({
      where: { clubMemberId: member.id },
      orderBy: { paidAt: 'desc' },
    });
  }

  /** Coach/admin-only - corrects a mis-entered payment. */
  async deletePayment(ctx: AuthContext, paymentId: string): Promise<void> {
    if (ctx.role === Role.CLUB_MEMBER) {
      throw new ForbiddenException();
    }
    const payment = await this.prisma.clubMemberPayment.findUnique({ where: { id: paymentId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    // Confirms the caller is actually in scope for this payment's member
    // (own org's coach, or admin) before allowing the delete.
    await this.findOne(ctx, payment.clubMemberId);
    await this.prisma.clubMemberPayment.delete({ where: { id: paymentId } });
  }

  private async sendInviteEmail(email: string, rawToken: string): Promise<void> {
    const acceptUrl = `${this.configService.get<string>('corsOrigin')}/accept-invite?token=${rawToken}`;
    await this.emailService.send({
      to: email,
      subject: "You've been invited to Ubuntu Run",
      text: `Set up your club membership account here: ${acceptUrl}`,
    });
  }
}
