import { getWeekStart } from '../analytics/analytics.util';

/**
 * Pure computation, kept separate from the injectable service so it can be
 * unit-tested with plain date arrays - same reasoning as analytics.util.ts.
 */

export interface WeeklySignupEntry {
  weekStart: string;
  users: number;
  organisations: number;
}

/** Builds `weeks` UTC-Monday buckets ending at the week containing `now`. */
export function bucketWeeklySignups(
  userCreatedAts: Date[],
  organisationCreatedAts: Date[],
  weeks: number,
  now: Date,
): WeeklySignupEntry[] {
  const currentWeekStart = getWeekStart(now);
  const buckets: WeeklySignupEntry[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - i * 7);
    buckets.push({ weekStart: weekStart.toISOString(), users: 0, organisations: 0 });
  }

  const indexByWeekStart = new Map(buckets.map((bucket, index) => [bucket.weekStart, index]));

  for (const createdAt of userCreatedAts) {
    const index = indexByWeekStart.get(getWeekStart(createdAt).toISOString());
    if (index !== undefined) buckets[index].users += 1;
  }
  for (const createdAt of organisationCreatedAts) {
    const index = indexByWeekStart.get(getWeekStart(createdAt).toISOString());
    if (index !== undefined) buckets[index].organisations += 1;
  }

  return buckets;
}
