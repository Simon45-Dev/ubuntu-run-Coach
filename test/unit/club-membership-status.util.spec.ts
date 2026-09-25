import { getMembershipStatus } from '../../src/modules/club-members/club-membership-status.util';

describe('getMembershipStatus', () => {
  const now = new Date('2026-09-25T00:00:00.000Z');

  it('returns NO_EXPIRY when no expiry date is set', () => {
    expect(getMembershipStatus(null, now)).toBe('NO_EXPIRY');
  });

  it('returns EXPIRED for a past expiry date', () => {
    expect(getMembershipStatus(new Date('2026-01-01T00:00:00.000Z'), now)).toBe('EXPIRED');
  });

  it('returns EXPIRING_SOON within the 30-day window', () => {
    expect(getMembershipStatus(new Date('2026-10-10T00:00:00.000Z'), now)).toBe('EXPIRING_SOON');
  });

  it('returns ACTIVE beyond the 30-day window', () => {
    expect(getMembershipStatus(new Date('2027-01-01T00:00:00.000Z'), now)).toBe('ACTIVE');
  });
});
