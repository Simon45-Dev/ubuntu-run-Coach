import { apiClient } from './client'
import type { WorkoutResult, Workout, WorkoutType } from './types'

export async function listWorkoutsForPlan(trainingPlanId: string): Promise<Workout[]> {
  const res = await apiClient.get<Workout[]>(`/training-plans/${trainingPlanId}/workouts`)
  return res.data
}

export async function getWorkout(id: string): Promise<Workout> {
  const res = await apiClient.get<Workout>(`/workouts/${id}`)
  return res.data
}

export interface WorkoutInput {
  scheduledDate: string
  type: WorkoutType
  distanceTargetKm?: number
  durationTargetSec?: number
  paceTarget?: string
  hrZoneTarget?: string
  rpeTarget?: number
  instructions?: string
}

export async function createWorkout(trainingPlanId: string, input: WorkoutInput): Promise<Workout> {
  const res = await apiClient.post<Workout>(`/training-plans/${trainingPlanId}/workouts`, input)
  return res.data
}

export async function updateWorkout(id: string, input: Partial<WorkoutInput>): Promise<Workout> {
  const res = await apiClient.patch<Workout>(`/workouts/${id}`, input)
  return res.data
}

export async function deleteWorkout(id: string): Promise<void> {
  await apiClient.delete(`/workouts/${id}`)
}

export interface SubmitWorkoutResultInput {
  actualDistanceKm?: number
  actualDurationSec?: number
  actualPace?: string
  avgHr?: number
  maxHr?: number
  rpe?: number
  comments?: string
  completedAt?: string
}

export async function getWorkoutResult(workoutId: string): Promise<WorkoutResult | null> {
  try {
    const res = await apiClient.get<WorkoutResult>(`/workouts/${workoutId}/result`)
    return res.data
  } catch (err: unknown) {
    if (isNotFound(err)) return null
    throw err
  }
}

export async function submitWorkoutResult(
  workoutId: string,
  input: SubmitWorkoutResultInput,
): Promise<WorkoutResult> {
  const res = await apiClient.put<WorkoutResult>(`/workouts/${workoutId}/result`, input)
  return res.data
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    (err as { response?: { status?: number } }).response?.status === 404
  )
}
