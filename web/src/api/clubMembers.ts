import { apiClient } from './client'
import type { ClubMember } from './types'

export async function listClubMembers(organisationId: string): Promise<ClubMember[]> {
  const res = await apiClient.get<ClubMember[]>(`/organisations/${organisationId}/club-members`)
  return res.data
}

export async function getClubMember(id: string): Promise<ClubMember> {
  const res = await apiClient.get<ClubMember>(`/club-members/${id}`)
  return res.data
}

export interface CreateClubMemberInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  dateOfBirth?: string
  address?: string
  nextOfKinName?: string
  nextOfKinPhone?: string
  nextOfKinRelationship?: string
}

export async function createClubMember(
  organisationId: string,
  input: CreateClubMemberInput,
): Promise<ClubMember> {
  const res = await apiClient.post<ClubMember>(`/organisations/${organisationId}/club-members`, input)
  return res.data
}

export type UpdateClubMemberInput = Partial<CreateClubMemberInput>

export async function updateClubMember(id: string, input: UpdateClubMemberInput): Promise<ClubMember> {
  const res = await apiClient.patch<ClubMember>(`/club-members/${id}`, input)
  return res.data
}

export async function deleteClubMember(id: string): Promise<void> {
  await apiClient.delete(`/club-members/${id}`)
}

export interface InviteClubMemberResult {
  inviteToken: string
  inviteTokenExpiresAt: string
}

export async function inviteClubMember(id: string): Promise<InviteClubMemberResult> {
  const res = await apiClient.post<InviteClubMemberResult>(`/club-members/${id}/invite`)
  return res.data
}

export async function resendClubMemberInvite(id: string): Promise<InviteClubMemberResult> {
  const res = await apiClient.post<InviteClubMemberResult>(`/club-members/${id}/resend-invite`)
  return res.data
}
