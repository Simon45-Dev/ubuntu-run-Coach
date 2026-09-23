import { describe, expect, it } from 'vitest'
import { countCheckInsInWindow, deriveInsight } from '@/features/roster/overviewUtil'
import type { CheckIn } from '@/api/types'

function checkIn(date: string): CheckIn {
  return {
    id: date,
    athleteId: 'a1',
    date,
    sleepQuality: null,
    energy: null,
    soreness: null,
    stress: null,
    motivation: null,
    pain: null,
    consentId: 'c1',
  }
}

describe('deriveInsight', () => {
  it('flags training harder than prescribed when avgRpeDelta is clearly positive', () => {
    expect(deriveInsight(0.9, 1.5)).toBe(
      'Consistently training harder than prescribed (RPE averaging 1.5 above target).',
    )
  })

  it('flags sessions feeling easier when avgRpeDelta is clearly negative', () => {
    expect(deriveInsight(0.9, -1.5)).toBe(
      'Sessions are feeling easier than prescribed (RPE averaging 1.5 below target).',
    )
  })

  it('flags low adherence when RPE delta is not notable', () => {
    expect(deriveInsight(0.5, 0.2)).toBe('Adherence has dropped below 50% in this window.')
  })

  it('returns null when nothing crosses a threshold', () => {
    expect(deriveInsight(0.9, 0.2)).toBeNull()
    expect(deriveInsight(null, null)).toBeNull()
  })
})

describe('countCheckInsInWindow', () => {
  const now = new Date('2026-09-23T12:00:00.000Z')

  it('counts only check-ins within the window', () => {
    const checkIns = [
      checkIn('2026-09-23'), // today
      checkIn('2026-09-10'), // 13 days ago
      checkIn('2026-08-01'), // well outside
    ]
    expect(countCheckInsInWindow(checkIns, 14, now)).toBe(2)
  })

  it('returns 0 for an empty list', () => {
    expect(countCheckInsInWindow([], 28, now)).toBe(0)
  })
})
