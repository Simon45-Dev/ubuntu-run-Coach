import { apiClient } from './client'
import type { Coach } from './types'
import type { ResendInviteResult } from './athletes'

export async function getCoach(id: string): Promise<Coach> {
  const res = await apiClient.get<Coach>(`/coaches/${id}`)
  return res.data
}

export async function listCoachesForOrganisation(organisationId: string): Promise<Coach[]> {
  const res = await apiClient.get<Coach[]>(`/organisations/${organisationId}/coaches`)
  return res.data
}

export interface InviteCoachInput {
  email: string
  name: string
  bio?: string
  experienceYears?: number
}

export interface InviteCoachResult extends Coach {
  inviteToken: string
  inviteTokenExpiresAt: string
}

export async function inviteCoach(
  organisationId: string,
  input: InviteCoachInput,
): Promise<InviteCoachResult> {
  const res = await apiClient.post<InviteCoachResult>(`/organisations/${organisationId}/coaches`, input)
  return res.data
}

export async function resendCoachInvite(coachId: string): Promise<ResendInviteResult> {
  const res = await apiClient.post<ResendInviteResult>(`/coaches/${coachId}/resend-invite`)
  return res.data
}

export async function deleteCoach(id: string): Promise<void> {
  await apiClient.delete(`/coaches/${id}`)
}

export interface UpdateCoachInput {
  bio?: string
  experienceYears?: number
  athleteLimit?: number
}

export async function updateCoach(id: string, input: UpdateCoachInput): Promise<Coach> {
  const res = await apiClient.patch<Coach>(`/coaches/${id}`, input)
  return res.data
}
