import type { ClubEventResult } from '@/api/types'
import { formatDuration } from '@/lib/format'
import { MEMBERSHIP_CATEGORY_LABELS } from '../admin/membershipCategory'

const RESULT_STATUS_LABEL = { FINISHED: null, DNF: 'DNF', DNS: 'DNS' } as const

export interface ClubEventResultExportRow {
  Rank: number | string
  'Membership #': string
  'First Name': string
  'Last Name': string
  Category: string
  Time: string
  Status: string
}

/** Mirrors clubMembersExport.ts's toClubMemberExportRows - human-readable spreadsheet rows, blank for missing fields. */
export function toClubEventResultExportRows(results: ClubEventResult[]): ClubEventResultExportRow[] {
  return results.map((result) => ({
    Rank: result.rank ?? '',
    'Membership #': result.clubMember.membershipNumber,
    'First Name': result.clubMember.firstName,
    'Last Name': result.clubMember.lastName,
    Category: result.clubMember.membershipCategory
      ? MEMBERSHIP_CATEGORY_LABELS[result.clubMember.membershipCategory]
      : '',
    Time: RESULT_STATUS_LABEL[result.status] ?? formatDuration(result.finishTimeSeconds),
    Status: result.status,
  }))
}
