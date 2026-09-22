import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RosterListPage } from '@/features/roster/RosterListPage'
import type { Athlete } from '@/api/types'

vi.mock('@/api/athletes', () => ({ listRoster: vi.fn() }))
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ ctx: { userId: 'u1', role: 'COACH', coachId: 'coach-1' } }),
}))

import { listRoster } from '@/api/athletes'

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <RosterListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const athlete: Athlete = {
  id: 'ath-1',
  userId: 'u2',
  coachId: 'coach-1',
  organisationId: 'org-1',
  goal: 'Sub-4 marathon',
  availability: null,
  trainingBackground: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  user: { id: 'u2', email: 'runner@example.com', name: 'Runner One', status: 'ACTIVE' },
  coach: null,
}

describe('RosterListPage', () => {
  it('shows an empty state when the roster has no athletes', async () => {
    vi.mocked(listRoster).mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('No athletes yet')).toBeInTheDocument())
  })

  it('renders each athlete in the roster with their status', async () => {
    vi.mocked(listRoster).mockResolvedValue([athlete])
    renderPage()
    await waitFor(() => expect(screen.getByText('Runner One')).toBeInTheDocument())
    expect(screen.getByText('runner@example.com')).toBeInTheDocument()
    expect(screen.getByText('ACTIVE')).toBeInTheDocument()
  })
})
