import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GroupsListPage } from '@/features/groups/GroupsListPage'
import type { Group } from '@/api/types'

vi.mock('@/api/groups', () => ({ listGroups: vi.fn() }))
vi.mock('@/auth/AuthProvider', () => ({
  useAuth: () => ({ ctx: { userId: 'u1', role: 'COACH', coachId: 'coach-1' } }),
}))

import { listGroups } from '@/api/groups'

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <GroupsListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const group: Group = {
  id: 'group-1',
  coachId: 'coach-1',
  organisationId: 'org-1',
  name: 'Tuesday Track Squad',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  memberships: [
    {
      id: 'membership-1',
      athleteId: 'ath-1',
      joinedAt: '2026-01-01T00:00:00.000Z',
      athlete: { id: 'ath-1', user: { id: 'u2', name: 'Runner One' } },
    },
  ],
}

describe('GroupsListPage', () => {
  it('shows an empty state when there are no groups', async () => {
    vi.mocked(listGroups).mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getByText('No groups yet')).toBeInTheDocument())
  })

  it('renders each group with its member count', async () => {
    vi.mocked(listGroups).mockResolvedValue([group])
    renderPage()
    await waitFor(() => expect(screen.getByText('Tuesday Track Squad')).toBeInTheDocument())
    expect(screen.getByText('1 member')).toBeInTheDocument()
  })
})
