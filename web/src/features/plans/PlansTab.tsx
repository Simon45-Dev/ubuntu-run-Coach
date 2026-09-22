import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { listPlansForAthlete } from '@/api/trainingPlans'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { formatDate } from '@/lib/format'
import { CreatePlanDialog } from './CreatePlanDialog'

const statusVariant = {
  DRAFT: 'neutral',
  ACTIVE: 'good',
  COMPLETED: 'inactive',
  ARCHIVED: 'inactive',
} as const

export function PlansTab({ athleteId, canManage }: { athleteId: string; canManage: boolean }) {
  const [createOpen, setCreateOpen] = useState(false)
  const { data: plans, isLoading } = useQuery({
    queryKey: ['training-plans', athleteId],
    queryFn: () => listPlansForAthlete(athleteId),
  })

  if (isLoading) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New plan
          </Button>
        </div>
      )}

      {plans && plans.length === 0 && (
        <EmptyState
          title="No training plans yet"
          description={canManage ? 'Build a plan to start scheduling workouts.' : 'Your coach hasn’t built a plan yet.'}
          action={canManage ? <Button onClick={() => setCreateOpen(true)}>New plan</Button> : undefined}
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {plans?.map((plan) => (
          <Link key={plan.id} to={`/athletes/${athleteId}/plans/${plan.id}`}>
            <Card className="transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-2 pt-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-navy">{plan.name}</p>
                  <Badge variant={statusVariant[plan.status]}>{plan.status}</Badge>
                </div>
                <p className="text-sm text-navy/60">
                  {formatDate(plan.startDate)} {plan.endDate ? `– ${formatDate(plan.endDate)}` : ''}
                </p>
                {plan.goal && <p className="text-sm text-navy/60">{plan.goal}</p>}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <CreatePlanDialog athleteId={athleteId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
