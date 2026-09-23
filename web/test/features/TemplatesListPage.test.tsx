import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { TemplatesListPage } from '@/features/templates/TemplatesListPage'
import type { Template } from '@/api/types'

vi.mock('@/api/templates', () => ({ listTemplates: vi.fn() }))
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ ctx: { userId: 'u1', role: 'COACH', coachId: 'coach-1' } }),
}))

import { listTemplates } from '@/api/templates'

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <TemplatesListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const template: Template = {
  id: 'template-1',
  coachId: 'coach-1',
  organisationId: 'org-1',
  name: '10K Base Build',
  goal: 'Sub-50 10K',
  phase: 'BASE',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  workouts: [
    {
      id: 'tw-1',
      templateId: 'template-1',
      dayOffset: 0,
      type: 'EASY',
      distanceTargetKm: '8',
      durationTargetSec: null,
      paceTarget: null,
      hrZoneTarget: null,
      rpeTarget: null,
      instructions: null,
    },
  ],
}

describe('TemplatesListPage', () => {
  it('shows an empty state when there are no templates', async () => {
    vi.mocked(listTemplates).mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('No templates yet')).toBeInTheDocument())
  })

  it('renders each template with its goal and workout count', async () => {
    vi.mocked(listTemplates).mockResolvedValue([template])
    renderPage()
    await waitFor(() => expect(screen.getByText('10K Base Build')).toBeInTheDocument())
    expect(screen.getByText('Sub-50 10K')).toBeInTheDocument()
    expect(screen.getByText('1 workout')).toBeInTheDocument()
  })
})
