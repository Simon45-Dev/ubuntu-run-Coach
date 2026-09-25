import { createHash, randomBytes } from 'crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { MfaService } from './mfa.service';
import { EmailService } from '../email/email.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { generateInviteToken } from '../../common/invite-token';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const RESET_TTL_MS = 60 * 60 * 1000; // 1 hour - shorter than the 7-day invite TTL

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly mfaService: MfaService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Coach self-registration: creates User + Organisation + Coach in one
   * transaction, matching the v1 assumption that registration always
   * produces a single-coach organisation (the schema supports more coaches
   * being added to the same organisation later - see Coach.organisationId).
   */
  async register(dto: RegisterDto): Promise<TokenPair> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password);

    const { user, coach } = await this.prisma.$transaction(async (tx) => {
      const organisation = await tx.organisation.create({
        data: { name: dto.organisationName, type: 'SOLO' },
      });
      const createdUser = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
          role: Role.COACH,
          status: UserStatus.ACTIVE,
        },
      });
      const createdCoach = await tx.coach.create({
        data: { userId: createdUser.id, organisationId: organisation.id },
      });
      return { user: createdUser, coach: createdCoach };
    });

    return this.issueTokens(this.buildAuthContext(user, coach.id, coach.organisationId));
  }

  async login(dto: LoginDto): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        coachProfile: true,
        athleteProfile: true,
        clubMemberProfile: true,
        clubAdminProfile: true,
      },
    });

    // Constant-shape failure: don't reveal whether the email exists.
    if (!user || user.deletedAt) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    if (user.mfaEnabled) {
      if (!dto.mfaCode) {
        throw new UnauthorizedException('MFA code required');
      }
      if (!user.mfaSecretEncrypted) {
        throw new UnauthorizedException('MFA is misconfigured for this account');
      }
      const secret = this.mfaService.decryptSecret(user.mfaSecretEncrypted);
      if (!this.mfaService.verifyCode(secret, dto.mfaCode)) {
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const organisationId =
      user.coachProfile?.organisationId ??
      user.athleteProfile?.organisationId ??
      user.clubMemberProfile?.organisationId ??
      user.clubAdminProfile?.organisationId ??
      undefined;
    await this.assertOrganisationNotSuspended(organisationId);

    const authContext = this.buildAuthContext(
      user,
      user.coachProfile?.id,
      organisationId,
      user.athleteProfile?.id,
      user.clubMemberProfile?.id,
      user.clubAdminProfile?.id,
    );
    return this.issueTokens(authContext);
  }

  /**
   * Completes AthletesService.invite: sets a real password, activates the
   * account, and logs the athlete straight in - one less step than
   * accept-then-separately-log-in. Expired and invalid tokens look
   * identical, matching the generic-failure convention the rest of this
   * file already uses for login/refresh.
   */
  async acceptInvite(dto: AcceptInviteDto): Promise<TokenPair> {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        inviteTokenHash: tokenHash,
        status: UserStatus.INVITED,
        inviteTokenExpiresAt: { gt: new Date() },
      },
      include: {
        coachProfile: true,
        athleteProfile: true,
        clubMemberProfile: true,
        clubAdminProfile: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired invite');
    }

    const passwordHash = await argon2.hash(dto.password);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: UserStatus.ACTIVE,
        inviteTokenHash: null,
        inviteTokenExpiresAt: null,
        lastLoginAt: new Date(),
      },
      include: {
        coachProfile: true,
        athleteProfile: true,
        clubMemberProfile: true,
        clubAdminProfile: true,
      },
    });

    const organisationId =
      updated.coachProfile?.organisationId ??
      updated.athleteProfile?.organisationId ??
      updated.clubMemberProfile?.organisationId ??
      updated.clubAdminProfile?.organisationId ??
      undefined;
    await this.assertOrganisationNotSuspended(organisationId);

    const authContext = this.buildAuthContext(
      updated,
      updated.coachProfile?.id,
      organisationId,
      updated.athleteProfile?.id,
      updated.clubMemberProfile?.id,
      updated.clubAdminProfile?.id,
    );
    return this.issueTokens(authContext);
  }

  /**
   * Always resolves the same way regardless of whether the email exists or
   * the account is ACTIVE - same constant-shape-failure convention as
   * login, so a caller can't use this to enumerate registered emails. The
   * raw token is only ever emailed (or, with no SMTP configured, logged to
   * the server console by EmailService) - never returned here.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      return;
    }

    const { rawToken, tokenHash, expiresAt } = generateInviteToken(RESET_TTL_MS);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordResetTokenHash: tokenHash, passwordResetTokenExpiresAt: expiresAt },
    });

    const resetUrl = `${this.configService.get<string>('corsOrigin')}/reset-password?token=${rawToken}`;
    await this.emailService.send({
      to: user.email,
      subject: 'Reset your Ubuntu Run password',
      text: `Reset your password here (expires in 1 hour): ${resetUrl}`,
    });
  }

  /** Expired, invalid, and already-used tokens all look identical (401). */
  async resetPassword(dto: ResetPasswordDto): Promise<TokenPair> {
    const tokenHash = this.hashToken(dto.token);
    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetTokenExpiresAt: { gt: new Date() },
      },
      include: {
        coachProfile: true,
        athleteProfile: true,
        clubMemberProfile: true,
        clubAdminProfile: true,
      },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset link');
    }

    const passwordHash = await argon2.hash(dto.password);
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetTokenHash: null,
        passwordResetTokenExpiresAt: null,
        lastLoginAt: new Date(),
      },
      include: {
        coachProfile: true,
        athleteProfile: true,
        clubMemberProfile: true,
        clubAdminProfile: true,
      },
    });

    const organisationId =
      updated.coachProfile?.organisationId ??
      updated.athleteProfile?.organisationId ??
      updated.clubMemberProfile?.organisationId ??
      updated.clubAdminProfile?.organisationId ??
      undefined;
    await this.assertOrganisationNotSuspended(organisationId);

    const authContext = this.buildAuthContext(
      updated,
      updated.coachProfile?.id,
      organisationId,
      updated.athleteProfile?.id,
      updated.clubMemberProfile?.id,
      updated.clubAdminProfile?.id,
    );
    return this.issueTokens(authContext);
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            coachProfile: true,
            athleteProfile: true,
            clubMemberProfile: true,
            clubAdminProfile: true,
          },
        },
      },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Rotation: the presented token is always revoked, whether or not the
    // rest of the flow succeeds, so a stolen/replayed token can't be reused.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const user = stored.user;
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const organisationId =
      user.coachProfile?.organisationId ??
      user.athleteProfile?.organisationId ??
      user.clubMemberProfile?.organisationId ??
      user.clubAdminProfile?.organisationId ??
      undefined;
    await this.assertOrganisationNotSuspended(organisationId);

    const authContext = this.buildAuthContext(
      user,
      user.coachProfile?.id,
      organisationId,
      user.athleteProfile?.id,
      user.clubMemberProfile?.id,
      user.clubAdminProfile?.id,
    );
    return this.issueTokens(authContext);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Step 1 of MFA enrolment: issue a secret, not yet activated. */
  async enrolMfa(userId: string): Promise<{ secret: string; keyUri: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const secret = this.mfaService.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        mfaSecretEncrypted: this.mfaService.encryptSecret(secret),
        mfaType: 'TOTP',
        mfaEnabled: false,
      },
    });
    return { secret, keyUri: this.mfaService.keyUri(user.email, secret) };
  }

  /** Step 2: confirm the user can produce a valid code, then activate MFA. */
  async confirmMfa(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaSecretEncrypted) {
      throw new UnauthorizedException('MFA enrolment not started');
    }
    const secret = this.mfaService.decryptSecret(user.mfaSecretEncrypted);
    if (!this.mfaService.verifyCode(secret, code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.prisma.user.update({ where: { id: userId }, data: { mfaEnabled: true } });
  }

  async disableMfa(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!user.mfaEnabled || !user.mfaSecretEncrypted) {
      throw new UnauthorizedException('MFA is not enabled');
    }
    const secret = this.mfaService.decryptSecret(user.mfaSecretEncrypted);
    if (!this.mfaService.verifyCode(secret, code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false, mfaSecretEncrypted: null, mfaType: null },
    });
  }

  /**
   * PLATFORM_ADMIN has no organisationId and is never blocked. Same
   * lazy-lockout timing as the existing user.status !== ACTIVE check right
   * above every call site of this - blocks the next login/refresh/accept-
   * invite/reset-password, but doesn't retroactively revoke an
   * already-issued access token, which simply expires on its own short TTL.
   */
  private async assertOrganisationNotSuspended(organisationId: string | undefined): Promise<void> {
    if (!organisationId) return;
    const org = await this.prisma.organisation.findUnique({
      where: { id: organisationId },
      select: { suspendedAt: true },
    });
    if (org?.suspendedAt) {
      throw new UnauthorizedException('This organisation has been suspended. Contact support.');
    }
  }

  private buildAuthContext(
    user: { id: string; role: Role },
    coachId?: string,
    organisationId?: string,
    athleteId?: string,
    clubMemberId?: string,
    clubAdminId?: string,
  ): AuthContext {
    return {
      userId: user.id,
      role: user.role,
      organisationId,
      coachId,
      athleteId,
      clubMemberId,
      clubAdminId,
    };
  }

  private async issueTokens(authContext: AuthContext): Promise<TokenPair> {
    const accessToken = this.jwtService.sign(authContext, {
      secret: this.configService.get<string>('jwt.accessSecret', { infer: true }) as string,
      expiresIn: this.configService.get<string>('jwt.accessTtl', { infer: true }) as string,
    });

    const rawRefreshToken = randomBytes(48).toString('hex');
    const refreshTtl = this.configService.get<string>('jwt.refreshTtl', { infer: true }) as string;
    await this.prisma.refreshToken.create({
      data: {
        userId: authContext.userId,
        tokenHash: this.hashToken(rawRefreshToken),
        expiresAt: addDuration(new Date(), refreshTtl),
      },
    });

    return { accessToken, refreshToken: rawRefreshToken };
  }

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}

/** Minimal duration parser for TTL strings like "30d", "15m", "1h". */
function addDuration(base: Date, duration: string): Date {
  const match = /^(\d+)([smhd])$/.exec(duration.trim());
  if (!match) {
    throw new Error(`Invalid duration string: ${duration}`);
  }
  const [, amountStr, unit] = match;
  const amount = parseInt(amountStr, 10);
  const unitMs = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] as number;
  return new Date(base.getTime() + amount * unitMs);
}
