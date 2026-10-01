import { apiClient } from './client'
import type { ClubEvent, ClubEventDetail, ClubEventResult, ClubEventResultStatus } from './types'

export async function listClubEvents(organisationId: string): Promise<ClubEvent[]> {
  const res = await apiClient.get<ClubEvent[]>(`/organisations/${organisationId}/club-events`)
  return res.data
}

export async function getClubEvent(id: string): Promise<ClubEventDetail> {
  const res = await apiClient.get<ClubEventDetail>(`/club-events/${id}`)
  return res.data
}

export interface CreateClubEventInput {
  name: string
  eventDate: string
  distance?: string
}

export async function createClubEvent(
  organisationId: string,
  input: CreateClubEventInput,
): Promise<ClubEvent> {
  const res = await apiClient.post<ClubEvent>(`/organisations/${organisationId}/club-events`, input)
  return res.data
}

export interface UpdateClubEventInput {
  name?: string
  eventDate?: string
  distance?: string
  status?: ClubEvent['status']
}

export async function updateClubEvent(id: string, input: UpdateClubEventInput): Promise<ClubEvent> {
  const res = await apiClient.patch<ClubEvent>(`/club-events/${id}`, input)
  return res.data
}

export async function deleteClubEvent(id: string): Promise<void> {
  await apiClient.delete(`/club-events/${id}`)
}

export interface CreateClubEventResultInput {
  clubMemberId: string
  finishTimeSeconds?: number
  status?: ClubEventResultStatus
}

export async function createClubEventResult(
  eventId: string,
  input: CreateClubEventResultInput,
): Promise<ClubEventResult> {
  const res = await apiClient.post<ClubEventResult>(`/club-events/${eventId}/results`, input)
  return res.data
}

export async function importClubEventResultsCsv(eventId: string, file: File): Promise<ClubEventDetail> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post<ClubEventDetail>(`/club-events/${eventId}/results/import`, formData)
  return res.data
}

export interface UpdateClubEventResultInput {
  finishTimeSeconds?: number
  status?: ClubEventResultStatus
}

export async function updateClubEventResult(
  resultId: string,
  input: UpdateClubEventResultInput,
): Promise<ClubEventResult> {
  const res = await apiClient.patch<ClubEventResult>(`/club-event-results/${resultId}`, input)
  return res.data
}

export async function deleteClubEventResult(resultId: string): Promise<void> {
  await apiClient.delete(`/club-event-results/${resultId}`)
}
