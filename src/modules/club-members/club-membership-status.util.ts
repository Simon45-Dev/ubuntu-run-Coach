const EXPIRING_SOON_WINDOW_DAYS = 30;

export type MembershipStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_EXPIRY';

/**
 * Mirrors web/src/features/admin/membershipStatus.ts exactly - kept as a
 * separate backend copy (not a shared package, this repo has no shared-code
 * mechanism between src/ and web/) so the reminder job and the roster badge
 * never disagree about what "expiring soon" means.
 */
export function getMembershipStatus(expiryDate: Date | null, now: Date): MembershipStatus {
  if (!expiryDate) return 'NO_EXPIRY';
  if (expiryDate < now) return 'EXPIRED';

  const msUntilExpiry = expiryDate.getTime() - now.getTime();
  const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24);
  if (daysUntilExpiry <= EXPIRING_SOON_WINDOW_DAYS) return 'EXPIRING_SOON';

  return 'ACTIVE';
}
