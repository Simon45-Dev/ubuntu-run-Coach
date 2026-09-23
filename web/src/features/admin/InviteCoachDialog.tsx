import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { inviteCoach } from '@/api/coaches'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
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

// Mirrors backend InviteCoachDto constraints.
const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  bio: z.string().optional(),
  experienceYears: z.coerce.number().int().min(0).optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export function InviteCoachDialog({
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
    mutationFn: (values: FormValues) =>
      inviteCoach(organisationId, {
        name: values.name,
        email: values.email,
        bio: values.bio || undefined,
        experienceYears: values.experienceYears === '' ? undefined : Number(values.experienceYears),
      }),
    onSuccess: (result) => {
      toast.success('Invite created')
      void queryClient.invalidateQueries({ queryKey: ['coaches', organisationId] })
      setInvite({ token: result.inviteToken, expiresAt: result.inviteTokenExpiresAt })
      reset()
      onOpenChange(false)
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not invite coach')
          : 'Could not invite coach'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite a coach</DialogTitle>
            <DialogDescription>
              They'll activate their own account once they accept the invite.
            </DialogDescription>
          </DialogHeader>
          <form
            noValidate
            onSubmit={handleSubmit((values) => mutation.mutate(values))}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} />
              {errors.name && <p className="text-sm text-status-attention">{errors.name.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-status-attention">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bio">Bio (optional)</Label>
              <Textarea id="bio" {...register('bio')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="experienceYears">Years of experience (optional)</Label>
              <Input id="experienceYears" type="number" {...register('experienceYears')} />
              {errors.experienceYears && (
                <p className="text-sm text-status-attention">{errors.experienceYears.message}</p>
              )}
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
