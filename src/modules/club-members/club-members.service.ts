import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

const CLUB_MEMBER_INCLUDE = {
  user: { select: { id: true, email: true, name: true, status: true } },
};

@Injectable()
export class ClubMembersService {
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
          email: dto.email,
          phone: dto.phone,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          address: dto.address,
          nextOfKinName: dto.nextOfKinName,
          nextOfKinPhone: dto.nextOfKinPhone,
          nextOfKinRelationship: dto.nextOfKinRelationship,
        },
        include: CLUB_MEMBER_INCLUDE,
      });
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
    const member = await this.findOne(ctx, id);
    return this.prisma.clubMember.update({
      where: { id: member.id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        phone: dto.phone,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        address: dto.address,
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

  private async sendInviteEmail(email: string, rawToken: string): Promise<void> {
    const acceptUrl = `${this.configService.get<string>('corsOrigin')}/accept-invite?token=${rawToken}`;
    await this.emailService.send({
      to: email,
      subject: "You've been invited to Ubuntu Run",
      text: `Set up your club membership account here: ${acceptUrl}`,
    });
  }
}
