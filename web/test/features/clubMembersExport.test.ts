import { describe, expect, it } from 'vitest'
import { toClubMemberExportRows } from '@/features/admin/clubMembersExport'
import type { ClubMember } from '@/api/types'

function member(overrides: Partial<ClubMember> = {}): ClubMember {
  return {
    id: 'member-1',
    organisationId: 'org-1',
    userId: null,
    membershipNumber: '0001',
    firstName: 'Thabo',
    lastName: 'Nkosi',
    idNumber: null,
    email: 'thabo@example.test',
    phone: null,
    dateOfBirth: null,
    address: null,
    membershipCategory: null,
    joinDate: '2026-01-01T00:00:00.000Z',
    membershipExpiryDate: null,
    lastRenewalDate: null,
    nextOfKinName: null,
    nextOfKinPhone: null,
    nextOfKinRelationship: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    user: null,
    ...overrides,
  }
}

describe('toClubMemberExportRows', () => {
  it('leaves missing optional fields blank, not "null"/"undefined"', () => {
    const rows = toClubMemberExportRows([member()])
    expect(rows[0]['ID Number']).toBe('')
    expect(rows[0]['Membership Expiry']).toBe('')
    expect(rows[0]['Login Status']).toBe('No login')
    expect(rows[0]['Category']).toBe('')
  })

  it('formats populated fields, including a linked login status', () => {
    const rows = toClubMemberExportRows([
      member({
        idNumber: '9001015800089',
        membershipExpiryDate: '2027-06-15T00:00:00.000Z',
        membershipCategory: 'GRAND_MASTER',
        user: { id: 'u1', email: 'thabo@example.test', name: 'Thabo Nkosi', status: 'ACTIVE' },
      }),
    ])
    expect(rows[0]['ID Number']).toBe('9001015800089')
    expect(rows[0]['Membership Expiry']).toBe('15 Jun 2027')
    expect(rows[0]['Login Status']).toBe('ACTIVE')
    expect(rows[0]['Category']).toBe('Grand Master')
  })

  it('maps every member to its own row in order', () => {
    const rows = toClubMemberExportRows([
      member({ id: 'a', membershipNumber: '0001' }),
      member({ id: 'b', membershipNumber: '0002' }),
    ])
    expect(rows.map((r) => r['Membership #'])).toEqual(['0001', '0002'])
  })
})
