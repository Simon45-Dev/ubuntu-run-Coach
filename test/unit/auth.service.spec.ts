import * as argon2 from 'argon2';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../../src/modules/auth/auth.service';
import { Role } from '../../src/common/enums/role.enum';
import { UserStatus } from '../../src/common/enums/user-status.enum';

function buildService(overrides: { userRecord: unknown }) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(overrides.userRecord),
      update: jest.fn().mockResolvedValue({}),
    },
    refreshToken: {
      create: jest.fn().mockResolvedValue({}),
    },
    // Not suspended by default - see the dedicated
    // AuthService.assertOrganisationNotSuspended describe block below for
    // the suspended case.
    organisation: {
      findUnique: jest.fn().mockResolvedValue({ suspendedAt: null }),
    },
  };
  const jwtService = { sign: jest.fn().mockReturnValue('signed.jwt.token') };
  const configService = {
    get: (key: string) =>
      ({
        'jwt.accessSecret': 'test-secret',
        'jwt.accessTtl': '15m',
        'jwt.refreshTtl': '30d',
      })[key],
  };
  const mfaService = { decryptSecret: jest.fn(), verifyCode: jest.fn() };
  const emailService = { send: jest.fn().mockResolvedValue(undefined) };

  const service = new AuthService(
    prisma as never,
    jwtService as never,
    configService as never,
    mfaService as never,
    emailService as never,
  );
  return { service, prisma, mfaService, emailService };
}

describe('AuthService.login', () => {
  it('succeeds with the correct password for an active, non-MFA account', async () => {
    const passwordHash = await argon2.hash('CorrectPassword123!');
    const { service, prisma } = buildService({
      userRecord: {
        id: 'user-1',
        email: 'coach@example.test',
        passwordHash,
        role: Role.COACH,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        deletedAt: null,
        coachProfile: { id: 'coach-1', organisationId: 'org-1' },
        athleteProfile: null,
      },
    });

    const result = await service.login({
      email: 'coach@example.test',
      password: 'CorrectPassword123!',
    });
    expect(result.accessToken).toBe('signed.jwt.token');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'user-1' } }),
    );
  });

  it('rejects an incorrect password', async () => {
    const passwordHash = await argon2.hash('CorrectPassword123!');
    const { service } = buildService({
      userRecord: {
        id: 'user-1',
        passwordHash,
        role: Role.COACH,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        deletedAt: null,
        coachProfile: null,
        athleteProfile: null,
      },
    });

    await expect(
      service.login({ email: 'coach@example.test', password: 'WrongPassword' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown email without revealing whether the account exists', async () => {
    const { service } = buildService({ userRecord: null });
    await expect(
      service.login({ email: 'nobody@example.test', password: 'whatever' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a suspended account even with the correct password', async () => {
    const passwordHash = await argon2.hash('CorrectPassword123!');
    const { service } = buildService({
      userRecord: {
        id: 'user-1',
        passwordHash,
        role: Role.COACH,
        status: UserStatus.SUSPENDED,
        mfaEnabled: false,
        deletedAt: null,
        coachProfile: null,
        athleteProfile: null,
      },
    });

    await expect(
      service.login({ email: 'coach@example.test', password: 'CorrectPassword123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejects login when the user's organisation is suspended, even with the correct password", async () => {
    const passwordHash = await argon2.hash('CorrectPassword123!');
    const { service, prisma } = buildService({
      userRecord: {
        id: 'user-1',
        passwordHash,
        role: Role.COACH,
        status: UserStatus.ACTIVE,
        mfaEnabled: false,
        deletedAt: null,
        coachProfile: { id: 'coach-1', organisationId: 'org-1' },
        athleteProfile: null,
      },
    });
    prisma.organisation.findUnique.mockResolvedValue({ suspendedAt: new Date() });

    await expect(
      service.login({ email: 'coach@example.test', password: 'CorrectPassword123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('requires an MFA code when MFA is enabled, and rejects a wrong one', async () => {
    const passwordHash = await argon2.hash('CorrectPassword123!');
    const { service, mfaService } = buildService({
      userRecord: {
        id: 'user-1',
        passwordHash,
        role: Role.COACH,
        status: UserStatus.ACTIVE,
        mfaEnabled: true,
        mfaSecretEncrypted: 'encrypted-secret',
        deletedAt: null,
        coachProfile: null,
        athleteProfile: null,
      },
    });
    (mfaService.decryptSecret as jest.Mock).mockReturnValue('raw-secret');

    await expect(
      service.login({ email: 'coach@example.test', password: 'CorrectPassword123!' }),
    ).rejects.toThrow(UnauthorizedException);

    (mfaService.verifyCode as jest.Mock).mockReturnValue(false);
    await expect(
      service.login({
        email: 'coach@example.test',
        password: 'CorrectPassword123!',
        mfaCode: '000000',
      }),
    ).rejects.toThrow(UnauthorizedException);

    (mfaService.verifyCode as jest.Mock).mockReturnValue(true);
    const result = await service.login({
      email: 'coach@example.test',
      password: 'CorrectPassword123!',
      mfaCode: '123456',
    });
    expect(result.accessToken).toBe('signed.jwt.token');
  });
});
