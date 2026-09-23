import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, type SlotInfo } from 'react-big-calendar'
import { toast } from 'sonner'
import { deletePlan, getPlan, updatePlan } from '@/api/trainingPlans'
import { listWorkoutsForPlan } from '@/api/workouts'
import type { Workout, TrainingPlanStatus } from '@/api/types'
import { TRAINING_PLAN_STATUSES } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FullPageSpinner } from '@/components/Spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { calendarLocalizer } from '@/lib/calendarLocalizer'
import { formatDate } from '@/lib/format'
import { WorkoutDialog } from './WorkoutDialog'
import { WorkoutDetailDialog } from './WorkoutDetailDialog'
import { ImportWorkoutsCsvDialog } from './ImportWorkoutsCsvDialog'
import { WORKOUT_TYPE_STYLES } from './workoutTypeStyles'
import 'react-big-calendar/lib/css/react-big-calendar.css'

const statusVariant = {
  DRAFT: 'neutral',
  ACTIVE: 'good',
  COMPLETED: 'inactive',
  ARCHIVED: 'inactive',
} as const

export function PlanDetailPage() {
  const { athleteId, groupId, planId } = useParams<{
    athleteId?: string
    groupId?: string
    planId: string
  }>()
  const parentPath = athleteId ? `/athletes/${athleteId}` : `/groups/${groupId}`
  const { ctx } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = ctx?.role === 'COACH' || ctx?.role === 'PLATFORM_ADMIN'

  const [createDate, setCreateDate] = useState<Date | null>(null)
  const [editingWorkout, setEditingWorkout] = useState<Workout | null>(null)
  const [viewingWorkout, setViewingWorkout] = useState<Workout | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const { data: plan, isLoading: planLoading } = useQuery({
    queryKey: ['training-plan', planId],
    queryFn: () => getPlan(planId!),
    enabled: !!planId,
  })

  const { data: workouts, isLoading: workoutsLoading } = useQuery({
    queryKey: ['workouts', planId],
    queryFn: () => listWorkoutsForPlan(planId!),
    enabled: !!planId,
  })

  const statusMutation = useMutation({
    mutationFn: (status: TrainingPlanStatus) => updatePlan(planId!, { status }),
    onSuccess: (updated) => {
      toast.success('Plan status updated')
      queryClient.setQueryData(['training-plan', planId], updated)
    },
    onError: () => toast.error('Could not update plan status'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deletePlan(planId!),
    onSuccess: () => {
      toast.success('Plan deleted')
      navigate(parentPath)
    },
    onError: () => toast.error('Could not delete plan'),
  })

  const events = useMemo(
    () =>
      (workouts ?? []).map((w) => {
        const date = new Date(w.scheduledDate)
        return { start: date, end: date, allDay: true, resource: w }
      }),
    [workouts],
  )

  if (planLoading || workoutsLoading || !plan) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{plan.name}</h1>
          <p className="text-sm text-navy/60">
            {formatDate(plan.startDate)} {plan.endDate ? `– ${formatDate(plan.endDate)}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canManage ? (
            <Select value={plan.status} onValueChange={(v) => statusMutation.mutate(v as TrainingPlanStatus)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAINING_PLAN_STATUSES.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={statusVariant[plan.status]}>{plan.status}</Badge>
          )}
          {canManage && (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete plan
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-navy/10 bg-white p-4">
        <Calendar
          localizer={calendarLocalizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          views={['month']}
          defaultView="month"
          style={{ height: 600 }}
          selectable={canManage}
          onSelectSlot={(slot: SlotInfo) => canManage && setCreateDate(slot.start)}
          onSelectEvent={(event) => setViewingWorkout(event.resource as Workout)}
          eventPropGetter={(event) => {
            const style = WORKOUT_TYPE_STYLES[(event.resource as Workout).type]
            return { style: { backgroundColor: style.bg, color: style.text, borderRadius: 4, border: 'none' } }
          }}
        />
      </div>

      {canManage && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateDate(new Date())}>
            Add workout
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            Import CSV
          </Button>
        </div>
      )}

      <WorkoutDialog
        trainingPlanId={planId!}
        open={!!createDate}
        defaultDate={createDate ?? undefined}
        onOpenChange={(open) => !open && setCreateDate(null)}
      />
      <WorkoutDialog
        trainingPlanId={planId!}
        workout={editingWorkout ?? undefined}
        open={!!editingWorkout}
        onOpenChange={(open) => !open && setEditingWorkout(null)}
      />
      <WorkoutDetailDialog
        trainingPlanId={planId!}
        workout={viewingWorkout}
        canManage={canManage}
        open={!!viewingWorkout}
        onOpenChange={(open) => !open && setViewingWorkout(null)}
        onEdit={() => {
          setEditingWorkout(viewingWorkout)
          setViewingWorkout(null)
        }}
      />
      <ImportWorkoutsCsvDialog trainingPlanId={planId!} open={importOpen} onOpenChange={setImportOpen} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{plan.name}"?</DialogTitle>
            <DialogDescription>
              This deletes the plan and all of its scheduled workouts. This cannot be undone from the dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
