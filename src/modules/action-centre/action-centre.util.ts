import type { WeeklyTrendEntry } from '../analytics/analytics.util';

/**
 * Pure detector functions, kept separate from the injectable service so
 * each can be unit-tested with plain fixture arrays - no DB, same reasoning
 * analytics.util.ts and scope-filters.ts are standalone files. All
 * thresholds below are judgement calls, not values from the product doc -
 * tune freely.
 */

export type AlertType =
  | 'PAIN_INJURY'
  | 'MISSED_TRAINING'
  | 'LOW_READINESS'
  | 'TRAINING_SPIKE'
  | 'RACE_APPROACHING'
  | 'POSITIVE_PROGRESS';

export type AlertPriority = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Alert {
  athleteId: string;
  athleteName: string;
  type: AlertType;
  priority: AlertPriority;
  message: string;
  detectedAt: string;
  payload?: Record<string, unknown>;
}

export interface CheckInInput {
  date: Date;
  pain: string | null;
  sleepQuality: number | null;
  energy: number | null;
  soreness: number | null;
  stress: number | null;
  motivation: number | null;
}

export interface WorkoutInput {
  id: string;
  scheduledDate: Date;
  type: string;
}

export interface WorkoutResultInput {
  workoutId: string;
}

export interface RaceGoalInput {
  raceName: string;
  raceDate: Date;
  status: 'PLANNED' | 'COMPLETED' | 'DNF' | 'CANCELLED';
  updatedAt: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Most recent non-empty pain report in the last 7 days, one alert per athlete. */
export function detectPainInjury(
  athleteId: string,
  athleteName: string,
  checkIns: CheckInInput[],
  now: Date,
  windowDays = 7,
): Alert[] {
  const windowStart = new Date(now.getTime() - windowDays * DAY_MS);
  const reports = checkIns
    .filter((c) => c.date >= windowStart && c.date <= now && c.pain && c.pain.trim().length > 0)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
  if (reports.length === 0) {
    return [];
  }
  const latest = reports[0];
  return [
    {
      athleteId,
      athleteName,
      type: 'PAIN_INJURY',
      priority: 'HIGH',
      message: `Reported pain/injury: "${latest.pain}"`,
      detectedAt: latest.date.toISOString(),
      payload: { pain: latest.pain },
    },
  ];
}

/** >= threshold past-due, non-REST workouts with no submitted result in the window. */
export function detectMissedTraining(
  athleteId: string,
  athleteName: string,
  workouts: WorkoutInput[],
  results: WorkoutResultInput[],
  now: Date,
  windowDays = 14,
  threshold = 2,
): Alert[] {
  const resultWorkoutIds = new Set(results.map((r) => r.workoutId));
  const windowStart = new Date(now.getTime() - windowDays * DAY_MS);
  const missed = workouts.filter(
    (w) =>
      w.type !== 'REST' &&
      w.scheduledDate >= windowStart &&
      w.scheduledDate < now &&
      !resultWorkoutIds.has(w.id),
  );
  if (missed.length < threshold) {
    return [];
  }
  return [
    {
      athleteId,
      athleteName,
      type: 'MISSED_TRAINING',
      priority: 'MEDIUM',
      message: `${missed.length} scheduled workouts missed in the last ${windowDays} days`,
      detectedAt: now.toISOString(),
      payload: { missedCount: missed.length, workoutIds: missed.map((w) => w.id) },
    },
  ];
}

function readinessScore(c: CheckInInput): number | null {
  const parts: number[] = [];
  if (c.sleepQuality != null) parts.push(c.sleepQuality);
  if (c.energy != null) parts.push(c.energy);
  if (c.motivation != null) parts.push(c.motivation);
  if (c.soreness != null) parts.push(10 - c.soreness);
  if (c.stress != null) parts.push(10 - c.stress);
  if (parts.length === 0) return null;
  return parts.reduce((sum, v) => sum + v, 0) / parts.length;
}

/** Recent 7-day average readiness materially below the preceding 14-day baseline. */
export function detectLowReadiness(
  athleteId: string,
  athleteName: string,
  checkIns: CheckInInput[],
  now: Date,
  recentDays = 7,
  baselineDays = 14,
  minDataPoints = 2,
  dropThreshold = 1.5,
): Alert[] {
  const recentStart = new Date(now.getTime() - recentDays * DAY_MS);
  const baselineStart = new Date(recentStart.getTime() - baselineDays * DAY_MS);

  const scored = checkIns
    .map((c) => ({ date: c.date, score: readinessScore(c) }))
    .filter((c): c is { date: Date; score: number } => c.score !== null);

  const recentScores = scored.filter((c) => c.date >= recentStart && c.date <= now);
  const baselineScores = scored.filter((c) => c.date >= baselineStart && c.date < recentStart);

  if (recentScores.length < minDataPoints || baselineScores.length < minDataPoints) {
    return [];
  }

  const avg = (arr: { score: number }[]) => arr.reduce((s, x) => s + x.score, 0) / arr.length;
  const recentAvg = avg(recentScores);
  const baselineAvg = avg(baselineScores);

  if (baselineAvg - recentAvg < dropThreshold) {
    return [];
  }
  return [
    {
      athleteId,
      athleteName,
      type: 'LOW_READINESS',
      priority: 'MEDIUM',
      message: `Readiness has declined from an average of ${baselineAvg.toFixed(1)} to ${recentAvg.toFixed(1)} over the last ${recentDays} days`,
      detectedAt: now.toISOString(),
      payload: { recentAvg, baselineAvg },
    },
  ];
}

/** The most recent complete week's volume materially above the prior weeks' average. */
export function detectTrainingSpike(
  athleteId: string,
  athleteName: string,
  weeklyTrend: WeeklyTrendEntry[],
  now: Date,
  spikeMultiplier = 1.3,
  minBaselineWeeks = 2,
): Alert[] {
  const completeWeeks = weeklyTrend
    .filter((w) => new Date(w.weekStart).getTime() + 7 * DAY_MS <= now.getTime())
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  if (completeWeeks.length < minBaselineWeeks + 1) {
    return [];
  }

  const recentWeek = completeWeeks[completeWeeks.length - 1];
  const baselineWeeks = completeWeeks.slice(0, -1);
  const baselineAvg =
    baselineWeeks.reduce((sum, w) => sum + w.distanceKm, 0) / baselineWeeks.length;

  if (baselineAvg <= 0 || recentWeek.distanceKm < baselineAvg * spikeMultiplier) {
    return [];
  }
  return [
    {
      athleteId,
      athleteName,
      type: 'TRAINING_SPIKE',
      priority: 'MEDIUM',
      message: `Weekly volume (${recentWeek.distanceKm.toFixed(1)} km) is well above the recent baseline (${baselineAvg.toFixed(1)} km)`,
      detectedAt: now.toISOString(),
      payload: { recentDistanceKm: recentWeek.distanceKm, baselineDistanceKm: baselineAvg },
    },
  ];
}

/** Any PLANNED race within the next `windowDays` days. */
export function detectRaceApproaching(
  athleteId: string,
  athleteName: string,
  raceGoals: RaceGoalInput[],
  now: Date,
  windowDays = 14,
): Alert[] {
  const windowEnd = new Date(now.getTime() + windowDays * DAY_MS);
  return raceGoals
    .filter((g) => g.status === 'PLANNED' && g.raceDate >= now && g.raceDate <= windowEnd)
    .map((g) => ({
      athleteId,
      athleteName,
      type: 'RACE_APPROACHING' as const,
      priority: 'LOW' as const,
      message: `${g.raceName} is coming up on ${g.raceDate.toISOString().slice(0, 10)}`,
      detectedAt: now.toISOString(),
      payload: { raceName: g.raceName, raceDate: g.raceDate.toISOString() },
    }));
}

/** Any race marked COMPLETED in the last `windowDays` days - a milestone worth celebrating. */
export function detectPositiveProgress(
  athleteId: string,
  athleteName: string,
  raceGoals: RaceGoalInput[],
  now: Date,
  windowDays = 14,
): Alert[] {
  const windowStart = new Date(now.getTime() - windowDays * DAY_MS);
  return raceGoals
    .filter((g) => g.status === 'COMPLETED' && g.updatedAt >= windowStart && g.updatedAt <= now)
    .map((g) => ({
      athleteId,
      athleteName,
      type: 'POSITIVE_PROGRESS' as const,
      priority: 'LOW' as const,
      message: `Completed ${g.raceName}`,
      detectedAt: g.updatedAt.toISOString(),
      payload: { raceName: g.raceName },
    }));
}

const PRIORITY_ORDER: Record<AlertPriority, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function sortAlerts(alerts: Alert[]): Alert[] {
  return [...alerts].sort((a, b) => {
    const byPriority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    if (byPriority !== 0) return byPriority;
    return b.detectedAt.localeCompare(a.detectedAt);
  });
}
