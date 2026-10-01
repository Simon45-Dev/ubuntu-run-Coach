import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { createClubEvent } from '@/api/clubEvents'
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

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  eventDate: z.string().min(1, 'Date is required'),
  distance: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function CreateClubEventDialog({
  organisationId,
  open,
  onOpenChange,
}: {
  organisationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => createClubEvent(organisationId, values),
    onSuccess: (event) => {
      toast.success('Event created as a draft')
      void queryClient.invalidateQueries({ queryKey: ['club-events', organisationId] })
      reset()
      onOpenChange(false)
      navigate(`/events/${event.id}`)
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not create event')
          : 'Could not create event'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New club event</DialogTitle>
          <DialogDescription>
            Created as a draft - add results first, then publish when it's ready for members to see.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-name">Name</Label>
            <Input id="event-name" placeholder="e.g. Spring 10K" {...register('name')} />
            {errors.name && <p className="text-sm text-status-attention">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-date">Date</Label>
            <Input id="event-date" type="date" {...register('eventDate')} />
            {errors.eventDate && <p className="text-sm text-status-attention">{errors.eventDate.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="event-distance">Distance (optional)</Label>
            <Input id="event-distance" placeholder="e.g. 10km, Half Marathon" {...register('distance')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
