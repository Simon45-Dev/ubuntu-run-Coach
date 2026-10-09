import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { createStandaloneResult } from '@/api/workouts'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Mirrors backend CreateStandaloneResultDto constraints.
const schema = z.object({
  completedAt: z.string().min(1, 'Date is required'),
  actualDistanceKm: z.coerce.number().positive().optional().or(z.literal('')),
  actualDurationSec: z.coerce.number().int().positive().optional().or(z.literal('')),
  actualPace: z.string().optional(),
  avgHr: z.coerce.number().int().min(30).max(250).optional().or(z.literal('')),
  maxHr: z.coerce.number().int().min(30).max(250).optional().or(z.literal('')),
  rpe: z.coerce.number().int().min(1).max(10).optional().or(z.literal('')),
  comments: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function QuickLogDialog({
  athleteId,
  open,
  onOpenChange,
}: {
  athleteId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    reset({
      completedAt: format(new Date(), 'yyyy-MM-dd'),
      actualDistanceKm: '',
      actualDurationSec: '',
      actualPace: '',
      avgHr: '',
      maxHr: '',
      rpe: '',
      comments: '',
    })
  }, [open, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createStandaloneResult(athleteId, {
        completedAt: new Date(values.completedAt).toISOString(),
        actualDistanceKm: values.actualDistanceKm === '' ? undefined : Number(values.actualDistanceKm),
        actualDurationSec: values.actualDurationSec === '' ? undefined : Number(values.actualDurationSec),
        actualPace: values.actualPace || undefined,
        avgHr: values.avgHr === '' ? undefined : Number(values.avgHr),
        maxHr: values.maxHr === '' ? undefined : Number(values.maxHr),
        rpe: values.rpe === '' ? undefined : Number(values.rpe),
        comments: values.comments || undefined,
      }),
    onSuccess: () => {
      toast.success('Run logged')
      void queryClient.invalidateQueries({ queryKey: ['athlete-results', athleteId] })
      void queryClient.invalidateQueries({ queryKey: ['analytics', athleteId] })
      onOpenChange(false)
    },
    onError: () => toast.error('Could not log run'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log a run</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="completedAt">Date</Label>
            <Input id="completedAt" type="date" {...register('completedAt')} />
            {errors.completedAt && <p className="text-sm text-status-attention">{errors.completedAt.message}</p>}
          </div>
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Logging...' : 'Log run'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
