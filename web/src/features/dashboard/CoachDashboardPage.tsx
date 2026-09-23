import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ClipboardList, MessageCircle, Users, UsersRound } from 'lucide-react'
import { getAnalyticsSummary } from '@/api/analytics'
import { listRoster } from '@/api/athletes'
import { getThread } from '@/api/messages'
import { listPlansForAthlete } from '@/api/trainingPlans'
import { getWorkoutResult, listWorkoutsForPlan } from '@/api/workouts'
import { getCurrentUser } from '@/api/users'
import type { Athlete, Message } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { formatDate, formatDistance } from '@/lib/format'
import { WORKOUT_TYPE_STYLES } from '@/features/plans/workoutTypeStyles'
import { aggregateAnalytics } from './dashboardUtil'

// Capped to bound the roster-wide fan-out below - a large roster would
// eventually want a dedicated backend aggregate endpoint (see plan notes).
const ROSTER_FANOUT_CAP = 20

async function loadTodaysTraining(athletes: Athlete[]) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const perAthlete = await Promise.all(
    athletes.map(async (athlete) => {
      const plans = await listPlansForAthlete(athlete.id)
      const active = plans.filter((p) => p.status === 'ACTIVE')
      const workoutLists = await Promise.all(active.map((p) => listWorkoutsForPlan(p.id)))
      const todays = workoutLists.flat().filter((w) => {
        const d = new Date(w.scheduledDate)
        return d >= start && d < end
      })
      return Promise.all(
        todays.map(async (workout) => ({
          athlete,
          workout,
          completed: !!(await getWorkoutResult(workout.id, athlete.id)),
        })),
      )
    }),
  )

  return perAthlete
    .flat()
    .sort((a, b) => new Date(a.workout.scheduledDate).getTime() - new Date(b.workout.scheduledDate).getTime())
}

async function loadRecentMessages(athletes: Athlete[]) {
  const results = await Promise.all(
    athletes.map(async (athlete) => {
      const thread = await getThread(athlete.user.id, 1, 1)
      const latest = thread.items[0]
      return latest ? { athlete, message: latest } : null
    }),
  )
  return results
    .filter((r): r is { athlete: Athlete; message: Message } => r !== null)
    .sort((a, b) => new Date(b.message.sentAt).getTime() - new Date(a.message.sentAt).getTime())
    .slice(0, 4)
}

async function loadPerformanceOverview(athletes: Athlete[]) {
  const summaries = await Promise.all(athletes.map((a) => getAnalyticsSummary(a.id)))
  return aggregateAnalytics(summaries)
}

export function CoachDashboardPage() {
  const { ctx } = useAuth()
  const coachId = ctx?.coachId ?? ''

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: getCurrentUser })
  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ['roster', coachId],
    queryFn: () => listRoster(coachId),
    enabled: !!coachId,
  })

  const fanoutRoster = roster?.slice(0, ROSTER_FANOUT_CAP) ?? []

  const { data: todaysTraining } = useQuery({
    queryKey: ['dashboard-today', coachId, fanoutRoster.map((a) => a.id)],
    queryFn: () => loadTodaysTraining(fanoutRoster),
    enabled: !rosterLoading && fanoutRoster.length > 0,
  })
  const { data: recentMessages } = useQuery({
    queryKey: ['dashboard-messages', coachId, fanoutRoster.map((a) => a.id)],
    queryFn: () => loadRecentMessages(fanoutRoster),
    enabled: !rosterLoading && fanoutRoster.length > 0,
  })
  const { data: performance } = useQuery({
    queryKey: ['dashboard-performance', coachId, fanoutRoster.map((a) => a.id)],
    queryFn: () => loadPerformanceOverview(fanoutRoster),
    enabled: !rosterLoading && fanoutRoster.length > 0,
  })

  if (rosterLoading) return <FullPageSpinner />

  const total = roster?.length ?? 0
  const active = roster?.filter((a) => a.user.status === 'ACTIVE').length ?? 0
  const invited = roster?.filter((a) => a.user.status === 'INVITED').length ?? 0
  const recentAthletes = [...(roster ?? [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 4)

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl bg-gradient-to-br from-forest to-green px-8 py-10 text-white">
        <h1 className="text-2xl font-bold">Coach Dashboard</h1>
        <p className="mt-1 text-white/80">
          {user ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Support. Guide. Improve.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>My Athletes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xl font-bold text-navy">{total}</p>
                  <p className="text-xs text-navy/50">Total athletes</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-navy">{active}</p>
                  <p className="text-xs text-navy/50">Active</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-navy">{invited}</p>
                  <p className="text-xs text-navy/50">Pending invite</p>
                </div>
              </div>

              {recentAthletes.length > 0 && (
                <div className="mt-6 flex flex-col gap-1">
                  <p className="mb-1 text-xs font-medium uppercase text-navy/40">Recent athletes</p>
                  {recentAthletes.map((athlete) => (
                    <Link
                      key={athlete.id}
                      to={`/athletes/${athlete.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-mist"
                    >
                      <span className="font-medium text-navy">{athlete.user.name}</span>
                      <span className="text-navy/50">{athlete.goal ?? '-'}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Today's Training</CardTitle>
            </CardHeader>
            <CardContent>
              {!todaysTraining || todaysTraining.length === 0 ? (
                <EmptyState title="Nothing scheduled today" description="No roster workouts fall on today's date." />
              ) : (
                <div className="flex flex-col gap-2">
                  {todaysTraining.map(({ athlete, workout, completed }) => (
                    <div
                      key={workout.id}
                      className="flex items-center justify-between rounded-md border border-navy/10 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-navy">{athlete.user.name}</p>
                        <p className="text-xs text-navy/50">
                          {WORKOUT_TYPE_STYLES[workout.type].label}
                          {workout.distanceTargetKm && ` · ${formatDistance(workout.distanceTargetKm)}`}
                        </p>
                      </div>
                      <Badge variant={completed ? 'good' : 'watch'}>{completed ? 'Completed' : 'Upcoming'}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Athlete Performance Overview</CardTitle>
            </CardHeader>
            <CardContent>
              {performance && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xl font-bold text-navy">{formatDistance(performance.avgWeeklyDistanceKm)}</p>
                    <p className="text-xs text-navy/50">Avg weekly distance</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-navy">
                      {performance.completionRate === null ? '-' : `${Math.round(performance.completionRate * 100)}%`}
                    </p>
                    <p className="text-xs text-navy/50">Completion rate</p>
                  </div>
                </div>
              )}
              {performance && performance.weeklyTrend.length > 0 && (
                <div className="mt-6 flex flex-col gap-2">
                  <p className="mb-1 text-xs font-medium uppercase text-navy/40">Training volume</p>
                  {performance.weeklyTrend.slice(-6).map((week) => {
                    const rate = week.scheduled === 0 ? 0 : week.completed / week.scheduled
                    return (
                      <div key={week.weekStart} className="flex items-center gap-3">
                        <p className="w-16 shrink-0 text-xs text-navy/50">{formatDate(week.weekStart, 'd MMM')}</p>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy/10">
                          <div className="h-full rounded-full bg-green" style={{ width: `${Math.round(rate * 100)}%` }} />
                        </div>
                        <p className="w-20 shrink-0 text-right text-xs text-navy/60">
                          {formatDistance(week.distanceKm)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Link to="/roster" className="flex flex-col items-start gap-2 rounded-md border border-navy/10 p-3 hover:bg-mist">
                <Users className="h-5 w-5 text-green" />
                <span className="text-sm font-medium text-navy">Athletes</span>
              </Link>
              <Link to="/groups" className="flex flex-col items-start gap-2 rounded-md border border-navy/10 p-3 hover:bg-mist">
                <UsersRound className="h-5 w-5 text-green" />
                <span className="text-sm font-medium text-navy">Groups</span>
              </Link>
              <Link to="/templates" className="flex flex-col items-start gap-2 rounded-md border border-navy/10 p-3 hover:bg-mist">
                <ClipboardList className="h-5 w-5 text-green" />
                <span className="text-sm font-medium text-navy">Templates</span>
              </Link>
              <Link to="/messages" className="flex flex-col items-start gap-2 rounded-md border border-navy/10 p-3 hover:bg-mist">
                <MessageCircle className="h-5 w-5 text-green" />
                <span className="text-sm font-medium text-navy">Messages</span>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Messages</CardTitle>
            </CardHeader>
            <CardContent>
              {!recentMessages || recentMessages.length === 0 ? (
                <p className="text-sm text-navy/50">No messages yet.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {recentMessages.map(({ athlete, message }) => (
                    <Link
                      key={athlete.id}
                      to="/messages"
                      className="flex flex-col gap-0.5 rounded-md px-2 py-1.5 hover:bg-mist"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-navy">{athlete.user.name}</span>
                        <span className="text-xs text-navy/40">{formatDate(message.sentAt, 'd MMM')}</span>
                      </div>
                      <span className="truncate text-xs text-navy/60">{message.content}</span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
