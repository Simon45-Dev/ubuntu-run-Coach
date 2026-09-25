import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { useAuth } from './AuthProvider'
import logo from '@/assets/logo.png'
import loginBackground from '@/assets/login-background.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function LoginPage() {
  const { login, status } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [needsMfa, setNeedsMfa] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password, mfaCode: mfaCode || undefined })
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Login failed')
          : 'Login failed'
      const messages = Array.isArray(message) ? message.join(', ') : message
      if (messages.toLowerCase().includes('mfa')) {
        setNeedsMfa(true)
      }
      setError(messages)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-cover bg-center px-4"
      style={{ backgroundImage: `url(${loginBackground})` }}
    >
      <p className="absolute bottom-6 left-6 text-sm font-medium text-white/90">
        Better coaching. Stronger runners. <span className="text-orange">Together.</span>
      </p>
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <img src={logo} alt="Ubuntu Run" className="mx-auto mb-6 h-auto w-40" />
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-green hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            {needsMfa && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mfaCode">Authentication code</Label>
                <Input
                  id="mfaCode"
                  inputMode="numeric"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  autoFocus
                />
              </div>
            )}
            {error && <p className="text-sm text-status-attention">{error}</p>}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
