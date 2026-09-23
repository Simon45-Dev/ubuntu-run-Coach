import { apiClient } from './client'
import type { TrainingPlan, TrainingPlanPhase, TrainingPlanStatus } from './types'

export async function listPlansForAthlete(athleteId: string): Promise<TrainingPlan[]> {
  const res = await apiClient.get<TrainingPlan[]>(`/athletes/${athleteId}/training-plans`)
  return res.data
}

export async function listPlansForGroup(groupId: string): Promise<TrainingPlan[]> {
  const res = await apiClient.get<TrainingPlan[]>(`/groups/${groupId}/training-plans`)
  return res.data
}

export async function getPlan(id: string): Promise<TrainingPlan> {
  const res = await apiClient.get<TrainingPlan>(`/training-plans/${id}`)
  return res.data
}

export interface CreateTrainingPlanInput {
  name: string
  startDate: string
  endDate?: string
  goal?: string
  phase?: TrainingPlanPhase
}

export async function createPlan(
  athleteId: string,
  input: CreateTrainingPlanInput,
): Promise<TrainingPlan> {
  const res = await apiClient.post<TrainingPlan>(`/athletes/${athleteId}/training-plans`, input)
  return res.data
}

export async function createPlanForGroup(
  groupId: string,
  input: CreateTrainingPlanInput,
): Promise<TrainingPlan> {
  const res = await apiClient.post<TrainingPlan>(`/groups/${groupId}/training-plans`, input)
  return res.data
}

export interface UpdateTrainingPlanInput extends Partial<CreateTrainingPlanInput> {
  status?: TrainingPlanStatus
}

export async function updatePlan(id: string, input: UpdateTrainingPlanInput): Promise<TrainingPlan> {
  const res = await apiClient.patch<TrainingPlan>(`/training-plans/${id}`, input)
  return res.data
}

export async function deletePlan(id: string): Promise<void> {
  await apiClient.delete(`/training-plans/${id}`)
}
