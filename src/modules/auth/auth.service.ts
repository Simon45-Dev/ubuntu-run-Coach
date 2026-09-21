import { createHash, randomBytes } from 'crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { PrismaService } from '../../database/prisma.service';
import { MfaService } from './mfa.service';
import { AuthContext } from '../../common/auth-context';
import { Role } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user-status.enum';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

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
      include: { coachProfile: true, athleteProfile: true },
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

    const authContext = this.buildAuthContext(
      user,
      user.coachProfile?.id,
      user.coachProfile?.organisationId ?? user.athleteProfile?.organisationId ?? undefined,
      user.athleteProfile?.id,
    );
    return this.issueTokens(authContext);
  }

  async refresh(rawRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { coachProfile: true, athleteProfile: true } } },
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

    const authContext = this.buildAuthContext(
      user,
      user.coachProfile?.id,
      user.coachProfile?.organisationId ?? user.athleteProfile?.organisationId ?? undefined,
      user.athleteProfile?.id,
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

  private buildAuthContext(
    user: { id: string; role: Role },
    coachId?: string,
    organisationId?: string,
    athleteId?: string,
  ): AuthContext {
    return {
      userId: user.id,
      role: user.role,
      organisationId,
      coachId,
      athleteId,
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
