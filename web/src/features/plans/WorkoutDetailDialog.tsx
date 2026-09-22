import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { deleteWorkout } from '@/api/workouts'
import type { Workout } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDate, formatDistance, formatDuration } from '@/lib/format'
import { WorkoutResultForm } from '@/features/results/WorkoutResultForm'
import { WORKOUT_TYPE_STYLES } from './workoutTypeStyles'

export function WorkoutDetailDialog({
  trainingPlanId,
  workout,
  canManage,
  open,
  onOpenChange,
  onEdit,
}: {
  trainingPlanId: string
  workout: Workout | null
  canManage: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
}) {
  const { ctx } = useAuth()
  const queryClient = useQueryClient()

  const deleteMutation = useMutation({
    mutationFn: () => deleteWorkout(workout!.id),
    onSuccess: () => {
      toast.success('Workout deleted')
      void queryClient.invalidateQueries({ queryKey: ['workouts', trainingPlanId] })
      onOpenChange(false)
    },
    onError: () => toast.error('Could not delete workout'),
  })

  if (!workout) return null
  const style = WORKOUT_TYPE_STYLES[workout.type]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formatDate(workout.scheduledDate)}
            <Badge style={{ backgroundColor: `${style.bg}26`, color: style.bg }}>{style.label}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-navy/50">Distance target</dt>
            <dd className="text-navy">{formatDistance(workout.distanceTargetKm)}</dd>
            <dt className="text-navy/50">Duration target</dt>
            <dd className="text-navy">{formatDuration(workout.durationTargetSec)}</dd>
            <dt className="text-navy/50">Pace target</dt>
            <dd className="text-navy">{workout.paceTarget ?? '-'}</dd>
            <dt className="text-navy/50">HR zone target</dt>
            <dd className="text-navy">{workout.hrZoneTarget ?? '-'}</dd>
            <dt className="text-navy/50">RPE target</dt>
            <dd className="text-navy">{workout.rpeTarget ?? '-'}</dd>
          </dl>
          {workout.instructions && (
            <div>
              <p className="text-xs font-medium uppercase text-navy/40">Instructions</p>
              <p className="text-navy">{workout.instructions}</p>
            </div>
          )}

          {canManage && (
            <div className="flex gap-2 border-t border-navy/10 pt-4">
              <Button variant="outline" size="sm" onClick={onEdit}>
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                Delete
              </Button>
            </div>
          )}

          <div className="border-t border-navy/10 pt-4">
            <p className="mb-2 text-sm font-semibold text-navy">Result</p>
            <WorkoutResultForm workoutId={workout.id} canEdit={ctx?.role === 'ATHLETE'} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
