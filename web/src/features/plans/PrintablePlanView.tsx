import type { TrainingPlan, Workout } from '@/api/types'
import { formatDate, formatDistance, formatDuration } from '@/lib/format'
import { WORKOUT_TYPE_STYLES } from './workoutTypeStyles'

/**
 * Rendered at all times, but only visible under the `@media print` rules in
 * index.css - letting one "Print / Export PDF" button work for either the
 * coach's on-screen calendar or the athlete's week view, since this is the
 * one layout the browser's print stylesheet always reveals. Colour is
 * dropped in favour of the workout type's text label, consistent with how
 * every other workout badge in the app already pairs colour with a label
 * rather than relying on colour alone.
 */
export function PrintablePlanView({ plan, workouts }: { plan: TrainingPlan; workouts: Workout[] }) {
  const sorted = [...workouts].sort(
    (a, b) => new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime(),
  )

  return (
    <div className="print-only">
      <h1>{plan.name}</h1>
      <p>
        {formatDate(plan.startDate)}
        {plan.endDate ? ` - ${formatDate(plan.endDate)}` : ''}
      </p>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Type</th>
            <th>Distance</th>
            <th>Duration</th>
            <th>Pace</th>
            <th>Instructions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((workout) => (
            <tr key={workout.id}>
              <td>{formatDate(workout.scheduledDate, 'EEEE d MMM yyyy')}</td>
              <td>{WORKOUT_TYPE_STYLES[workout.type].label}</td>
              <td>{workout.distanceTargetKm ? formatDistance(workout.distanceTargetKm) : '-'}</td>
              <td>{workout.durationTargetSec ? formatDuration(workout.durationTargetSec) : '-'}</td>
              <td>{workout.paceTarget ?? '-'}</td>
              <td>{workout.instructions ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
