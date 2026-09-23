import type { AnalyticsSummary, WeeklyTrendEntry, Workout } from '@/api/types'

/** Sorted, filtered to scheduledDate >= from, capped at limit. */
export function pickUpcomingWorkouts(workouts: Workout[], from: Date, limit: number): Workout[] {
  return workouts
    .filter((w) => new Date(w.scheduledDate) >= from)
    .sort((a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime())
    .slice(0, limit)
}

/** null when the plan has no endDate (no defined total) or hasn't started yet. */
export function computePlanWeek(
  startDate: string,
  endDate: string | null,
  today: Date,
): { week: number; totalWeeks: number } | null {
  if (!endDate) return null
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (end <= start || today < start) return null

  const msPerWeek = 7 * 24 * 60 * 60 * 1000
  const totalWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / msPerWeek))
  const elapsedWeeks = Math.floor((today.getTime() - start.getTime()) / msPerWeek) + 1
  return { week: Math.min(elapsedWeeks, totalWeeks), totalWeeks }
}

/** Merges several athletes' AnalyticsSummary into one roster-wide view, matching weekStart buckets. */
export function aggregateAnalytics(summaries: AnalyticsSummary[]): {
  avgWeeklyDistanceKm: number
  completionRate: number | null
  weeklyTrend: WeeklyTrendEntry[]
} {
  if (summaries.length === 0) {
    return { avgWeeklyDistanceKm: 0, completionRate: null, weeklyTrend: [] }
  }

  const buckets = new Map<string, WeeklyTrendEntry>()
  for (const summary of summaries) {
    for (const week of summary.weeklyTrend) {
      const bucket = buckets.get(week.weekStart) ?? {
        weekStart: week.weekStart,
        scheduled: 0,
        completed: 0,
        distanceKm: 0,
        durationSec: 0,
      }
      bucket.scheduled += week.scheduled
      bucket.completed += week.completed
      bucket.distanceKm += week.distanceKm
      bucket.durationSec += week.durationSec
      buckets.set(week.weekStart, bucket)
    }
  }
  const weeklyTrend = Array.from(buckets.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart))

  const totalDistanceKm = summaries.reduce((sum, s) => sum + s.volume.totalDistanceKm, 0)
  const avgWeeklyDistanceKm = buckets.size === 0 ? 0 : totalDistanceKm / buckets.size

  const scheduled = summaries.reduce((sum, s) => sum + s.adherence.scheduled, 0)
  const completed = summaries.reduce((sum, s) => sum + s.adherence.completed, 0)
  const completionRate = scheduled === 0 ? null : completed / scheduled

  return { avgWeeklyDistanceKm, completionRate, weeklyTrend }
}
