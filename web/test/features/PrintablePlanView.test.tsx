import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { PrintablePlanView } from '@/features/plans/PrintablePlanView'
import type { TrainingPlan, Workout } from '@/api/types'

const plan: TrainingPlan = {
  id: 'plan-1',
  organisationId: 'org-1',
  coachId: 'coach-1',
  athleteId: 'athlete-1',
  groupId: null,
  name: '12-Week 10K Build',
  startDate: '2026-01-05T00:00:00.000Z',
  endDate: '2026-03-30T00:00:00.000Z',
  goal: 'Sub-50 10K',
  phase: 'BASE',
  version: 1,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function workout(overrides: Partial<Workout>): Workout {
  return {
    id: 'w',
    trainingPlanId: 'plan-1',
    scheduledDate: '2026-01-06T00:00:00.000Z',
    type: 'EASY',
    distanceTargetKm: null,
    durationTargetSec: null,
    paceTarget: null,
    hrZoneTarget: null,
    rpeTarget: null,
    instructions: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('PrintablePlanView', () => {
  it('renders one row per workout, sorted by date, with label and distance text', () => {
    const workouts = [
      workout({ id: 'w2', scheduledDate: '2026-01-10T00:00:00.000Z', type: 'TEMPO', distanceTargetKm: '8' }),
      workout({ id: 'w1', scheduledDate: '2026-01-06T00:00:00.000Z', type: 'EASY', distanceTargetKm: '5' }),
    ]

    render(<PrintablePlanView plan={plan} workouts={workouts} />)

    expect(screen.getByText('12-Week 10K Build')).toBeInTheDocument()
    const rows = screen.getAllByRole('row').slice(1) // drop the header row
    expect(rows).toHaveLength(2)
    // Earlier date (w1, Easy) comes first despite being passed second.
    expect(rows[0]).toHaveTextContent('Easy')
    expect(rows[0]).toHaveTextContent('5.00 km')
    expect(rows[1]).toHaveTextContent('Tempo')
    expect(rows[1]).toHaveTextContent('8.00 km')
  })

  it("renders a '-' placeholder for workouts with no distance target", () => {
    render(<PrintablePlanView plan={plan} workouts={[workout({ distanceTargetKm: null })]} />)
    const row = screen.getAllByRole('row')[1]
    expect(row).toHaveTextContent('-')
  })
})
