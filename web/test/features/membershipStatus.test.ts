import { describe, expect, it } from 'vitest'
import { getMembershipStatus } from '@/features/admin/membershipStatus'

describe('getMembershipStatus', () => {
  const now = new Date('2026-09-25T00:00:00.000Z')

  it('returns NO_EXPIRY when no expiry date is set', () => {
    expect(getMembershipStatus(null, now)).toBe('NO_EXPIRY')
  })

  it('returns EXPIRED for a past expiry date', () => {
    expect(getMembershipStatus('2026-01-01T00:00:00.000Z', now)).toBe('EXPIRED')
  })

  it('returns EXPIRING_SOON within the 30-day window', () => {
    expect(getMembershipStatus('2026-10-10T00:00:00.000Z', now)).toBe('EXPIRING_SOON')
  })

  it('returns ACTIVE beyond the 30-day window', () => {
    expect(getMembershipStatus('2027-01-01T00:00:00.000Z', now)).toBe('ACTIVE')
  })

  it('treats exactly 30 days out as EXPIRING_SOON (boundary is inclusive)', () => {
    const thirtyDaysOut = new Date(now)
    thirtyDaysOut.setUTCDate(thirtyDaysOut.getUTCDate() + 30)
    expect(getMembershipStatus(thirtyDaysOut.toISOString(), now)).toBe('EXPIRING_SOON')
  })
})
