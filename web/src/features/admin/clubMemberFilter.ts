import type { ClubMember } from '@/api/types'
import { getMembershipStatus, type MembershipStatus } from './membershipStatus'

export function filterClubMembers(
  members: ClubMember[],
  query: string,
  statusFilter: MembershipStatus | 'ALL',
  now: Date = new Date(),
): ClubMember[] {
  const normalisedQuery = query.trim().toLowerCase()

  return members.filter((member) => {
    if (statusFilter !== 'ALL' && getMembershipStatus(member.membershipExpiryDate, now) !== statusFilter) {
      return false
    }
    if (!normalisedQuery) return true

    const haystack = [`${member.firstName} ${member.lastName}`, member.email, member.membershipNumber]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalisedQuery)
  })
}
