import { apiClient } from './client'
import type { ClubAdmin } from './types'
import type { ResendInviteResult } from './athletes'

export async function listClubAdminsForOrganisation(organisationId: string): Promise<ClubAdmin[]> {
  const res = await apiClient.get<ClubAdmin[]>(`/organisations/${organisationId}/club-admins`)
  return res.data
}

export interface InviteClubAdminInput {
  email: string
  name: string
}

export interface InviteClubAdminResult extends ClubAdmin {
  inviteToken: string
  inviteTokenExpiresAt: string
}

export async function inviteClubAdmin(
  organisationId: string,
  input: InviteClubAdminInput,
): Promise<InviteClubAdminResult> {
  const res = await apiClient.post<InviteClubAdminResult>(
    `/organisations/${organisationId}/club-admins`,
    input,
  )
  return res.data
}

export async function resendClubAdminInvite(clubAdminId: string): Promise<ResendInviteResult> {
  const res = await apiClient.post<ResendInviteResult>(`/club-admins/${clubAdminId}/resend-invite`)
  return res.data
}

export async function deleteClubAdmin(id: string): Promise<void> {
  await apiClient.delete(`/club-admins/${id}`)
}
