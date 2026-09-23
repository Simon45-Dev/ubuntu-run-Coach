import {
  detectLowReadiness,
  detectMissedTraining,
  detectPainInjury,
  detectPositiveProgress,
  detectRaceApproaching,
  detectTrainingSpike,
  sortAlerts,
  type Alert,
} from '../../src/modules/action-centre/action-centre.util';

const NOW = new Date('2026-03-15T12:00:00.000Z');
const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY_MS);
const daysFromNow = (n: number) => new Date(NOW.getTime() + n * DAY_MS);

describe('action-centre.util', () => {
  describe('detectPainInjury', () => {
    it('flags the most recent of several pain reports', () => {
      const checkIns = [
        {
          date: daysAgo(5),
          pain: 'Sore calf',
          sleepQuality: null,
          energy: null,
          soreness: null,
          stress: null,
          motivation: null,
        },
        {
          date: daysAgo(1),
          pain: 'Sharp knee pain',
          sleepQuality: null,
          energy: null,
          soreness: null,
          stress: null,
          motivation: null,
        },
      ];
      const alerts = detectPainInjury('a1', 'Alex', checkIns, NOW);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].payload?.pain).toBe('Sharp knee pain');
      expect(alerts[0].priority).toBe('HIGH');
    });

    it('ignores empty/whitespace-only pain and reports outside the 7-day window', () => {
      const checkIns = [
        {
          date: daysAgo(2),
          pain: '   ',
          sleepQuality: null,
          energy: null,
          soreness: null,
          stress: null,
          motivation: null,
        },
        {
          date: daysAgo(10),
          pain: 'Old injury',
          sleepQuality: null,
          energy: null,
          soreness: null,
          stress: null,
          motivation: null,
        },
      ];
      expect(detectPainInjury('a1', 'Alex', checkIns, NOW)).toEqual([]);
    });
  });

  describe('detectMissedTraining', () => {
    const workouts = [
      { id: 'w1', scheduledDate: daysAgo(10), type: 'EASY' },
      { id: 'w2', scheduledDate: daysAgo(5), type: 'EASY' },
      { id: 'w3', scheduledDate: daysAgo(2), type: 'EASY' },
    ];

    it('fires at exactly 2 missed, not at 1', () => {
      const oneResult = [{ workoutId: 'w1' }];
      expect(detectMissedTraining('a1', 'Alex', workouts, oneResult, NOW)).toHaveLength(1);

      const twoResults = [{ workoutId: 'w1' }, { workoutId: 'w2' }];
      expect(detectMissedTraining('a1', 'Alex', workouts, twoResults, NOW)).toEqual([]);
    });

    it('ignores REST workouts', () => {
      const withRest = [
        { id: 'w1', scheduledDate: daysAgo(10), type: 'REST' },
        { id: 'w2', scheduledDate: daysAgo(5), type: 'REST' },
        { id: 'w3', scheduledDate: daysAgo(2), type: 'EASY' },
      ];
      expect(detectMissedTraining('a1', 'Alex', withRest, [], NOW)).toEqual([]);
    });

    it('ignores workouts scheduled in the future (not yet due)', () => {
      const future = [
        { id: 'w1', scheduledDate: daysFromNow(1), type: 'EASY' },
        { id: 'w2', scheduledDate: daysFromNow(2), type: 'EASY' },
      ];
      expect(detectMissedTraining('a1', 'Alex', future, [], NOW)).toEqual([]);
    });
  });

  describe('detectLowReadiness', () => {
    function checkIn(
      daysBack: number,
      values: Partial<
        Record<'sleepQuality' | 'energy' | 'soreness' | 'stress' | 'motivation', number>
      >,
    ) {
      return {
        date: daysAgo(daysBack),
        pain: null,
        sleepQuality: values.sleepQuality ?? null,
        energy: values.energy ?? null,
        soreness: values.soreness ?? null,
        stress: values.stress ?? null,
        motivation: values.motivation ?? null,
      };
    }

    it('fires on a real decline', () => {
      const checkIns = [
        checkIn(20, { sleepQuality: 8, energy: 8 }),
        checkIn(18, { sleepQuality: 9, energy: 8 }),
        checkIn(5, { sleepQuality: 4, energy: 3 }),
        checkIn(2, { sleepQuality: 3, energy: 4 }),
      ];
      const alerts = detectLowReadiness('a1', 'Alex', checkIns, NOW);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('LOW_READINESS');
    });

    it('does not fire with insufficient data in either window', () => {
      const checkIns = [checkIn(5, { sleepQuality: 2, energy: 2 })];
      expect(detectLowReadiness('a1', 'Alex', checkIns, NOW)).toEqual([]);
    });

    it('inverts soreness/stress so higher soreness lowers the composite', () => {
      const checkIns = [
        checkIn(20, { soreness: 1, stress: 1 }),
        checkIn(18, { soreness: 1, stress: 1 }),
        checkIn(5, { soreness: 9, stress: 9 }),
        checkIn(2, { soreness: 9, stress: 9 }),
      ];
      const alerts = detectLowReadiness('a1', 'Alex', checkIns, NOW);
      expect(alerts).toHaveLength(1);
    });
  });

  describe('detectTrainingSpike', () => {
    it('fires on a real spike', () => {
      const weeklyTrend = [
        {
          weekStart: '2026-02-16T00:00:00.000Z',
          scheduled: 3,
          completed: 3,
          distanceKm: 20,
          durationSec: 0,
        },
        {
          weekStart: '2026-02-23T00:00:00.000Z',
          scheduled: 3,
          completed: 3,
          distanceKm: 22,
          durationSec: 0,
        },
        {
          weekStart: '2026-03-02T00:00:00.000Z',
          scheduled: 5,
          completed: 5,
          distanceKm: 40,
          durationSec: 0,
        },
      ];
      const alerts = detectTrainingSpike('a1', 'Alex', weeklyTrend, NOW);
      expect(alerts).toHaveLength(1);
    });

    it('does not fire with a zero baseline', () => {
      const weeklyTrend = [
        {
          weekStart: '2026-02-16T00:00:00.000Z',
          scheduled: 0,
          completed: 0,
          distanceKm: 0,
          durationSec: 0,
        },
        {
          weekStart: '2026-02-23T00:00:00.000Z',
          scheduled: 0,
          completed: 0,
          distanceKm: 0,
          durationSec: 0,
        },
        {
          weekStart: '2026-03-02T00:00:00.000Z',
          scheduled: 3,
          completed: 3,
          distanceKm: 15,
          durationSec: 0,
        },
      ];
      expect(detectTrainingSpike('a1', 'Alex', weeklyTrend, NOW)).toEqual([]);
    });

    it('does not fire with fewer than 2 baseline weeks', () => {
      const weeklyTrend = [
        {
          weekStart: '2026-02-23T00:00:00.000Z',
          scheduled: 3,
          completed: 3,
          distanceKm: 10,
          durationSec: 0,
        },
        {
          weekStart: '2026-03-02T00:00:00.000Z',
          scheduled: 5,
          completed: 5,
          distanceKm: 40,
          durationSec: 0,
        },
      ];
      expect(detectTrainingSpike('a1', 'Alex', weeklyTrend, NOW)).toEqual([]);
    });
  });

  describe('detectRaceApproaching / detectPositiveProgress', () => {
    it('flags a PLANNED race within 14 days, not one further out', () => {
      const raceGoals = [
        {
          raceName: 'Near race',
          raceDate: daysFromNow(10),
          status: 'PLANNED' as const,
          updatedAt: NOW,
        },
        {
          raceName: 'Far race',
          raceDate: daysFromNow(30),
          status: 'PLANNED' as const,
          updatedAt: NOW,
        },
      ];
      const alerts = detectRaceApproaching('a1', 'Alex', raceGoals, NOW);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].payload?.raceName).toBe('Near race');
    });

    it('flags a race COMPLETED in the last 14 days, not longer ago', () => {
      const raceGoals = [
        {
          raceName: 'Recent finish',
          raceDate: daysAgo(5),
          status: 'COMPLETED' as const,
          updatedAt: daysAgo(5),
        },
        {
          raceName: 'Old finish',
          raceDate: daysAgo(60),
          status: 'COMPLETED' as const,
          updatedAt: daysAgo(60),
        },
      ];
      const alerts = detectPositiveProgress('a1', 'Alex', raceGoals, NOW);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].payload?.raceName).toBe('Recent finish');
    });

    it('ignores non-matching statuses', () => {
      const raceGoals = [
        {
          raceName: 'Cancelled',
          raceDate: daysFromNow(5),
          status: 'CANCELLED' as const,
          updatedAt: NOW,
        },
      ];
      expect(detectRaceApproaching('a1', 'Alex', raceGoals, NOW)).toEqual([]);
      expect(detectPositiveProgress('a1', 'Alex', raceGoals, NOW)).toEqual([]);
    });
  });

  describe('sortAlerts', () => {
    it('orders HIGH before MEDIUM before LOW, ties broken by detectedAt desc', () => {
      const alerts: Alert[] = [
        {
          athleteId: 'a1',
          athleteName: 'A',
          type: 'RACE_APPROACHING',
          priority: 'LOW',
          message: '',
          detectedAt: '2026-03-10T00:00:00.000Z',
        },
        {
          athleteId: 'a2',
          athleteName: 'B',
          type: 'MISSED_TRAINING',
          priority: 'MEDIUM',
          message: '',
          detectedAt: '2026-03-11T00:00:00.000Z',
        },
        {
          athleteId: 'a3',
          athleteName: 'C',
          type: 'PAIN_INJURY',
          priority: 'HIGH',
          message: '',
          detectedAt: '2026-03-09T00:00:00.000Z',
        },
        {
          athleteId: 'a4',
          athleteName: 'D',
          type: 'RACE_APPROACHING',
          priority: 'LOW',
          message: '',
          detectedAt: '2026-03-12T00:00:00.000Z',
        },
      ];
      const sorted = sortAlerts(alerts);
      expect(sorted.map((a) => a.athleteId)).toEqual(['a3', 'a2', 'a4', 'a1']);
    });
  });
});
