import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { deleteTemplate, getTemplate, removeTemplateWorkout, updateTemplate } from '@/api/templates'
import type { TemplateWorkout } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDistance, formatDuration } from '@/lib/format'
import { WORKOUT_TYPE_STYLES } from '@/features/plans/workoutTypeStyles'
import { TemplateWorkoutDialog } from './TemplateWorkoutDialog'
import { ApplyTemplateDialog } from './ApplyTemplateDialog'

export function TemplateDetailPage() {
  const { templateId } = useParams<{ templateId: string }>()
  const { ctx } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = ctx?.role === 'COACH' || ctx?.role === 'PLATFORM_ADMIN'

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [applyOpen, setApplyOpen] = useState(false)
  const [workoutDialog, setWorkoutDialog] = useState<{ open: boolean; workout?: TemplateWorkout }>({
    open: false,
  })

  const { data: template, isLoading } = useQuery({
    queryKey: ['template', templateId],
    queryFn: () => getTemplate(templateId!),
    enabled: !!templateId,
  })

  const renameMutation = useMutation({
    mutationFn: () => updateTemplate(templateId!, { name }),
    onSuccess: (updated) => {
      toast.success('Template renamed')
      queryClient.setQueryData(['template', templateId], updated)
      setEditingName(false)
    },
    onError: () => toast.error('Could not rename template'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteTemplate(templateId!),
    onSuccess: () => {
      toast.success('Template deleted')
      navigate('/templates')
    },
    onError: () => toast.error('Could not delete template'),
  })

  const removeWorkoutMutation = useMutation({
    mutationFn: (workoutId: string) => removeTemplateWorkout(workoutId),
    onSuccess: () => {
      toast.success('Workout removed')
      void queryClient.invalidateQueries({ queryKey: ['template', templateId] })
    },
    onError: () => toast.error('Could not remove workout'),
  })

  if (isLoading || !template) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-64" autoFocus />
            <Button size="sm" onClick={() => renameMutation.mutate()} disabled={renameMutation.isPending}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-navy">{template.name}</h1>
            {template.goal && <p className="text-sm text-navy/60">{template.goal}</p>}
            {canManage && (
              <button
                className="text-sm text-navy/50 hover:text-green"
                onClick={() => {
                  setName(template.name)
                  setEditingName(true)
                }}
              >
                Rename
              </button>
            )}
          </div>
        )}
        {canManage && (
          <div className="flex gap-2">
            <Button onClick={() => setApplyOpen(true)}>Apply template</Button>
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete template
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Workouts</CardTitle>
          {canManage && (
            <Button variant="outline" size="sm" onClick={() => setWorkoutDialog({ open: true })}>
              <Plus className="h-4 w-4" />
              Add workout
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {template.workouts.length === 0 ? (
            <EmptyState
              title="No workouts yet"
              description="Add workouts by day offset - day 0 is the plan's start date."
            />
          ) : (
            <div className="flex flex-col divide-y divide-navy/10">
              {template.workouts.map((workout) => {
                const style = WORKOUT_TYPE_STYLES[workout.type]
                return (
                  <div key={workout.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-sm font-medium text-navy/60">
                        Day {workout.dayOffset}
                      </span>
                      <span
                        className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: `${style.bg}26`, color: style.bg }}
                      >
                        {style.label}
                      </span>
                      <span className="text-sm text-navy/60">
                        {formatDistance(workout.distanceTargetKm)}
                        {workout.durationTargetSec ? ` · ${formatDuration(workout.durationTargetSec)}` : ''}
                      </span>
                    </div>
                    {canManage && (
                      <div className="flex gap-3">
                        <button
                          className="text-sm text-navy/50 hover:text-green"
                          onClick={() => setWorkoutDialog({ open: true, workout })}
                        >
                          Edit
                        </button>
                        <button
                          className="text-sm text-navy/50 hover:text-status-attention"
                          onClick={() => removeWorkoutMutation.mutate(workout.id)}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TemplateWorkoutDialog
        templateId={template.id}
        workout={workoutDialog.workout}
        open={workoutDialog.open}
        onOpenChange={(open) => setWorkoutDialog({ open })}
      />

      {canManage && (
        <ApplyTemplateDialog
          templateId={template.id}
          coachId={template.coachId}
          open={applyOpen}
          onOpenChange={setApplyOpen}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {template.name}?</DialogTitle>
            <DialogDescription>
              This deletes the template. Plans already created from it are kept, not deleted.
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
