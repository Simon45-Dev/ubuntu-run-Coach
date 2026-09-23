import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Workout } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { formatDate, formatDistance, formatDuration } from '@/lib/format'
import { getWeekStart, getWeekWorkouts } from './planWeek'
import { WORKOUT_TYPE_STYLES } from './workoutTypeStyles'
import { WorkoutDetailDialog } from './WorkoutDetailDialog'

export function AthletePlanWeekView({
  trainingPlanId,
  workouts,
}: {
  trainingPlanId: string
  workouts: Workout[]
}) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [viewingWorkout, setViewingWorkout] = useState<Workout | null>(null)

  const weekWorkouts = getWeekWorkouts(workouts, weekStart)
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6)

  function shiftWeek(days: number) {
    const next = new Date(weekStart)
    next.setUTCDate(next.getUTCDate() + days)
    setWeekStart(next)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Button variant="outline" size="icon" onClick={() => shiftWeek(-7)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="text-sm font-medium text-navy">
          {formatDate(weekStart, 'd MMM')} – {formatDate(weekEnd, 'd MMM yyyy')}
        </p>
        <Button variant="outline" size="icon" onClick={() => shiftWeek(7)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {weekWorkouts.length === 0 ? (
        <EmptyState title="No training scheduled this week" />
      ) : (
        <div className="flex flex-col gap-2">
          {weekWorkouts.map((workout) => {
            const style = WORKOUT_TYPE_STYLES[workout.type]
            return (
              <Card
                key={workout.id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => setViewingWorkout(workout)}
              >
                <CardContent className="flex items-center justify-between gap-3 pt-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{ backgroundColor: `${style.bg}26`, color: style.bg }}
                    >
                      {style.label}
                    </span>
                    <p className="text-sm text-navy/60">{formatDate(workout.scheduledDate, 'EEEE d MMM')}</p>
                  </div>
                  <p className="text-sm text-navy/60">
                    {workout.distanceTargetKm && formatDistance(workout.distanceTargetKm)}
                    {workout.distanceTargetKm && workout.durationTargetSec && ' · '}
                    {workout.durationTargetSec && formatDuration(workout.durationTargetSec)}
                  </p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <WorkoutDetailDialog
        trainingPlanId={trainingPlanId}
        workout={viewingWorkout}
        canManage={false}
        open={!!viewingWorkout}
        onOpenChange={(open) => !open && setViewingWorkout(null)}
        onEdit={() => {}}
      />
    </div>
  )
}
