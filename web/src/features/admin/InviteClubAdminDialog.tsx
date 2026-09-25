import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { inviteClubAdmin } from '@/api/clubAdmins'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InviteLinkDialog } from '@/features/roster/InviteLinkDialog'

// Mirrors backend InviteClubAdminDto constraints.
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
})

type FormValues = z.infer<typeof schema>

export function InviteClubAdminDialog({
  organisationId,
  open,
  onOpenChange,
}: {
  organisationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => inviteClubAdmin(organisationId, values),
    onSuccess: (result) => {
      toast.success('Invite created')
      void queryClient.invalidateQueries({ queryKey: ['club-admins', organisationId] })
      setInvite({ token: result.inviteToken, expiresAt: result.inviteTokenExpiresAt })
      reset()
      onOpenChange(false)
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ??
            'Could not invite club admin')
          : 'Could not invite club admin'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a club admin</DialogTitle>
            <DialogDescription>
              They'll be able to manage club membership (roster, payments, reminders) for this
              organisation only - no access to athletes or coaching data.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="club-admin-name">Name</Label>
              <Input id="club-admin-name" {...register('name')} />
              {errors.name && <p className="text-sm text-status-attention">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="club-admin-email">Email</Label>
              <Input id="club-admin-email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-status-attention">{errors.email.message}</p>}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? 'Inviting...' : 'Send invite'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {invite && (
        <InviteLinkDialog
          open={!!invite}
          onOpenChange={(next) => !next && setInvite(null)}
          inviteToken={invite.token}
          expiresAt={invite.expiresAt}
        />
      )}
    </>
  )
}
