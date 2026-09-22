import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAthlete, listRoster } from '@/api/athletes'
import { useAuth } from '@/auth/AuthProvider'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { cn } from '@/lib/utils'
import { ThreadPanel } from './ThreadPanel'

export function MessagesPage() {
  const { ctx } = useAuth()

  if (ctx?.role === 'COACH' && ctx.coachId) {
    return <CoachMessages coachId={ctx.coachId} />
  }
  if (ctx?.role === 'ATHLETE' && ctx.athleteId) {
    return <AthleteMessages athleteId={ctx.athleteId} />
  }
  return <EmptyState title="Messaging isn't available for this account yet" />
}

function CoachMessages({ coachId }: { coachId: string }) {
  const [selected, setSelected] = useState<string | null>(null)
  const { data: athletes, isLoading } = useQuery({
    queryKey: ['roster', coachId],
    queryFn: () => listRoster(coachId),
  })

  if (isLoading) return <FullPageSpinner />
  if (!athletes || athletes.length === 0) {
    return <EmptyState title="No athletes yet" description="Add an athlete to your roster to start messaging." />
  }

  const active = athletes.find((a) => a.id === selected) ?? athletes[0]

  return (
    <div className="grid h-full grid-cols-[16rem_1fr] gap-4">
      <div className="flex flex-col gap-1 overflow-y-auto rounded-lg border border-navy/10 bg-white p-2">
        {athletes.map((athlete) => (
          <button
            key={athlete.id}
            onClick={() => setSelected(athlete.id)}
            className={cn(
              'rounded-md px-3 py-2 text-left text-sm font-medium transition-colors',
              athlete.id === active.id ? 'bg-green/10 text-green' : 'text-navy hover:bg-mist',
            )}
          >
            {athlete.user.name}
          </button>
        ))}
      </div>
      <ThreadPanel counterpartUserId={active.user.id} counterpartName={active.user.name} />
    </div>
  )
}

function AthleteMessages({ athleteId }: { athleteId: string }) {
  const { data: athlete, isLoading } = useQuery({
    queryKey: ['athlete', athleteId],
    queryFn: () => getAthlete(athleteId),
  })

  if (isLoading) return <FullPageSpinner />
  if (!athlete?.coach) {
    return <EmptyState title="You don't have a coach assigned yet" />
  }

  return <ThreadPanel counterpartUserId={athlete.coach.user.id} counterpartName={athlete.coach.user.name} />
}
