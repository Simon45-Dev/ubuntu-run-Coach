import { describe, expect, it } from 'vitest'
import { getWeekStart, getWeekWorkouts } from '@/features/plans/planWeek'
import type { Workout } from '@/api/types'

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

describe('getWeekStart', () => {
  it('returns the same Monday for every day in that week', () => {
    const monday = new Date('2026-01-05T00:00:00.000Z') // a Monday
    expect(getWeekStart(new Date('2026-01-05T15:00:00.000Z'))).toEqual(monday)
    expect(getWeekStart(new Date('2026-01-07T00:00:00.000Z'))).toEqual(monday) // Wednesday
    expect(getWeekStart(new Date('2026-01-11T23:00:00.000Z'))).toEqual(monday) // Sunday
  })

  it('returns the following Monday for a date in the next week', () => {
    const nextMonday = new Date('2026-01-12T00:00:00.000Z')
    expect(getWeekStart(new Date('2026-01-13T10:00:00.000Z'))).toEqual(nextMonday) // the next Tuesday
  })
})

describe('getWeekWorkouts', () => {
  const weekStart = new Date('2026-01-05T00:00:00.000Z')

  it('includes workouts within the 7-day window and excludes ones outside it', () => {
    const workouts = [
      workout('before', '2026-01-04T23:00:00.000Z'),
      workout('monday', '2026-01-05T06:00:00.000Z'),
      workout('sunday', '2026-01-11T23:59:00.000Z'),
      workout('after', '2026-01-12T00:00:00.000Z'),
    ]
    const result = getWeekWorkouts(workouts, weekStart)
    expect(result.map((w) => w.id)).toEqual(['monday', 'sunday'])
  })

  it('sorts the result ascending by scheduledDate', () => {
    const workouts = [
      workout('later', '2026-01-09T00:00:00.000Z'),
      workout('sooner', '2026-01-06T00:00:00.000Z'),
    ]
    const result = getWeekWorkouts(workouts, weekStart)
    expect(result.map((w) => w.id)).toEqual(['sooner', 'later'])
  })
})
