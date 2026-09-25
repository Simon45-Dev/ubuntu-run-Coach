import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { OrganisationsListPage } from '@/features/admin/OrganisationsListPage'
import type { Organisation, Paginated } from '@/api/types'

vi.mock('@/api/organisations', () => ({ listOrganisations: vi.fn(), createOrganisation: vi.fn() }))

import { listOrganisations } from '@/api/organisations'

function renderPage() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <OrganisationsListPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const organisation: Organisation = {
  id: 'org-1',
  name: 'Sample Running Co',
  type: 'SOLO',
  logoUrl: null,
  suspendedAt: null,
  suspensionReason: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function paginated(items: Organisation[]): Paginated<Organisation> {
  return { items, total: items.length, page: 1, pageSize: 20 }
}

describe('OrganisationsListPage', () => {
  it('shows an empty state when there are no organisations', async () => {
    vi.mocked(listOrganisations).mockResolvedValue(paginated([]))
    renderPage()
    await waitFor(() => expect(screen.getByText('No organisations yet')).toBeInTheDocument())
  })

  it('renders each organisation with its type', async () => {
    vi.mocked(listOrganisations).mockResolvedValue(paginated([organisation]))
    renderPage()
    await waitFor(() => expect(screen.getByText('Sample Running Co')).toBeInTheDocument())
    expect(screen.getByText('SOLO')).toBeInTheDocument()
  })
})
