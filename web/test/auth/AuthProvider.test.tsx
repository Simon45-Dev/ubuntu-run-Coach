import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AuthProvider, useAuth } from '@/auth/AuthProvider'

vi.mock('@/api/auth', () => ({
  refresh: vi.fn(),
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  acceptInvite: vi.fn(),
}))

import { acceptInvite, fetchMe, login, logout, refresh } from '@/api/auth'

function Probe() {
  const { ctx, status, login: doLogin, acceptInvite: doAcceptInvite, logout: doLogout } = useAuth()
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="role">{ctx?.role ?? 'none'}</span>
      <button onClick={() => void doLogin({ email: 'a@b.com', password: 'password123' })}>login</button>
      <button onClick={() => void doAcceptInvite('raw-token', 'newpassword123')}>accept-invite</button>
      <button onClick={() => void doLogout()}>logout</button>
    </div>
  )
}

describe('AuthProvider', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('starts unauthenticated when there is no valid refresh cookie', async () => {
    vi.mocked(refresh).mockResolvedValue({ accessToken: null })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    expect(screen.getByTestId('status').textContent).toBe('loading')
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'))
  })

  it('becomes authenticated after a silent refresh succeeds on boot', async () => {
    vi.mocked(refresh).mockResolvedValue({ accessToken: 'token-123' })
    vi.mocked(fetchMe).mockResolvedValue({ userId: 'u1', role: 'COACH', coachId: 'c1' })

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'))
    expect(screen.getByTestId('role').textContent).toBe('COACH')
  })

  it('logs in explicitly and then logs out, clearing the session', async () => {
    vi.mocked(refresh).mockResolvedValue({ accessToken: null })
    vi.mocked(login).mockResolvedValue({ accessToken: 'token-456' })
    vi.mocked(fetchMe).mockResolvedValue({ userId: 'u2', role: 'ATHLETE', athleteId: 'a1' })
    vi.mocked(logout).mockResolvedValue(undefined)

    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'))

    await user.click(screen.getByText('login'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'))
    expect(screen.getByTestId('role').textContent).toBe('ATHLETE')

    await user.click(screen.getByText('logout'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'))
  })

  it('accepts an invite and becomes authenticated', async () => {
    vi.mocked(refresh).mockResolvedValue({ accessToken: null })
    vi.mocked(acceptInvite).mockResolvedValue({ accessToken: 'token-789' })
    vi.mocked(fetchMe).mockResolvedValue({ userId: 'u3', role: 'ATHLETE', athleteId: 'a2' })

    const user = userEvent.setup()
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unauthenticated'))

    await user.click(screen.getByText('accept-invite'))
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'))
    expect(acceptInvite).toHaveBeenCalledWith({ token: 'raw-token', password: 'newpassword123' })
  })
})
