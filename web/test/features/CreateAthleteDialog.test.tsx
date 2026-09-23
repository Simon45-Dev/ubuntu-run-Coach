import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CreateAthleteDialog } from '@/features/roster/CreateAthleteDialog'

vi.mock('@/api/athletes', () => ({ inviteAthlete: vi.fn() }))
import { inviteAthlete } from '@/api/athletes'

function renderDialog() {
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <CreateAthleteDialog coachId="coach-1" open onOpenChange={() => {}} />
    </QueryClientProvider>,
  )
}

describe('CreateAthleteDialog', () => {
  beforeEach(() => vi.resetAllMocks())

  it('rejects an invalid email and never calls the API', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByLabelText('Name'), 'Jane Runner')
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))

    expect(await screen.findByText(/enter a valid email/i)).toBeInTheDocument()
    expect(inviteAthlete).not.toHaveBeenCalled()
  })

  it('invites the athlete (no password) and shows the invite link on success', async () => {
    vi.mocked(inviteAthlete).mockResolvedValue({
      id: 'ath-1',
      inviteToken: 'raw-token-abc',
      inviteTokenExpiresAt: '2026-12-01T00:00:00.000Z',
    } as never)
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByLabelText('Name'), 'Jane Runner')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.click(screen.getByRole('button', { name: 'Send invite' }))

    await waitFor(() =>
      expect(inviteAthlete).toHaveBeenCalledWith('coach-1', {
        name: 'Jane Runner',
        email: 'jane@example.com',
        goal: undefined,
      }),
    )

    expect(await screen.findByText('Share this invite link')).toBeInTheDocument()
    expect(screen.getByDisplayValue(/token=raw-token-abc/)).toBeInTheDocument()
  })
})
