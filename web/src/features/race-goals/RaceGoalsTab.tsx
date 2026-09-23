import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { deleteRaceGoal, listRaceGoals } from '@/api/raceGoals'
import type { RaceGoal } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { formatDate, formatDuration } from '@/lib/format'
import { RaceGoalDialog } from './RaceGoalDialog'

const statusVariant = {
  PLANNED: 'neutral',
  COMPLETED: 'good',
  DNF: 'attention',
  CANCELLED: 'inactive',
} as const

export function RaceGoalsTab({ athleteId }: { athleteId: string }) {
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<{ open: boolean; raceGoal?: RaceGoal }>({ open: false })

  const { data: raceGoals, isLoading } = useQuery({
    queryKey: ['race-goals', athleteId],
    queryFn: () => listRaceGoals(athleteId),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteRaceGoal(id),
    onSuccess: () => {
      toast.success('Race goal removed')
      void queryClient.invalidateQueries({ queryKey: ['race-goals', athleteId] })
    },
    onError: () => toast.error('Could not remove race goal'),
  })

  if (isLoading) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" />
          Add race goal
        </Button>
      </div>

      {raceGoals && raceGoals.length === 0 && (
        <EmptyState
          title="No race goals yet"
          description="Add an upcoming race to track progress toward it."
          action={<Button onClick={() => setDialog({ open: true })}>Add race goal</Button>}
        />
      )}

      <div className="flex flex-col gap-2">
        {raceGoals?.map((raceGoal) => (
          <Card key={raceGoal.id}>
            <CardContent className="flex items-center justify-between gap-3 pt-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-navy">{raceGoal.raceName}</p>
                  <Badge variant={statusVariant[raceGoal.status]}>{raceGoal.status}</Badge>
                </div>
                <p className="text-sm text-navy/60">
                  {formatDate(raceGoal.raceDate)} · {raceGoal.distance}
                  {raceGoal.targetTimeSeconds && ` · Target ${formatDuration(raceGoal.targetTimeSeconds)}`}
                  {raceGoal.actualTimeSeconds && ` · Actual ${formatDuration(raceGoal.actualTimeSeconds)}`}
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  className="text-sm text-navy/50 hover:text-green"
                  onClick={() => setDialog({ open: true, raceGoal })}
                >
                  Edit
                </button>
                <button
                  className="text-sm text-navy/50 hover:text-status-attention"
                  onClick={() => deleteMutation.mutate(raceGoal.id)}
                >
                  Remove
                </button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <RaceGoalDialog
        athleteId={athleteId}
        raceGoal={dialog.raceGoal}
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open })}
      />
    </div>
  )
}
