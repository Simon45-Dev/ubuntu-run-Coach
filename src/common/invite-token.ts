import { createHash, randomBytes } from 'crypto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteToken(): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = randomBytes(48).toString('hex');
  return {
    rawToken,
    tokenHash: createHash('sha256').update(rawToken).digest('hex'),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  };
}
