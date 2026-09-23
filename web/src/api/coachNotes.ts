import { apiClient } from './client'
import type { CoachNote } from './types'

export async function listCoachNotes(athleteId: string): Promise<CoachNote[]> {
  const res = await apiClient.get<CoachNote[]>(`/athletes/${athleteId}/notes`)
  return res.data
}

export async function createCoachNote(athleteId: string, content: string): Promise<CoachNote> {
  const res = await apiClient.post<CoachNote>(`/athletes/${athleteId}/notes`, { content })
  return res.data
}

export async function updateCoachNote(id: string, content: string): Promise<CoachNote> {
  const res = await apiClient.patch<CoachNote>(`/notes/${id}`, { content })
  return res.data
}

export async function deleteCoachNote(id: string): Promise<void> {
  await apiClient.delete(`/notes/${id}`)
}
