import { apiClient } from './client'
import type { Group } from './types'

export async function listGroups(coachId: string): Promise<Group[]> {
  const res = await apiClient.get<Group[]>(`/coaches/${coachId}/groups`)
  return res.data
}

export async function getGroup(id: string): Promise<Group> {
  const res = await apiClient.get<Group>(`/groups/${id}`)
  return res.data
}

export async function createGroup(coachId: string, input: { name: string }): Promise<Group> {
  const res = await apiClient.post<Group>(`/coaches/${coachId}/groups`, input)
  return res.data
}

export async function updateGroup(id: string, input: { name: string }): Promise<Group> {
  const res = await apiClient.patch<Group>(`/groups/${id}`, input)
  return res.data
}

export async function deleteGroup(id: string): Promise<void> {
  await apiClient.delete(`/groups/${id}`)
}

export async function addGroupMember(groupId: string, athleteId: string): Promise<Group> {
  const res = await apiClient.post<Group>(`/groups/${groupId}/members`, { athleteId })
  return res.data
}

export async function removeGroupMember(groupId: string, athleteId: string): Promise<Group> {
  const res = await apiClient.delete<Group>(`/groups/${groupId}/members/${athleteId}`)
  return res.data
}
