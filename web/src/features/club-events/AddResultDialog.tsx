import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { createClubEventResult } from '@/api/clubEvents'
import { listClubMembers } from '@/api/clubMembers'
import { CLUB_EVENT_RESULT_STATUSES } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const RESULT_STATUS_LABELS = { FINISHED: 'Finished', DNF: 'DNF', DNS: 'DNS' } as const

/** Accepts "MM:SS" or "HH:MM:SS" - mirrors the backend's CSV-import parsing exactly. */
function parseFinishTime(raw: string): number | undefined {
  const parts = raw.split(':').map((p) => p.trim())
  if (parts.length !== 2 && parts.length !== 3) return undefined
  const numbers = parts.map(Number)
  if (numbers.some((n) => Number.isNaN(n) || n < 0)) return undefined
  const [h, m, s] = numbers.length === 3 ? numbers : [0, ...numbers]
  return h * 3600 + m * 60 + s
}

const schema = z
  .object({
    clubMemberId: z.string().min(1, 'Select a member'),
    finishTime: z.string().optional(),
    status: z.enum(CLUB_EVENT_RESULT_STATUSES),
  })
  .refine((values) => values.status !== 'FINISHED' || !!values.finishTime, {
    message: 'Finish time is required unless the result is DNF or DNS',
    path: ['finishTime'],
  })
  .refine((values) => !values.finishTime || parseFinishTime(values.finishTime) !== undefined, {
    message: 'Enter a time as MM:SS or HH:MM:SS',
    path: ['finishTime'],
  })

type FormValues = z.infer<typeof schema>

export function AddResultDialog({
  organisationId,
  eventId,
  open,
  onOpenChange,
}: {
  organisationId: string
  eventId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { status: 'FINISHED' } })
  const status = watch('status')

  const { data: members } = useQuery({
    queryKey: ['club-members', organisationId],
    queryFn: () => listClubMembers(organisationId),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createClubEventResult(eventId, {
        clubMemberId: values.clubMemberId,
        status: values.status,
        finishTimeSeconds: values.finishTime ? parseFinishTime(values.finishTime) : undefined,
      }),
    onSuccess: () => {
      toast.success('Result added')
      void queryClient.invalidateQueries({ queryKey: ['club-event', eventId] })
      reset({ status: 'FINISHED', clubMemberId: '', finishTime: '' })
      onOpenChange(false)
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not add result')
          : 'Could not add result'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a result</DialogTitle>
          <DialogDescription>Rank is calculated automatically from finish time.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="result-member">Member</Label>
            <Select onValueChange={(v) => setValue('clubMemberId', v, { shouldValidate: true })}>
              <SelectTrigger id="result-member">
                <SelectValue placeholder="Select a member" />
              </SelectTrigger>
              <SelectContent>
                {members?.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    #{member.membershipNumber} - {member.firstName} {member.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.clubMemberId && (
              <p className="text-sm text-status-attention">{errors.clubMemberId.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="result-status">Status</Label>
            <Select
              defaultValue="FINISHED"
              onValueChange={(v) => setValue('status', v as FormValues['status'], { shouldValidate: true })}
            >
              <SelectTrigger id="result-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLUB_EVENT_RESULT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {RESULT_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {status === 'FINISHED' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="result-time">Finish time</Label>
              <Input id="result-time" placeholder="MM:SS or HH:MM:SS" {...register('finishTime')} />
              {errors.finishTime && (
                <p className="text-sm text-status-attention">{errors.finishTime.message}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding...' : 'Add result'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
