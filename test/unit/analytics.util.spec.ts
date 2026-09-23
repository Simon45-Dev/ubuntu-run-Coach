import { buildAnalyticsSummary, getWeekStart } from '../../src/modules/analytics/analytics.util';

describe('analytics.util', () => {
  describe('getWeekStart', () => {
    it('returns the same UTC Monday for every day within that week', () => {
      const monday = getWeekStart(new Date('2026-03-09T00:00:00.000Z')); // a Monday
      expect(monday.toISOString()).toBe('2026-03-09T00:00:00.000Z');
      expect(getWeekStart(new Date('2026-03-11T15:30:00.000Z')).toISOString()).toBe(
        monday.toISOString(),
      );
      expect(getWeekStart(new Date('2026-03-15T23:59:59.000Z')).toISOString()).toBe(
        monday.toISOString(),
      );
    });

    it('rolls a Sunday back to the Monday that started its week', () => {
      expect(getWeekStart(new Date('2026-03-08T12:00:00.000Z')).toISOString()).toBe(
        '2026-03-02T00:00:00.000Z',
      );
    });
  });

  describe('buildAnalyticsSummary', () => {
    const from = new Date('2026-03-01T00:00:00.000Z');
    const to = new Date('2026-03-31T00:00:00.000Z');

    it('computes adherence as completed/scheduled', () => {
      const workouts = [
        { id: 'w1', scheduledDate: new Date('2026-03-02T00:00:00.000Z') },
        { id: 'w2', scheduledDate: new Date('2026-03-03T00:00:00.000Z') },
        { id: 'w3', scheduledDate: new Date('2026-03-04T00:00:00.000Z') },
        { id: 'w4', scheduledDate: new Date('2026-03-05T00:00:00.000Z') },
      ];
      const results = [
        { workoutId: 'w1', actualDistanceKm: 5, actualDurationSec: 1800 },
        { workoutId: 'w2', actualDistanceKm: 10, actualDurationSec: 3600 },
        { workoutId: 'w3', actualDistanceKm: 3, actualDurationSec: 1200 },
      ];

      const summary = buildAnalyticsSummary(workouts, results, from, to);
      expect(summary.adherence).toEqual({ scheduled: 4, completed: 3, rate: 0.75 });
    });

    it('returns a null rate, not zero, when nothing was scheduled', () => {
      const summary = buildAnalyticsSummary([], [], from, to);
      expect(summary.adherence).toEqual({ scheduled: 0, completed: 0, rate: null });
    });

    it('sums distance and duration across every result', () => {
      const workouts = [
        { id: 'w1', scheduledDate: new Date('2026-03-02T00:00:00.000Z') },
        { id: 'w2', scheduledDate: new Date('2026-03-03T00:00:00.000Z') },
      ];
      const results = [
        { workoutId: 'w1', actualDistanceKm: 5.5, actualDurationSec: 1800 },
        { workoutId: 'w2', actualDistanceKm: 10.2, actualDurationSec: 3600 },
      ];

      const summary = buildAnalyticsSummary(workouts, results, from, to);
      expect(summary.volume.totalDistanceKm).toBeCloseTo(15.7);
      expect(summary.volume.totalDurationSec).toBe(5400);
    });

    it('buckets weekly trend entries into the correct UTC week, across a week boundary', () => {
      const workouts = [
        { id: 'w1', scheduledDate: new Date('2026-03-08T08:00:00.000Z') }, // Sunday, week of Mar 2
        { id: 'w2', scheduledDate: new Date('2026-03-09T08:00:00.000Z') }, // Monday, week of Mar 9
        { id: 'w3', scheduledDate: new Date('2026-03-11T08:00:00.000Z') }, // Wednesday, week of Mar 9
      ];
      const results = [
        { workoutId: 'w1', actualDistanceKm: 5, actualDurationSec: 1800 },
        { workoutId: 'w2', actualDistanceKm: 8, actualDurationSec: 2400 },
      ];

      const summary = buildAnalyticsSummary(workouts, results, from, to);
      expect(summary.weeklyTrend).toEqual([
        {
          weekStart: '2026-03-02T00:00:00.000Z',
          scheduled: 1,
          completed: 1,
          distanceKm: 5,
          durationSec: 1800,
          plannedDistanceKm: 0,
        },
        {
          weekStart: '2026-03-09T00:00:00.000Z',
          scheduled: 2,
          completed: 1,
          distanceKm: 8,
          durationSec: 2400,
          plannedDistanceKm: 0,
        },
      ]);
    });

    it('sums distanceTargetKm across every scheduled workout in a week, completed or not', () => {
      const workouts = [
        { id: 'w1', scheduledDate: new Date('2026-03-02T00:00:00.000Z'), distanceTargetKm: 8 },
        { id: 'w2', scheduledDate: new Date('2026-03-04T00:00:00.000Z'), distanceTargetKm: 5 },
        { id: 'w3', scheduledDate: new Date('2026-03-09T00:00:00.000Z'), distanceTargetKm: 10 },
      ];
      const results = [{ workoutId: 'w1', actualDistanceKm: 7.5, actualDurationSec: 1800 }];

      const summary = buildAnalyticsSummary(workouts, results, from, to);
      expect(summary.weeklyTrend[0].plannedDistanceKm).toBe(13);
      expect(summary.weeklyTrend[1].plannedDistanceKm).toBe(10);
    });

    it('computes avgRpeDelta only from workouts with both a target and an actual RPE', () => {
      const workouts = [
        { id: 'w1', scheduledDate: new Date('2026-03-02T00:00:00.000Z'), rpeTarget: 5 },
        { id: 'w2', scheduledDate: new Date('2026-03-03T00:00:00.000Z'), rpeTarget: 6 },
        { id: 'w3', scheduledDate: new Date('2026-03-04T00:00:00.000Z') }, // no rpeTarget
      ];
      const results = [
        { workoutId: 'w1', actualDistanceKm: null, actualDurationSec: null, rpe: 7 }, // +2
        { workoutId: 'w2', actualDistanceKm: null, actualDurationSec: null, rpe: 5 }, // -1
        { workoutId: 'w3', actualDistanceKm: null, actualDurationSec: null, rpe: 9 }, // excluded, no target
      ];

      const summary = buildAnalyticsSummary(workouts, results, from, to);
      expect(summary.avgRpeDelta).toBeCloseTo(0.5); // (2 + -1) / 2
    });

    it('returns a null avgRpeDelta when no workout has both a target and an actual RPE', () => {
      const summary = buildAnalyticsSummary([], [], from, to);
      expect(summary.avgRpeDelta).toBeNull();
    });
  });
});
