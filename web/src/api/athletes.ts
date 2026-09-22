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

export interface CreateAthleteInput {
  email: string
  password: string
  name: string
  goal?: string
  availability?: Record<string, unknown>
}

export async function createAthlete(coachId: string, input: CreateAthleteInput): Promise<Athlete> {
  const res = await apiClient.post<Athlete>(`/coaches/${coachId}/athletes`, input)
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
