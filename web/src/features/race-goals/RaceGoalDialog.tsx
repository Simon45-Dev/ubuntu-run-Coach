import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { createRaceGoal, updateRaceGoal } from '@/api/raceGoals'
import { RACE_GOAL_STATUSES, type RaceGoal } from '@/api/types'
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
  raceName: z.string().min(1, 'Race name is required'),
  raceDate: z.string().min(1, 'Race date is required'),
  distance: z.string().min(1, 'Distance is required'),
  targetTimeSeconds: z.coerce.number().int().positive().optional().or(z.literal('')),
  status: z.enum(RACE_GOAL_STATUSES).optional(),
  actualTimeSeconds: z.coerce.number().int().positive().optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export function RaceGoalDialog({
  athleteId,
  raceGoal,
  open,
  onOpenChange,
}: {
  athleteId: string
  raceGoal?: RaceGoal
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
    if (raceGoal) {
      reset({
        raceName: raceGoal.raceName,
        raceDate: format(new Date(raceGoal.raceDate), 'yyyy-MM-dd'),
        distance: raceGoal.distance,
        targetTimeSeconds: raceGoal.targetTimeSeconds ?? '',
        status: raceGoal.status,
        actualTimeSeconds: raceGoal.actualTimeSeconds ?? '',
      })
    } else {
      reset({
        raceName: '',
        raceDate: '',
        distance: '',
        targetTimeSeconds: '',
        status: undefined,
        actualTimeSeconds: '',
      })
    }
  }, [open, raceGoal, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const shared = {
        raceName: values.raceName,
        raceDate: new Date(values.raceDate).toISOString(),
        distance: values.distance,
        targetTimeSeconds: values.targetTimeSeconds === '' ? undefined : Number(values.targetTimeSeconds),
      }
      return raceGoal
        ? updateRaceGoal(raceGoal.id, {
            ...shared,
            status: values.status,
            actualTimeSeconds: values.actualTimeSeconds === '' ? undefined : Number(values.actualTimeSeconds),
          })
        : createRaceGoal(athleteId, shared)
    },
    onSuccess: () => {
      toast.success(raceGoal ? 'Race goal updated' : 'Race goal added')
      void queryClient.invalidateQueries({ queryKey: ['race-goals', athleteId] })
      onOpenChange(false)
    },
    onError: () => toast.error('Could not save race goal'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{raceGoal ? 'Edit race goal' : 'Add race goal'}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="raceName">Race name</Label>
            <Input id="raceName" placeholder="e.g. City Marathon" {...register('raceName')} />
            {errors.raceName && <p className="text-sm text-status-attention">{errors.raceName.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="raceDate">Race date</Label>
              <Input id="raceDate" type="date" {...register('raceDate')} />
              {errors.raceDate && <p className="text-sm text-status-attention">{errors.raceDate.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distance">Distance</Label>
              <Input id="distance" placeholder="e.g. Marathon, 10K" {...register('distance')} />
              {errors.distance && <p className="text-sm text-status-attention">{errors.distance.message}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="targetTimeSeconds">Target time (seconds)</Label>
            <Input id="targetTimeSeconds" type="number" {...register('targetTimeSeconds')} />
          </div>
          {raceGoal && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label>Status</Label>
                <Controller
                  control={control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RACE_GOAL_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="actualTimeSeconds">Actual time (seconds)</Label>
                <Input id="actualTimeSeconds" type="number" {...register('actualTimeSeconds')} />
              </div>
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save race goal'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
