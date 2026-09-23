import { apiClient } from './client'
import type { Template, TemplateWorkout, TrainingPlan, TrainingPlanPhase, WorkoutType } from './types'

export interface CreateTemplateInput {
  name: string
  goal?: string
  phase?: TrainingPlanPhase
}

export async function listTemplates(coachId: string): Promise<Template[]> {
  const res = await apiClient.get<Template[]>(`/coaches/${coachId}/templates`)
  return res.data
}

export async function getTemplate(id: string): Promise<Template> {
  const res = await apiClient.get<Template>(`/templates/${id}`)
  return res.data
}

export async function createTemplate(coachId: string, input: CreateTemplateInput): Promise<Template> {
  const res = await apiClient.post<Template>(`/coaches/${coachId}/templates`, input)
  return res.data
}

export async function updateTemplate(
  id: string,
  input: Partial<CreateTemplateInput>,
): Promise<Template> {
  const res = await apiClient.patch<Template>(`/templates/${id}`, input)
  return res.data
}

export async function deleteTemplate(id: string): Promise<void> {
  await apiClient.delete(`/templates/${id}`)
}

export interface TemplateWorkoutInput {
  dayOffset: number
  type: WorkoutType
  distanceTargetKm?: number
  durationTargetSec?: number
  paceTarget?: string
  hrZoneTarget?: string
  rpeTarget?: number
  instructions?: string
}

/** Backend returns the whole template (workouts included), not just the new row. */
export async function addTemplateWorkout(
  templateId: string,
  input: TemplateWorkoutInput,
): Promise<Template> {
  const res = await apiClient.post<Template>(`/templates/${templateId}/workouts`, input)
  return res.data
}

/** Backend returns just the updated workout row here, unlike addTemplateWorkout. */
export async function updateTemplateWorkout(
  id: string,
  input: Partial<TemplateWorkoutInput>,
): Promise<TemplateWorkout> {
  const res = await apiClient.patch<TemplateWorkout>(`/template-workouts/${id}`, input)
  return res.data
}

export async function removeTemplateWorkout(id: string): Promise<void> {
  await apiClient.delete(`/template-workouts/${id}`)
}

export interface ApplyTemplateInput {
  athleteId?: string
  groupId?: string
  startDate: string
  name?: string
  endDate?: string
}

export async function applyTemplate(
  templateId: string,
  input: ApplyTemplateInput,
): Promise<TrainingPlan> {
  const res = await apiClient.post<TrainingPlan>(`/templates/${templateId}/apply`, input)
  return res.data
}
