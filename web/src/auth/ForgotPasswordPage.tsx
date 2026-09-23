import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { forgotPassword } from '@/api/auth'
import logo from '@/assets/logo.png'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      await forgotPassword(email)
    } finally {
      // Always show the same outcome regardless of whether the request
      // succeeded or the email exists - matches the backend's constant-shape
      // response, so this UI can't be used to enumerate accounts either.
      setSubmitting(false)
      setSubmitted(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-mist px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <img src={logo} alt="Ubuntu Run" className="mx-auto mb-6 h-auto w-40" />
          {submitted ? (
            <p className="text-center text-sm text-navy">
              If that email exists, we've sent a reset link. Check your inbox.
            </p>
          ) : (
            <>
              <p className="mb-4 text-center text-sm text-navy/60">
                Enter your email and we'll send you a link to reset your password.
              </p>
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
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={submitting} className="mt-2">
                  {submitting ? 'Sending...' : 'Send reset link'}
                </Button>
              </form>
            </>
          )}
          <p className="mt-4 text-center text-sm text-navy/60">
            <Link to="/login" className="text-green hover:underline">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
