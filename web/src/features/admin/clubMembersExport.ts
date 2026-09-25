import type { ClubMember } from '@/api/types'
import { formatDate } from '@/lib/format'

function formatOrBlank(value: string | null | undefined): string {
  return value ? formatDate(value) : ''
}

export interface ClubMemberExportRow {
  'Membership #': string
  'First Name': string
  'Last Name': string
  'ID Number': string
  Email: string
  Phone: string
  'Date of Birth': string
  Address: string
  'Join Date': string
  'Membership Expiry': string
  'Last Renewal': string
  'Next of Kin Name': string
  'Next of Kin Phone': string
  'Next of Kin Relationship': string
  'Login Status': string
}

/** Human-readable spreadsheet rows - blank for missing fields, not "null"/"undefined". */
export function toClubMemberExportRows(members: ClubMember[]): ClubMemberExportRow[] {
  return members.map((member) => ({
    'Membership #': member.membershipNumber,
    'First Name': member.firstName,
    'Last Name': member.lastName,
    'ID Number': member.idNumber ?? '',
    Email: member.email,
    Phone: member.phone ?? '',
    'Date of Birth': formatOrBlank(member.dateOfBirth),
    Address: member.address ?? '',
    'Join Date': formatOrBlank(member.joinDate),
    'Membership Expiry': formatOrBlank(member.membershipExpiryDate),
    'Last Renewal': formatOrBlank(member.lastRenewalDate),
    'Next of Kin Name': member.nextOfKinName ?? '',
    'Next of Kin Phone': member.nextOfKinPhone ?? '',
    'Next of Kin Relationship': member.nextOfKinRelationship ?? '',
    'Login Status': member.user?.status ?? 'No login',
  }))
}
