import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Trophy } from 'lucide-react'
import { listClubEvents } from '@/api/clubEvents'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CardGridSkeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { formatDate } from '@/lib/format'
import { CreateClubEventDialog } from './CreateClubEventDialog'

const STATUS_VARIANT = { DRAFT: 'inactive', PUBLISHED: 'good' } as const

export function ClubEventsListPage() {
  const { ctx } = useAuth()
  const organisationId = ctx?.organisationId ?? ''
  const isManager = ctx?.role === 'COACH' || ctx?.role === 'CLUB_ADMIN' || ctx?.role === 'PLATFORM_ADMIN'
  const [createOpen, setCreateOpen] = useState(false)

  const { data: events, isLoading } = useQuery({
    queryKey: ['club-events', organisationId],
    queryFn: () => listClubEvents(organisationId),
    enabled: !!organisationId,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Club Events</h1>
          <p className="text-sm text-navy/60">Race results and leaderboards for this club.</p>
        </div>
        {isManager && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            New event
          </Button>
        )}
      </div>

      {isLoading && <CardGridSkeleton />}

      {!isLoading && events && events.length === 0 && (
        <EmptyState
          icon={Trophy}
          title="No events yet"
          description={
            isManager
              ? 'Create an event to start publishing race results to your members.'
              : 'Nothing published yet - check back after the club\'s next event.'
          }
          action={isManager ? <Button onClick={() => setCreateOpen(true)}>New event</Button> : undefined}
        />
      )}

      {!isLoading && events && events.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((event) => (
            <Link key={event.id} to={`/events/${event.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 pt-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green/10">
                    <Trophy className="h-5 w-5 text-green" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-navy">{event.name}</p>
                      {isManager && <Badge variant={STATUS_VARIANT[event.status]}>{event.status}</Badge>}
                    </div>
                    <p className="text-sm text-navy/60">
                      {formatDate(event.eventDate)}
                      {event.distance && ` · ${event.distance}`}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {organisationId && (
        <CreateClubEventDialog organisationId={organisationId} open={createOpen} onOpenChange={setCreateOpen} />
      )}
    </div>
  )
}
