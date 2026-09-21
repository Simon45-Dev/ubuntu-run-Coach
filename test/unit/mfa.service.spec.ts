import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';
import { MfaService } from '../../src/modules/auth/mfa.service';

describe('MfaService', () => {
  let service: MfaService;

  beforeEach(() => {
    const configService = {
      get: () => 'test-mfa-encryption-key-please-change',
    } as unknown as ConfigService;
    service = new MfaService(configService);
  });

  it('generates a secret and produces a working keyUri', () => {
    const secret = service.generateSecret();
    expect(secret).toBeTruthy();
    const uri = service.keyUri('coach@example.test', secret);
    expect(uri).toContain('otpauth://totp/');
  });

  it('verifyCode accepts a currently-valid TOTP code and rejects a wrong one', () => {
    const secret = service.generateSecret();
    const validCode = authenticator.generate(secret);
    expect(service.verifyCode(secret, validCode)).toBe(true);
    expect(service.verifyCode(secret, '000000')).toBe(false);
  });

  it('round-trips a secret through encryptSecret/decryptSecret', () => {
    const secret = service.generateSecret();
    const encrypted = service.encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(service.decryptSecret(encrypted)).toBe(secret);
  });
});
