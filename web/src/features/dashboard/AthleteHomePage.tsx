import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { differenceInCalendarDays } from 'date-fns'
import { getAnalyticsSummary } from '@/api/analytics'
import { getAthlete } from '@/api/athletes'
import { listRaceGoals } from '@/api/raceGoals'
import { listPlansForAthlete } from '@/api/trainingPlans'
import { listWorkoutsForPlan } from '@/api/workouts'
import { getCurrentUser } from '@/api/users'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { formatDate, formatDistance, formatDuration } from '@/lib/format'
import { WORKOUT_TYPE_STYLES } from '@/features/plans/workoutTypeStyles'
import { pickUpcomingWorkouts, computePlanWeek } from './dashboardUtil'

async function loadUpcomingWorkouts(athleteId: string) {
  const plans = await listPlansForAthlete(athleteId)
  const activePlans = plans.filter((p) => p.status === 'ACTIVE')
  const workoutLists = await Promise.all(activePlans.map((p) => listWorkoutsForPlan(p.id)))
  return { activePlans, workouts: workoutLists.flat() }
}

export function AthleteHomePage() {
  const { ctx } = useAuth()
  const athleteId = ctx?.athleteId ?? ''

  const { data: user } = useQuery({ queryKey: ['me'], queryFn: getCurrentUser })
  const { data: athlete } = useQuery({
    queryKey: ['athlete', athleteId],
    queryFn: () => getAthlete(athleteId),
    enabled: !!athleteId,
  })
  const { data: planData, isLoading: plansLoading } = useQuery({
    queryKey: ['home-workouts', athleteId],
    queryFn: () => loadUpcomingWorkouts(athleteId),
    enabled: !!athleteId,
  })
  const { data: raceGoals } = useQuery({
    queryKey: ['race-goals', athleteId],
    queryFn: () => listRaceGoals(athleteId),
    enabled: !!athleteId,
  })
  const { data: analytics } = useQuery({
    queryKey: ['analytics', athleteId],
    queryFn: () => getAnalyticsSummary(athleteId),
    enabled: !!athleteId,
  })

  if (plansLoading) return <FullPageSpinner />

  const now = new Date()
  const upcoming = planData ? pickUpcomingWorkouts(planData.workouts, now, 4) : []
  const todayWorkout = upcoming[0]
  const nextSessions = upcoming.slice(1, 4)

  const nextGoal = raceGoals
    ?.filter((g) => g.status === 'PLANNED' && new Date(g.raceDate) >= now)
    .sort((a, b) => new Date(a.raceDate).getTime() - new Date(b.raceDate).getTime())[0]
  const goalPlan = planData?.activePlans[0]
  const planWeek = goalPlan ? computePlanWeek(goalPlan.startDate, goalPlan.endDate, now) : null

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl bg-gradient-to-br from-forest to-green px-8 py-10 text-white">
        <h1 className="text-2xl font-bold">Welcome back{user ? `, ${user.name.split(' ')[0]}` : ''}!</h1>
        <p className="mt-1 text-white/80">Better coaching. Stronger runners. Together.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Today's Training</CardTitle>
            </CardHeader>
            <CardContent>
              {todayWorkout ? (
                <div className="flex flex-col gap-3">
                  <p className="text-lg font-semibold text-navy">{WORKOUT_TYPE_STYLES[todayWorkout.type].label}</p>
                  <p className="text-sm text-navy/60">
                    {formatDate(todayWorkout.scheduledDate, 'd MMM yyyy')}
                    {todayWorkout.distanceTargetKm && ` · ${formatDistance(todayWorkout.distanceTargetKm)}`}
                    {todayWorkout.durationTargetSec && ` · ${formatDuration(todayWorkout.durationTargetSec)}`}
                  </p>
                  <Link to={`/athletes/${athleteId}/plans/${todayWorkout.trainingPlanId}`}>
                    <Button>View Full Plan</Button>
                  </Link>
                </div>
              ) : (
                <EmptyState title="No training scheduled" description="Nothing upcoming on your active plan yet." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xl font-bold text-navy">{formatDistance(analytics.volume.totalDistanceKm)}</p>
                    <p className="text-xs text-navy/50">Total distance</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-navy">{formatDuration(analytics.volume.totalDurationSec)}</p>
                    <p className="text-xs text-navy/50">Total time</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-navy">
                      {analytics.adherence.rate === null ? '-' : `${Math.round(analytics.adherence.rate * 100)}%`}
                    </p>
                    <p className="text-xs text-navy/50">Completion rate</p>
                  </div>
                </div>
              )}
              {analytics && analytics.weeklyTrend.length > 0 && (
                <div className="mt-6 flex flex-col gap-2">
                  {analytics.weeklyTrend.slice(-6).map((week) => {
                    const rate = week.scheduled === 0 ? 0 : week.completed / week.scheduled
                    return (
                      <div key={week.weekStart} className="flex items-center gap-3">
                        <p className="w-16 shrink-0 text-xs text-navy/50">{formatDate(week.weekStart, 'd MMM')}</p>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy/10">
                          <div className="h-full rounded-full bg-green" style={{ width: `${Math.round(rate * 100)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {nextSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Upcoming Sessions</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {nextSessions.map((session) => (
                  <Link
                    key={session.id}
                    to={`/athletes/${athleteId}/plans/${session.trainingPlanId}`}
                    className="flex items-center justify-between rounded-md border border-navy/10 px-3 py-2 hover:bg-mist"
                  >
                    <div>
                      <p className="text-sm font-medium text-navy">{WORKOUT_TYPE_STYLES[session.type].label}</p>
                      <p className="text-xs text-navy/50">{formatDate(session.scheduledDate, 'EEE d MMM')}</p>
                    </div>
                    {session.distanceTargetKm && (
                      <p className="text-sm text-navy/60">{formatDistance(session.distanceTargetKm)}</p>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Your Goal</CardTitle>
            </CardHeader>
            <CardContent>
              {nextGoal ? (
                <div className="flex flex-col gap-2">
                  <p className="text-lg font-semibold text-navy">{nextGoal.raceName}</p>
                  <p className="text-sm text-navy/60">
                    {formatDate(nextGoal.raceDate)} · {differenceInCalendarDays(new Date(nextGoal.raceDate), now)}{' '}
                    days to go
                  </p>
                  {planWeek && (
                    <div className="mt-2">
                      <div className="h-2 overflow-hidden rounded-full bg-navy/10">
                        <div
                          className="h-full rounded-full bg-green"
                          style={{ width: `${Math.round((planWeek.week / planWeek.totalWeeks) * 100)}%` }}
                        />
                      </div>
                      <p className="mt-1 text-xs text-navy/50">
                        Week {planWeek.week} of {planWeek.totalWeeks}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <EmptyState title="No upcoming race goal" description="Add one from the Race Goals tab." />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Coach</CardTitle>
            </CardHeader>
            <CardContent>
              {athlete?.coach ? (
                <div className="flex items-center justify-between">
                  <p className="font-medium text-navy">{athlete.coach.user.name}</p>
                  <Link to="/messages">
                    <Button variant="outline" size="sm">
                      Message
                    </Button>
                  </Link>
                </div>
              ) : (
                <p className="text-sm text-navy/50">You don't have a coach assigned yet.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
