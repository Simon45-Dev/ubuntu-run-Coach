import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { disableMfa, enableMfa, verifyMfa } from '@/api/auth'
import { getCurrentUser } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'

const codeSchema = z.object({ code: z.string().length(6, 'Enter the 6-digit code') })
type CodeForm = z.infer<typeof codeSchema>

function errorMessage(err: unknown, fallback: string): string {
  const message =
    err instanceof AxiosError
      ? ((err.response?.data as { message?: string } | undefined)?.message ?? fallback)
      : fallback
  return Array.isArray(message) ? message.join(', ') : message
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [enrolment, setEnrolment] = useState<{ secret: string } | null>(null)

  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: getCurrentUser })

  const enableForm = useForm<CodeForm>({ resolver: zodResolver(codeSchema) })
  const disableForm = useForm<CodeForm>({ resolver: zodResolver(codeSchema) })

  const startEnrolMutation = useMutation({
    mutationFn: enableMfa,
    onSuccess: (result) => setEnrolment({ secret: result.secret }),
    onError: (err) => toast.error(errorMessage(err, 'Could not start MFA enrolment')),
  })

  const verifyMutation = useMutation({
    mutationFn: (code: string) => verifyMfa(code),
    onSuccess: () => {
      toast.success('MFA enabled')
      setEnrolment(null)
      enableForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Invalid code')),
  })

  const disableMutation = useMutation({
    mutationFn: (code: string) => disableMfa(code),
    onSuccess: () => {
      toast.success('MFA disabled')
      disableForm.reset()
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Invalid code')),
  })

  if (isLoading || !user) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-navy/60">Manage your account security.</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Two-factor authentication</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {user.mfaEnabled ? (
            <>
              <p className="text-sm text-navy/60">
                MFA is enabled on your account. Enter a current code to turn it off.
              </p>
              <form
                onSubmit={disableForm.handleSubmit((values) => disableMutation.mutate(values.code))}
                className="flex items-end gap-2"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="disable-code">Authentication code</Label>
                  <Input id="disable-code" inputMode="numeric" {...disableForm.register('code')} />
                  {disableForm.formState.errors.code && (
                    <p className="text-sm text-status-attention">{disableForm.formState.errors.code.message}</p>
                  )}
                </div>
                <Button type="submit" variant="destructive" disabled={disableMutation.isPending}>
                  {disableMutation.isPending ? 'Disabling...' : 'Disable MFA'}
                </Button>
              </form>
            </>
          ) : enrolment ? (
            <>
              <p className="text-sm text-navy/60">
                Add this key to your authenticator app (Google Authenticator, Authy, etc.), then enter the
                6-digit code it generates.
              </p>
              <p className="break-all rounded-md bg-mist px-3 py-2 font-mono text-sm text-navy">
                {enrolment.secret}
              </p>
              <form
                onSubmit={enableForm.handleSubmit((values) => verifyMutation.mutate(values.code))}
                className="flex items-end gap-2"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="verify-code">Authentication code</Label>
                  <Input id="verify-code" inputMode="numeric" autoFocus {...enableForm.register('code')} />
                  {enableForm.formState.errors.code && (
                    <p className="text-sm text-status-attention">{enableForm.formState.errors.code.message}</p>
                  )}
                </div>
                <Button type="submit" disabled={verifyMutation.isPending}>
                  {verifyMutation.isPending ? 'Confirming...' : 'Confirm'}
                </Button>
                <Button type="button" variant="outline" onClick={() => setEnrolment(null)}>
                  Cancel
                </Button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-navy/60">
                MFA is not enabled. Add an extra layer of security by requiring a code from an authenticator
                app at sign-in.
              </p>
              <Button
                onClick={() => startEnrolMutation.mutate()}
                disabled={startEnrolMutation.isPending}
                className="self-start"
              >
                {startEnrolMutation.isPending ? 'Starting...' : 'Enable MFA'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
