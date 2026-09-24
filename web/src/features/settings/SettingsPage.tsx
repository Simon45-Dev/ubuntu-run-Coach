import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { disableMfa, enableMfa, verifyMfa } from '@/api/auth'
import { deleteAvatar, getCurrentUser, uploadAvatar } from '@/api/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { AvatarInitials } from '@/components/ui/avatar'
import { resolveAvatarUrl } from '@/lib/format'

const codeSchema = z.object({ code: z.string().length(6, 'Enter the 6-digit code') })
type CodeForm = z.infer<typeof codeSchema>

const AVATAR_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const AVATAR_MAX_BYTES = 5_000_000

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
  const [avatarFile, setAvatarFile] = useState<File | null>(null)

  const { data: user, isLoading } = useQuery({ queryKey: ['me'], queryFn: getCurrentUser })

  const uploadAvatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => {
      toast.success('Profile picture updated')
      setAvatarFile(null)
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not upload profile picture')),
  })

  const deleteAvatarMutation = useMutation({
    mutationFn: deleteAvatar,
    onSuccess: () => {
      toast.success('Profile picture removed')
      void queryClient.invalidateQueries({ queryKey: ['me'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not remove profile picture')),
  })

  function onAvatarFileChange(file: File | null) {
    if (file && !AVATAR_ALLOWED_TYPES.includes(file.type)) {
      toast.error('Please choose a JPEG, PNG, or WebP image')
      return
    }
    if (file && file.size > AVATAR_MAX_BYTES) {
      toast.error('Image must be smaller than 5MB')
      return
    }
    setAvatarFile(file)
  }

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
          <CardTitle>Profile picture</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <AvatarInitials name={user.name} src={resolveAvatarUrl(user.avatarUrl)} className="h-20 w-20" />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="avatar-file">Upload a new photo</Label>
              <Input
                id="avatar-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onAvatarFileChange(e.target.files?.[0] ?? null)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => uploadAvatarMutation.mutate(avatarFile!)}
              disabled={!avatarFile || uploadAvatarMutation.isPending}
              className="self-start"
            >
              {uploadAvatarMutation.isPending ? 'Uploading...' : 'Upload'}
            </Button>
            {user.avatarUrl && (
              <Button
                variant="outline"
                onClick={() => deleteAvatarMutation.mutate()}
                disabled={deleteAvatarMutation.isPending}
                className="self-start"
              >
                {deleteAvatarMutation.isPending ? 'Removing...' : 'Remove'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

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
