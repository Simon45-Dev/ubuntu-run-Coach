/**
 * Pure computation, kept separate from the injectable service so it can be
 * unit-tested with plain fixture arrays - no DB, same reasoning
 * src/common/scope/scope-filters.ts is a standalone file rather than inline
 * in each service. Decimal fields are converted to plain numbers by the
 * caller before reaching here, so this file only ever deals with numbers.
 */

export interface AnalyticsWorkout {
  id: string;
  scheduledDate: Date;
  distanceTargetKm?: number | null;
  rpeTarget?: number | null;
}

export interface AnalyticsResult {
  workoutId: string;
  actualDistanceKm: number | null;
  actualDurationSec: number | null;
  rpe?: number | null;
}

export interface WeeklyTrendEntry {
  weekStart: string;
  scheduled: number;
  completed: number;
  distanceKm: number;
  durationSec: number;
  plannedDistanceKm: number;
}

export interface AnalyticsSummary {
  from: string;
  to: string;
  adherence: { scheduled: number; completed: number; rate: number | null };
  volume: { totalDistanceKm: number; totalDurationSec: number };
  weeklyTrend: WeeklyTrendEntry[];
  avgRpeDelta: number | null;
}

/** UTC Monday of the week containing `date`. */
export function getWeekStart(date: Date): Date {
  const truncated = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const day = truncated.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day + 6) % 7; // Monday = 0
  truncated.setUTCDate(truncated.getUTCDate() - diffToMonday);
  return truncated;
}

export function buildAnalyticsSummary(
  workouts: AnalyticsWorkout[],
  results: AnalyticsResult[],
  from: Date,
  to: Date,
): AnalyticsSummary {
  const resultByWorkoutId = new Map(results.map((r) => [r.workoutId, r]));

  const scheduled = workouts.length;
  const completed = workouts.filter((w) => resultByWorkoutId.has(w.id)).length;
  const rate = scheduled === 0 ? null : completed / scheduled;

  const totalDistanceKm = results.reduce((sum, r) => sum + (r.actualDistanceKm ?? 0), 0);
  const totalDurationSec = results.reduce((sum, r) => sum + (r.actualDurationSec ?? 0), 0);

  const rpeDeltas: number[] = [];
  for (const workout of workouts) {
    const result = resultByWorkoutId.get(workout.id);
    if (workout.rpeTarget != null && result?.rpe != null) {
      rpeDeltas.push(result.rpe - workout.rpeTarget);
    }
  }
  const avgRpeDelta =
    rpeDeltas.length === 0 ? null : rpeDeltas.reduce((sum, d) => sum + d, 0) / rpeDeltas.length;

  const weekBuckets = new Map<string, WeeklyTrendEntry>();
  for (const workout of workouts) {
    const weekStart = getWeekStart(workout.scheduledDate).toISOString();
    const bucket = weekBuckets.get(weekStart) ?? {
      weekStart,
      scheduled: 0,
      completed: 0,
      distanceKm: 0,
      durationSec: 0,
      plannedDistanceKm: 0,
    };
    bucket.scheduled += 1;
    bucket.plannedDistanceKm += workout.distanceTargetKm ?? 0;
    const result = resultByWorkoutId.get(workout.id);
    if (result) {
      bucket.completed += 1;
      bucket.distanceKm += result.actualDistanceKm ?? 0;
      bucket.durationSec += result.actualDurationSec ?? 0;
    }
    weekBuckets.set(weekStart, bucket);
  }
  const weeklyTrend = Array.from(weekBuckets.values()).sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );

  return {
    from: from.toISOString(),
    to: to.toISOString(),
    adherence: { scheduled, completed, rate },
    volume: { totalDistanceKm, totalDurationSec },
    weeklyTrend,
    avgRpeDelta,
  };
}
