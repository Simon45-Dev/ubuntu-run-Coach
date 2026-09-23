import type { CheckIn } from '@/api/types'

/**
 * Replaces the mockup's fabricated insight sentence with real, rule-based
 * thresholds (mirrors the backend's action-centre.util.ts detector
 * pattern) - shown only when a signal actually crosses a threshold, never
 * manufactured for every athlete regardless of data.
 */
export function deriveInsight(adherenceRate: number | null, avgRpeDelta: number | null): string | null {
  if (avgRpeDelta !== null && avgRpeDelta > 1) {
    return `Consistently training harder than prescribed (RPE averaging ${avgRpeDelta.toFixed(1)} above target).`
  }
  if (avgRpeDelta !== null && avgRpeDelta < -1) {
    return `Sessions are feeling easier than prescribed (RPE averaging ${Math.abs(avgRpeDelta).toFixed(1)} below target).`
  }
  if (adherenceRate !== null && adherenceRate < 0.7) {
    return `Adherence has dropped below ${Math.round(adherenceRate * 100)}% in this window.`
  }
  return null
}

/** Check-ins are ordered newest-first with no server-side date filter - counts how many of an already-fetched page fall within the last `days` days. */
export function countCheckInsInWindow(checkIns: CheckIn[], days: number, now: Date): number {
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  return checkIns.filter((c) => new Date(c.date) >= cutoff).length
}
