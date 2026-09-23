import { apiClient } from './client'
import type { PbSource, PersonalBest } from './types'

export interface CreatePersonalBestInput {
  distance: string
  timeSeconds: number
  achievedDate?: string
  source?: PbSource
}

export type UpdatePersonalBestInput = Partial<CreatePersonalBestInput>

export async function listPersonalBests(athleteId: string): Promise<PersonalBest[]> {
  const res = await apiClient.get<PersonalBest[]>(`/athletes/${athleteId}/personal-bests`)
  return res.data
}

export async function createPersonalBest(
  athleteId: string,
  input: CreatePersonalBestInput,
): Promise<PersonalBest> {
  const res = await apiClient.post<PersonalBest>(`/athletes/${athleteId}/personal-bests`, input)
  return res.data
}

export async function updatePersonalBest(
  id: string,
  input: UpdatePersonalBestInput,
): Promise<PersonalBest> {
  const res = await apiClient.patch<PersonalBest>(`/personal-bests/${id}`, input)
  return res.data
}

export async function deletePersonalBest(id: string): Promise<void> {
  await apiClient.delete(`/personal-bests/${id}`)
}
