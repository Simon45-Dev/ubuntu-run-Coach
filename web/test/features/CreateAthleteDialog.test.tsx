import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { CreateAthleteDialog } from '@/features/roster/CreateAthleteDialog'

vi.mock('@/api/athletes', () => ({ createAthlete: vi.fn() }))
import { createAthlete } from '@/api/athletes'

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

  it('rejects a password shorter than the backend minimum and never calls the API', async () => {
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByLabelText('Name'), 'Jane Runner')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Temporary password'), 'short')
    await user.click(screen.getByRole('button', { name: 'Add athlete' }))

    expect(await screen.findByText(/at least 10 characters/i)).toBeInTheDocument()
    expect(createAthlete).not.toHaveBeenCalled()
  })

  it('submits when all fields are valid', async () => {
    vi.mocked(createAthlete).mockResolvedValue({} as never)
    const user = userEvent.setup()
    renderDialog()

    await user.type(screen.getByLabelText('Name'), 'Jane Runner')
    await user.type(screen.getByLabelText('Email'), 'jane@example.com')
    await user.type(screen.getByLabelText('Temporary password'), 'longenoughpassword')
    await user.click(screen.getByRole('button', { name: 'Add athlete' }))

    await waitFor(() => expect(createAthlete).toHaveBeenCalledWith('coach-1', {
      name: 'Jane Runner',
      email: 'jane@example.com',
      password: 'longenoughpassword',
      goal: undefined,
    }))
  })
})
