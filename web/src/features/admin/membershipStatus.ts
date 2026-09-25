const EXPIRING_SOON_WINDOW_DAYS = 30

export type MembershipStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_EXPIRY'

/** No expiry set is treated as an intentional "no fixed term" record, not a warning state. */
export function getMembershipStatus(expiryDate: string | null, now: Date): MembershipStatus {
  if (!expiryDate) return 'NO_EXPIRY'

  const expiry = new Date(expiryDate)
  if (expiry < now) return 'EXPIRED'

  const msUntilExpiry = expiry.getTime() - now.getTime()
  const daysUntilExpiry = msUntilExpiry / (1000 * 60 * 60 * 24)
  if (daysUntilExpiry <= EXPIRING_SOON_WINDOW_DAYS) return 'EXPIRING_SOON'

  return 'ACTIVE'
}
