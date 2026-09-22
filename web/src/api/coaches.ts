import { apiClient } from './client'
import type { Coach } from './types'

export async function getCoach(id: string): Promise<Coach> {
  const res = await apiClient.get<Coach>(`/coaches/${id}`)
  return res.data
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
