import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { authenticator } from 'otplib';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class MfaService {
  constructor(private readonly configService: ConfigService) {}

  private encryptionKey(): Buffer {
    const raw = this.configService.get<string>('mfaEncryptionKey', { infer: true }) as string;
    // Derive a 32-byte key regardless of the raw secret's length/format.
    return createHash('sha256').update(raw).digest();
  }

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  keyUri(email: string, secret: string): string {
    return authenticator.keyuri(email, 'Ubuntu Run', secret);
  }

  verifyCode(secret: string, code: string): boolean {
    return authenticator.check(code, secret);
  }

  encryptSecret(secret: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.encryptionKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('hex'), authTag.toString('hex'), encrypted.toString('hex')].join(':');
  }

  decryptSecret(payload: string): string {
    const [ivHex, authTagHex, dataHex] = payload.split(':');
    const decipher = createDecipheriv(ALGORITHM, this.encryptionKey(), Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
