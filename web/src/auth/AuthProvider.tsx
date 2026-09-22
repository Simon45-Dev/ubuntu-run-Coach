import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchMe, login as apiLogin, logout as apiLogout, refresh as apiRefresh } from '@/api/auth'
import { getAccessToken, setAccessToken, setOnSessionExpired } from '@/api/client'
import type { AuthContext as AuthCtxType, Role } from '@/api/types'
import type { LoginInput } from '@/api/auth'

interface AuthState {
  ctx: AuthCtxType | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<AuthCtxType | null>(null)
  const [status, setStatus] = useState<AuthState['status']>('loading')

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setCtx(null)
    setStatus('unauthenticated')
  }, [])

  useEffect(() => {
    setOnSessionExpired(clearSession)
    return () => setOnSessionExpired(null)
  }, [clearSession])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const { accessToken } = await apiRefresh()
        if (!accessToken) throw new Error('no session')
        setAccessToken(accessToken)
        const me = await fetchMe()
        if (!cancelled) {
          setCtx(me)
          setStatus('authenticated')
        }
      } catch {
        if (!cancelled) {
          setAccessToken(null)
          setStatus('unauthenticated')
        }
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (input: LoginInput) => {
    const { accessToken } = await apiLogin(input)
    setAccessToken(accessToken)
    const me = await fetchMe()
    setCtx(me)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiLogout()
    } finally {
      clearSession()
    }
  }, [clearSession])

  return (
    <AuthContext.Provider value={{ ctx, status, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used within AuthProvider')
  return value
}

export function hasAccessToken(): boolean {
  return getAccessToken() !== null
}

export function isRole(role: Role | undefined, ...allowed: Role[]): boolean {
  return role !== undefined && allowed.includes(role)
}
