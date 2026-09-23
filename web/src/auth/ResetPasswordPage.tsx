import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AxiosError } from 'axios'
import { useAuth } from './AuthProvider'
import logo from '@/assets/logo.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function ResetPasswordPage() {
  const { resetPassword, status } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'authenticated') {
    return <Navigate to="/" replace />
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist px-4">
        <Card className="w-full max-w-sm">
          <CardContent className="pt-6 text-center">
            <img src={logo} alt="Ubuntu Run" className="mx-auto mb-6 h-auto w-40" />
            <p className="text-sm text-navy">
              This reset link is missing its token. Request a new one from the sign-in page.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      await resetPassword(token!, password)
      navigate('/', { replace: true })
    } catch (err) {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ??
            'This reset link is invalid or has expired')
          : 'This reset link is invalid or has expired'
      setError(Array.isArray(message) ? message.join(', ') : message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <img src={logo} alt="Ubuntu Run" className="mx-auto mb-6 h-auto w-40" />
          <p className="mb-4 text-center text-sm text-navy/60">Set a new password.</p>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                required
                minLength={10}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {error && <p className="text-sm text-status-attention">{error}</p>}
            <Button type="submit" disabled={submitting} className="mt-2">
              {submitting ? 'Resetting...' : 'Reset password'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
