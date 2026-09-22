import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { createWorkout, updateWorkout, type WorkoutInput } from '@/api/workouts'
import { WORKOUT_TYPES, type Workout } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { WORKOUT_TYPE_STYLES } from './workoutTypeStyles'

// Mirrors backend CreateWorkoutDto/UpdateWorkoutDto constraints.
const schema = z.object({
  scheduledDate: z.string().min(1, 'Date is required'),
  type: z.enum(WORKOUT_TYPES),
  distanceTargetKm: z.coerce.number().positive().optional().or(z.literal('')),
  durationTargetSec: z.coerce.number().int().positive().optional().or(z.literal('')),
  paceTarget: z.string().optional(),
  hrZoneTarget: z.string().optional(),
  rpeTarget: z.coerce.number().int().min(1).max(10).optional().or(z.literal('')),
  instructions: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function WorkoutDialog({
  trainingPlanId,
  workout,
  defaultDate,
  open,
  onOpenChange,
}: {
  trainingPlanId: string
  workout?: Workout
  defaultDate?: Date
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
    if (workout) {
      reset({
        scheduledDate: format(new Date(workout.scheduledDate), 'yyyy-MM-dd'),
        type: workout.type,
        distanceTargetKm: workout.distanceTargetKm ? Number(workout.distanceTargetKm) : '',
        durationTargetSec: workout.durationTargetSec ?? '',
        paceTarget: workout.paceTarget ?? '',
        hrZoneTarget: workout.hrZoneTarget ?? '',
        rpeTarget: workout.rpeTarget ?? '',
        instructions: workout.instructions ?? '',
      })
    } else {
      reset({
        scheduledDate: format(defaultDate ?? new Date(), 'yyyy-MM-dd'),
        type: 'EASY',
        distanceTargetKm: '',
        durationTargetSec: '',
        paceTarget: '',
        hrZoneTarget: '',
        rpeTarget: '',
        instructions: '',
      })
    }
  }, [open, workout, defaultDate, reset])

  function toInput(values: FormValues): WorkoutInput {
    return {
      scheduledDate: new Date(values.scheduledDate).toISOString(),
      type: values.type,
      distanceTargetKm: values.distanceTargetKm === '' ? undefined : Number(values.distanceTargetKm),
      durationTargetSec: values.durationTargetSec === '' ? undefined : Number(values.durationTargetSec),
      paceTarget: values.paceTarget || undefined,
      hrZoneTarget: values.hrZoneTarget || undefined,
      rpeTarget: values.rpeTarget === '' ? undefined : Number(values.rpeTarget),
      instructions: values.instructions || undefined,
    }
  }

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      workout ? updateWorkout(workout.id, toInput(values)) : createWorkout(trainingPlanId, toInput(values)),
    onSuccess: () => {
      toast.success(workout ? 'Workout updated' : 'Workout added')
      void queryClient.invalidateQueries({ queryKey: ['workouts', trainingPlanId] })
      onOpenChange(false)
    },
    onError: () => toast.error('Could not save workout'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{workout ? 'Edit workout' : 'Add workout'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="scheduledDate">Date</Label>
              <Input id="scheduledDate" type="date" {...register('scheduledDate')} />
              {errors.scheduledDate && (
                <p className="text-sm text-status-attention">{errors.scheduledDate.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Type</Label>
              <Controller
                control={control}
                name="type"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WORKOUT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {WORKOUT_TYPE_STYLES[type].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="distanceTargetKm">Distance (km)</Label>
              <Input id="distanceTargetKm" type="number" step="0.1" {...register('distanceTargetKm')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="durationTargetSec">Duration (sec)</Label>
              <Input id="durationTargetSec" type="number" {...register('durationTargetSec')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="rpeTarget">RPE (1-10)</Label>
              <Input id="rpeTarget" type="number" min={1} max={10} {...register('rpeTarget')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="paceTarget">Pace target</Label>
              <Input id="paceTarget" placeholder="e.g. 5:00/km" {...register('paceTarget')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="hrZoneTarget">HR zone target</Label>
              <Input id="hrZoneTarget" placeholder="e.g. Zone 2" {...register('hrZoneTarget')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="instructions">Instructions</Label>
            <Textarea id="instructions" {...register('instructions')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save workout'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
