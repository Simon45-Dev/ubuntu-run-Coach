import type { Workout } from '@/api/types'

/** UTC Monday of the week containing `date` - mirrors the backend's analytics.util.ts getWeekStart. */
export function getWeekStart(date: Date): Date {
  const truncated = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = truncated.getUTCDay() // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day + 6) % 7 // Monday = 0
  truncated.setUTCDate(truncated.getUTCDate() - diffToMonday)
  return truncated
}

/** Workouts scheduled within [weekStart, weekStart + 7 days), sorted ascending. */
export function getWeekWorkouts(workouts: Workout[], weekStart: Date): Workout[] {
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)
  return workouts
    .filter((w) => {
      const d = new Date(w.scheduledDate)
      return d >= weekStart && d < weekEnd
    })
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
}
