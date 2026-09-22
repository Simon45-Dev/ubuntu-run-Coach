import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getWorkoutResult, submitWorkoutResult } from '@/api/workouts'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/Spinner'
import { formatDate, formatDistance, formatDuration } from '@/lib/format'

// Mirrors backend SubmitWorkoutResultDto constraints.
const schema = z.object({
  actualDistanceKm: z.coerce.number().positive().optional().or(z.literal('')),
  actualDurationSec: z.coerce.number().int().positive().optional().or(z.literal('')),
  actualPace: z.string().optional(),
  avgHr: z.coerce.number().int().min(30).max(250).optional().or(z.literal('')),
  maxHr: z.coerce.number().int().min(30).max(250).optional().or(z.literal('')),
  rpe: z.coerce.number().int().min(1).max(10).optional().or(z.literal('')),
  comments: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function WorkoutResultForm({ workoutId, canEdit }: { workoutId: string; canEdit: boolean }) {
  const queryClient = useQueryClient()
  const { data: result, isLoading } = useQuery({
    queryKey: ['workout-result', workoutId],
    queryFn: () => getWorkoutResult(workoutId),
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!result) return
    reset({
      actualDistanceKm: result.actualDistanceKm ? Number(result.actualDistanceKm) : '',
      actualDurationSec: result.actualDurationSec ?? '',
      actualPace: result.actualPace ?? '',
      avgHr: result.avgHr ?? '',
      maxHr: result.maxHr ?? '',
      rpe: result.rpe ?? '',
      comments: result.comments ?? '',
    })
  }, [result, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      submitWorkoutResult(workoutId, {
        actualDistanceKm: values.actualDistanceKm === '' ? undefined : Number(values.actualDistanceKm),
        actualDurationSec: values.actualDurationSec === '' ? undefined : Number(values.actualDurationSec),
        actualPace: values.actualPace || undefined,
        avgHr: values.avgHr === '' ? undefined : Number(values.avgHr),
        maxHr: values.maxHr === '' ? undefined : Number(values.maxHr),
        rpe: values.rpe === '' ? undefined : Number(values.rpe),
        comments: values.comments || undefined,
      }),
    onSuccess: (updated) => {
      toast.success('Result saved')
      queryClient.setQueryData(['workout-result', workoutId], updated)
    },
    onError: () => toast.error('Could not save result'),
  })

  if (isLoading) return <Spinner />

  if (!canEdit) {
    if (!result) return <p className="text-sm text-navy/50">No result logged yet.</p>
    return (
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <dt className="text-navy/50">Completed</dt>
        <dd className="text-navy">{formatDate(result.completedAt)}</dd>
        <dt className="text-navy/50">Distance</dt>
        <dd className="text-navy">{formatDistance(result.actualDistanceKm)}</dd>
        <dt className="text-navy/50">Duration</dt>
        <dd className="text-navy">{formatDuration(result.actualDurationSec)}</dd>
        <dt className="text-navy/50">RPE</dt>
        <dd className="text-navy">{result.rpe ?? '-'}</dd>
        {result.comments && (
          <>
            <dt className="text-navy/50">Comments</dt>
            <dd className="text-navy">{result.comments}</dd>
          </>
        )}
      </dl>
    )
  }

  return (
    <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="actualDistanceKm">Distance (km)</Label>
          <Input id="actualDistanceKm" type="number" step="0.1" {...register('actualDistanceKm')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="actualDurationSec">Duration (sec)</Label>
          <Input id="actualDurationSec" type="number" {...register('actualDurationSec')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rpe">RPE (1-10)</Label>
          <Input id="rpe" type="number" min={1} max={10} {...register('rpe')} />
          {errors.rpe && <p className="text-sm text-status-attention">{errors.rpe.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="actualPace">Pace</Label>
          <Input id="actualPace" placeholder="e.g. 4:55/km" {...register('actualPace')} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="avgHr">Avg HR</Label>
          <Input id="avgHr" type="number" {...register('avgHr')} />
          {errors.avgHr && <p className="text-sm text-status-attention">{errors.avgHr.message}</p>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="maxHr">Max HR</Label>
          <Input id="maxHr" type="number" {...register('maxHr')} />
          {errors.maxHr && <p className="text-sm text-status-attention">{errors.maxHr.message}</p>}
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comments">How did it feel?</Label>
        <Textarea id="comments" {...register('comments')} />
      </div>
      <Button type="submit" disabled={mutation.isPending} className="self-start">
        {mutation.isPending ? 'Saving...' : result ? 'Update result' : 'Log result'}
      </Button>
    </form>
  )
}
