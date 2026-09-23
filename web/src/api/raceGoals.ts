import { apiClient } from './client'
import type { RaceGoal, RaceGoalStatus } from './types'

export interface CreateRaceGoalInput {
  raceName: string
  raceDate: string
  distance: string
  targetTimeSeconds?: number
}

export interface UpdateRaceGoalInput extends Partial<CreateRaceGoalInput> {
  status?: RaceGoalStatus
  actualTimeSeconds?: number
}

export async function listRaceGoals(athleteId: string): Promise<RaceGoal[]> {
  const res = await apiClient.get<RaceGoal[]>(`/athletes/${athleteId}/race-goals`)
  return res.data
}

export async function createRaceGoal(
  athleteId: string,
  input: CreateRaceGoalInput,
): Promise<RaceGoal> {
  const res = await apiClient.post<RaceGoal>(`/athletes/${athleteId}/race-goals`, input)
  return res.data
}

export async function updateRaceGoal(id: string, input: UpdateRaceGoalInput): Promise<RaceGoal> {
  const res = await apiClient.patch<RaceGoal>(`/race-goals/${id}`, input)
  return res.data
}

export async function deleteRaceGoal(id: string): Promise<void> {
  await apiClient.delete(`/race-goals/${id}`)
}
