import { describe, expect, it } from 'vitest'
import { aggregateAnalytics, computePlanWeek, pickUpcomingWorkouts } from '@/features/dashboard/dashboardUtil'
import type { AnalyticsSummary, Workout } from '@/api/types'

function workout(id: string, scheduledDate: string): Workout {
  return {
    id,
    trainingPlanId: 'plan-1',
    scheduledDate,
    type: 'EASY',
    distanceTargetKm: null,
    durationTargetSec: null,
    paceTarget: null,
    hrZoneTarget: null,
    rpeTarget: null,
    instructions: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

describe('pickUpcomingWorkouts', () => {
  it('filters out past workouts and sorts the rest ascending', () => {
    const workouts = [
      workout('past', '2026-01-01T00:00:00.000Z'),
      workout('later', '2026-01-10T00:00:00.000Z'),
      workout('sooner', '2026-01-05T00:00:00.000Z'),
    ]
    const result = pickUpcomingWorkouts(workouts, new Date('2026-01-02T00:00:00.000Z'), 10)
    expect(result.map((w) => w.id)).toEqual(['sooner', 'later'])
  })

  it('respects the limit', () => {
    const workouts = [
      workout('a', '2026-01-02T00:00:00.000Z'),
      workout('b', '2026-01-03T00:00:00.000Z'),
      workout('c', '2026-01-04T00:00:00.000Z'),
    ]
    const result = pickUpcomingWorkouts(workouts, new Date('2026-01-01T00:00:00.000Z'), 2)
    expect(result.map((w) => w.id)).toEqual(['a', 'b'])
  })
})

describe('computePlanWeek', () => {
  it('returns null when the plan has no endDate', () => {
    expect(computePlanWeek('2026-01-01T00:00:00.000Z', null, new Date('2026-01-08T00:00:00.000Z'))).toBeNull()
  })

  it('returns null when the plan has not started yet', () => {
    expect(
      computePlanWeek(
        '2026-02-01T00:00:00.000Z',
        '2026-04-01T00:00:00.000Z',
        new Date('2026-01-01T00:00:00.000Z'),
      ),
    ).toBeNull()
  })

  it('computes the current week within the plan', () => {
    const result = computePlanWeek(
      '2026-01-01T00:00:00.000Z',
      '2026-03-26T00:00:00.000Z',
      new Date('2026-01-15T00:00:00.000Z'),
    )
    expect(result).toEqual({ week: 3, totalWeeks: 12 })
  })

  it('caps the week at totalWeeks once the plan has ended', () => {
    const result = computePlanWeek(
      '2026-01-01T00:00:00.000Z',
      '2026-01-15T00:00:00.000Z',
      new Date('2026-02-01T00:00:00.000Z'),
    )
    expect(result).toEqual({ week: 2, totalWeeks: 2 })
  })
})

function summary(overrides: Partial<AnalyticsSummary>): AnalyticsSummary {
  return {
    from: '2026-01-01T00:00:00.000Z',
    to: '2026-01-31T00:00:00.000Z',
    adherence: { scheduled: 0, completed: 0, rate: null },
    volume: { totalDistanceKm: 0, totalDurationSec: 0 },
    weeklyTrend: [],
    avgRpeDelta: null,
    ...overrides,
  }
}

describe('aggregateAnalytics', () => {
  it('returns a null completion rate and zero distance for an empty roster', () => {
    expect(aggregateAnalytics([])).toEqual({ avgWeeklyDistanceKm: 0, completionRate: null, weeklyTrend: [] })
  })

  it('sums matching weekStart buckets across athletes', () => {
    const a = summary({
      adherence: { scheduled: 4, completed: 2, rate: 0.5 },
      volume: { totalDistanceKm: 20, totalDurationSec: 3600 },
      weeklyTrend: [
        {
          weekStart: '2026-01-05T00:00:00.000Z',
          scheduled: 2,
          completed: 1,
          distanceKm: 10,
          durationSec: 1800,
          plannedDistanceKm: 12,
        },
      ],
    })
    const b = summary({
      adherence: { scheduled: 6, completed: 6, rate: 1 },
      volume: { totalDistanceKm: 30, totalDurationSec: 5400 },
      weeklyTrend: [
        {
          weekStart: '2026-01-05T00:00:00.000Z',
          scheduled: 3,
          completed: 3,
          distanceKm: 15,
          durationSec: 2700,
          plannedDistanceKm: 15,
        },
      ],
    })

    const result = aggregateAnalytics([a, b])

    expect(result.completionRate).toBe(0.8) // (2 + 6) / (4 + 6)
    expect(result.avgWeeklyDistanceKm).toBe(50) // (20 + 30) total across 1 combined week bucket
    expect(result.weeklyTrend).toEqual([
      {
        weekStart: '2026-01-05T00:00:00.000Z',
        scheduled: 5,
        completed: 4,
        distanceKm: 25,
        durationSec: 4500,
        plannedDistanceKm: 27,
      },
    ])
  })
})
