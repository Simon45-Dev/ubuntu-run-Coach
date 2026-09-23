import { createHash, randomBytes } from 'crypto';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** `ttlMs` defaults to the 7-day invite TTL - pass a shorter one for e.g. password reset. */
export function generateInviteToken(
  ttlMs: number = INVITE_TTL_MS,
): { rawToken: string; tokenHash: string; expiresAt: Date } {
  const rawToken = randomBytes(48).toString('hex');
  return {
    rawToken,
    tokenHash: createHash('sha256').update(rawToken).digest('hex'),
    expiresAt: new Date(Date.now() + ttlMs),
  };
}
