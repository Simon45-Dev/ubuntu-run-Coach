import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  addTemplateWorkout,
  updateTemplateWorkout,
  type TemplateWorkoutInput,
} from '@/api/templates'
import { WORKOUT_TYPES, type TemplateWorkout } from '@/api/types'
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
import { WORKOUT_TYPE_STYLES } from '@/features/plans/workoutTypeStyles'

// Mirrors backend CreateTemplateWorkoutDto/UpdateTemplateWorkoutDto constraints.
const schema = z.object({
  dayOffset: z.coerce.number().int().min(0, 'Day offset must be 0 or more'),
  type: z.enum(WORKOUT_TYPES),
  distanceTargetKm: z.coerce.number().positive().optional().or(z.literal('')),
  durationTargetSec: z.coerce.number().int().positive().optional().or(z.literal('')),
  paceTarget: z.string().optional(),
  hrZoneTarget: z.string().optional(),
  rpeTarget: z.coerce.number().int().min(1).max(10).optional().or(z.literal('')),
  instructions: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function TemplateWorkoutDialog({
  templateId,
  workout,
  open,
  onOpenChange,
}: {
  templateId: string
  workout?: TemplateWorkout
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
        dayOffset: workout.dayOffset,
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
        dayOffset: 0,
        type: 'EASY',
        distanceTargetKm: '',
        durationTargetSec: '',
        paceTarget: '',
        hrZoneTarget: '',
        rpeTarget: '',
        instructions: '',
      })
    }
  }, [open, workout, reset])

  function toInput(values: FormValues): TemplateWorkoutInput {
    return {
      dayOffset: values.dayOffset,
      type: values.type,
      distanceTargetKm: values.distanceTargetKm === '' ? undefined : Number(values.distanceTargetKm),
      durationTargetSec: values.durationTargetSec === '' ? undefined : Number(values.durationTargetSec),
      paceTarget: values.paceTarget || undefined,
      hrZoneTarget: values.hrZoneTarget || undefined,
      rpeTarget: values.rpeTarget === '' ? undefined : Number(values.rpeTarget),
      instructions: values.instructions || undefined,
    }
  }

  const mutation = useMutation<unknown, Error, FormValues>({
    mutationFn: (values: FormValues) =>
      workout
        ? updateTemplateWorkout(workout.id, toInput(values))
        : addTemplateWorkout(templateId, toInput(values)),
    onSuccess: () => {
      toast.success(workout ? 'Workout updated' : 'Workout added')
      void queryClient.invalidateQueries({ queryKey: ['template', templateId] })
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
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dayOffset">Day (from plan start)</Label>
              <Input id="dayOffset" type="number" min={0} {...register('dayOffset')} />
              {errors.dayOffset && (
                <p className="text-sm text-status-attention">{errors.dayOffset.message}</p>
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
