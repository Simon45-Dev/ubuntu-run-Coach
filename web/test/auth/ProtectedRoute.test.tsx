import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { AuthProvider } from '@/auth/AuthProvider'
import { ProtectedRoute } from '@/auth/ProtectedRoute'

vi.mock('@/api/auth', () => ({
  refresh: vi.fn(),
  fetchMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
}))

import { fetchMe, refresh } from '@/api/auth'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<div>Dashboard home</div>} />
          </Route>
          <Route element={<ProtectedRoute allow={['COACH']} />}>
            <Route path="/roster" element={<div>Roster page</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  beforeEach(() => vi.resetAllMocks())

  it('redirects to /login when there is no session', async () => {
    vi.mocked(refresh).mockResolvedValue({ accessToken: null })
    renderAt('/')
    await waitFor(() => expect(screen.getByText('Login page')).toBeInTheDocument())
  })

  it('renders the protected page once authenticated', async () => {
    vi.mocked(refresh).mockResolvedValue({ accessToken: 'token' })
    vi.mocked(fetchMe).mockResolvedValue({ userId: 'u1', role: 'COACH', coachId: 'c1' })
    renderAt('/')
    await waitFor(() => expect(screen.getByText('Dashboard home')).toBeInTheDocument())
  })

  it('redirects away from a role-restricted route for the wrong role', async () => {
    vi.mocked(refresh).mockResolvedValue({ accessToken: 'token' })
    vi.mocked(fetchMe).mockResolvedValue({ userId: 'u1', role: 'ATHLETE', athleteId: 'a1' })
    renderAt('/roster')
    await waitFor(() => expect(screen.getByText('Dashboard home')).toBeInTheDocument())
  })
})
