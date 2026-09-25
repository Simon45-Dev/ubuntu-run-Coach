import { describe, expect, it } from 'vitest'
import { filterClubMembers } from '@/features/admin/clubMemberFilter'
import type { ClubMember } from '@/api/types'

const now = new Date('2026-09-25T00:00:00.000Z')

function makeMember(overrides: Partial<ClubMember>): ClubMember {
  return {
    id: overrides.id ?? 'member-1',
    organisationId: 'org-1',
    userId: null,
    membershipNumber: '0001',
    firstName: 'Sipho',
    lastName: 'Dlamini',
    idNumber: null,
    email: 'sipho@example.test',
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

describe('filterClubMembers', () => {
  const members = [
    makeMember({ id: '1', firstName: 'Sipho', lastName: 'Dlamini', email: 'sipho@example.test', membershipNumber: '0001', membershipExpiryDate: null }),
    makeMember({ id: '2', firstName: 'Thandi', lastName: 'Nkosi', email: 'thandi@example.test', membershipNumber: '0002', membershipExpiryDate: '2020-01-01T00:00:00.000Z' }),
    makeMember({ id: '3', firstName: 'John', lastName: 'Smith', email: 'john@example.test', membershipNumber: '0003', membershipExpiryDate: '2027-01-01T00:00:00.000Z' }),
  ]

  it('returns everyone when the query is empty and status filter is ALL', () => {
    expect(filterClubMembers(members, '', 'ALL', now)).toHaveLength(3)
  })

  it('matches by name, case-insensitively', () => {
    const result = filterClubMembers(members, 'thandi', 'ALL', now)
    expect(result.map((m) => m.id)).toEqual(['2'])
  })

  it('matches by email substring', () => {
    const result = filterClubMembers(members, 'john@example', 'ALL', now)
    expect(result.map((m) => m.id)).toEqual(['3'])
  })

  it('matches by membership number', () => {
    const result = filterClubMembers(members, '0002', 'ALL', now)
    expect(result.map((m) => m.id)).toEqual(['2'])
  })

  it('filters by membership status', () => {
    const result = filterClubMembers(members, '', 'EXPIRED', now)
    expect(result.map((m) => m.id)).toEqual(['2'])
  })

  it('combines a text query with a status filter', () => {
    expect(filterClubMembers(members, 'sipho', 'EXPIRED', now)).toHaveLength(0)
    expect(filterClubMembers(members, 'sipho', 'NO_EXPIRY', now)).toHaveLength(1)
  })
})
