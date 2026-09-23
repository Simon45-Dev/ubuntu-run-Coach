import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createPersonalBest, updatePersonalBest } from '@/api/personalBests'
import { PB_SOURCES, type PersonalBest } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const schema = z.object({
  distance: z.string().min(1, 'Distance is required'),
  timeSeconds: z.coerce.number().int().positive('Enter a valid time in seconds'),
  achievedDate: z.string().optional(),
  source: z.enum(PB_SOURCES).optional(),
})

type FormValues = z.infer<typeof schema>

export function PersonalBestDialog({
  athleteId,
  personalBest,
  open,
  onOpenChange,
}: {
  athleteId: string
  personalBest?: PersonalBest
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    if (personalBest) {
      reset({
        distance: personalBest.distance,
        timeSeconds: personalBest.timeSeconds,
        achievedDate: personalBest.achievedDate ? format(new Date(personalBest.achievedDate), 'yyyy-MM-dd') : '',
        source: personalBest.source,
      })
    } else {
      reset({ distance: '', timeSeconds: undefined, achievedDate: '', source: 'SELF_REPORTED' })
    }
  }, [open, personalBest, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const shared = {
        distance: values.distance,
        timeSeconds: values.timeSeconds,
        achievedDate: values.achievedDate ? new Date(values.achievedDate).toISOString() : undefined,
        source: values.source,
      }
      return personalBest ? updatePersonalBest(personalBest.id, shared) : createPersonalBest(athleteId, shared)
    },
    onSuccess: () => {
      toast.success(personalBest ? 'Personal best updated' : 'Personal best added')
      void queryClient.invalidateQueries({ queryKey: ['personal-bests', athleteId] })
      onOpenChange(false)
    },
    onError: () => toast.error('Could not save personal best'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{personalBest ? 'Edit personal best' : 'Add personal best'}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distance">Distance</Label>
              <Input id="distance" placeholder="e.g. 5K, 10K, Marathon" {...register('distance')} />
              {errors.distance && <p className="text-sm text-status-attention">{errors.distance.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="timeSeconds">Time (seconds)</Label>
              <Input id="timeSeconds" type="number" {...register('timeSeconds')} />
              {errors.timeSeconds && (
                <p className="text-sm text-status-attention">{errors.timeSeconds.message}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="achievedDate">Achieved on (optional)</Label>
            <Input id="achievedDate" type="date" {...register('achievedDate')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Source</Label>
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Select value={field.value ?? 'SELF_REPORTED'} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PB_SOURCES.map((source) => (
                      <SelectItem key={source} value={source}>
                        {source}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save personal best'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
