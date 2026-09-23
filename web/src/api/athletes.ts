import { apiClient } from './client'
import type { Athlete } from './types'

export async function listRoster(coachId: string): Promise<Athlete[]> {
  const res = await apiClient.get<Athlete[]>(`/coaches/${coachId}/athletes`)
  return res.data
}

export async function getAthlete(id: string): Promise<Athlete> {
  const res = await apiClient.get<Athlete>(`/athletes/${id}`)
  return res.data
}

export interface InviteAthleteInput {
  email: string
  name: string
  goal?: string
  availability?: Record<string, unknown>
}

export interface InviteResult extends Athlete {
  inviteToken: string
  inviteTokenExpiresAt: string
}

export async function inviteAthlete(coachId: string, input: InviteAthleteInput): Promise<InviteResult> {
  const res = await apiClient.post<InviteResult>(`/coaches/${coachId}/athletes`, input)
  return res.data
}

export interface ResendInviteResult {
  inviteToken: string
  inviteTokenExpiresAt: string
}

export async function resendInvite(athleteId: string): Promise<ResendInviteResult> {
  const res = await apiClient.post<ResendInviteResult>(`/athletes/${athleteId}/resend-invite`)
  return res.data
}

export interface UpdateAthleteInput {
  goal?: string
  availability?: Record<string, unknown>
  trainingBackground?: string
  coachId?: string
}

export async function updateAthlete(id: string, input: UpdateAthleteInput): Promise<Athlete> {
  const res = await apiClient.patch<Athlete>(`/athletes/${id}`, input)
  return res.data
}

export async function deleteAthlete(id: string): Promise<void> {
  await apiClient.delete(`/athletes/${id}`)
}
