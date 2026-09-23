import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { getAnalyticsSummary } from '@/api/analytics'
import { getCheckIns, listConsents } from '@/api/checkIns'
import { listCoachNotes } from '@/api/coachNotes'
import { deletePersonalBest, listPersonalBests } from '@/api/personalBests'
import { listPlansForAthlete } from '@/api/trainingPlans'
import { getWorkoutResult, listWorkoutsForPlan } from '@/api/workouts'
import type { CheckIn, PersonalBest, Workout } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { FullPageSpinner } from '@/components/Spinner'
import { formatDate, formatDuration } from '@/lib/format'
import { getWeekStart, getWeekWorkouts } from '@/features/plans/planWeek'
import { WORKOUT_TYPE_STYLES } from '@/features/plans/workoutTypeStyles'
import { countCheckInsInWindow, deriveInsight } from './overviewUtil'
import { PersonalBestDialog } from './PersonalBestDialog'

const CHECK_IN_METRICS = ['sleepQuality', 'energy', 'soreness', 'stress'] as const
const CHECK_IN_LABELS: Record<(typeof CHECK_IN_METRICS)[number], string> = {
  sleepQuality: 'Sleep',
  energy: 'Energy',
  soreness: 'Soreness',
  stress: 'Stress',
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

async function loadWeekSchedule(athleteId: string) {
  const plans = await listPlansForAthlete(athleteId)
  const activePlans = plans.filter((p) => p.status === 'ACTIVE')
  const workoutLists = await Promise.all(activePlans.map((p) => listWorkoutsForPlan(p.id)))
  const weekStart = getWeekStart(new Date())
  const weekWorkouts = getWeekWorkouts(workoutLists.flat(), weekStart)
  const entries = await Promise.all(
    weekWorkouts.map(async (workout) => ({
      workout,
      completed: !!(await getWorkoutResult(workout.id, athleteId)),
    })),
  )
  return { weekStart, entries }
}

function WeeklyVolumeChart({ weeklyTrend }: { weeklyTrend: { weekStart: string; distanceKm: number; plannedDistanceKm: number }[] }) {
  const max = Math.max(1, ...weeklyTrend.map((w) => Math.max(w.distanceKm, w.plannedDistanceKm)))
  return (
    <div className="flex h-40 items-end gap-3">
      {weeklyTrend.map((week) => (
        <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1">
          <div className="relative flex h-32 w-full items-end justify-center">
            <div
              className="absolute bottom-0 w-full rounded-t border border-navy/30"
              style={{ height: `${Math.round((week.plannedDistanceKm / max) * 100)}%` }}
            />
            <div
              className="relative w-2/3 rounded-t bg-green"
              style={{ height: `${Math.round((week.distanceKm / max) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-navy/50">{formatDate(week.weekStart, 'd MMM')}</p>
        </div>
      ))}
    </div>
  )
}

function CheckInTrendRows({ checkIns }: { checkIns: CheckIn[] }) {
  const last14 = checkIns
    .filter((c) => {
      const cutoff = new Date()
      cutoff.setUTCDate(cutoff.getUTCDate() - 14)
      return new Date(c.date) >= cutoff
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  if (last14.length === 0) {
    return <p className="text-sm text-navy/50">No check-ins logged in the last 14 days.</p>
  }

  return (
    <div className="flex flex-col gap-3">
      {CHECK_IN_METRICS.map((metric) => (
        <div key={metric} className="flex items-center gap-3">
          <p className="w-16 shrink-0 text-xs text-navy/50">{CHECK_IN_LABELS[metric]}</p>
          <div className="flex flex-1 items-end gap-1">
            {last14.map((c) => {
              const value = c[metric]
              return (
                <div key={c.id} className="flex-1 rounded-sm bg-navy/10" style={{ height: '20px' }}>
                  {value != null && (
                    <div
                      className="w-full rounded-sm bg-green"
                      style={{ height: `${Math.round((value / 10) * 20)}px`, marginTop: `${20 - Math.round((value / 10) * 20)}px` }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export function OverviewTab({ athleteId, canManage }: { athleteId: string; canManage: boolean }) {
  const queryClient = useQueryClient()
  const [pbDialog, setPbDialog] = useState<{ open: boolean; personalBest?: PersonalBest }>({ open: false })

  const { data: analytics8w } = useQuery({
    queryKey: ['analytics', athleteId],
    queryFn: () => getAnalyticsSummary(athleteId),
  })

  const now = new Date()
  const from28 = new Date(now)
  from28.setUTCDate(from28.getUTCDate() - 28)
  const { data: analytics28d } = useQuery({
    queryKey: ['analytics', athleteId, '28d'],
    queryFn: () => getAnalyticsSummary(athleteId, { from: from28.toISOString(), to: now.toISOString() }),
  })

  const { data: consents } = useQuery({
    queryKey: ['consents', athleteId],
    queryFn: () => listConsents(athleteId),
  })
  const liveConsent = consents?.items.find((c) => c.consentType === 'HEALTH_CHECKIN_DATA' && !c.withdrawnAt)
  const { data: checkIns } = useQuery({
    queryKey: ['check-ins', athleteId, 'overview'],
    queryFn: () => getCheckIns(athleteId, 1, 30),
    enabled: !!liveConsent,
  })

  const { data: weekSchedule, isLoading: weekLoading } = useQuery({
    queryKey: ['overview-week', athleteId],
    queryFn: () => loadWeekSchedule(athleteId),
  })

  const { data: notes } = useQuery({
    queryKey: ['coach-notes', athleteId],
    queryFn: () => listCoachNotes(athleteId),
    enabled: canManage,
  })

  const { data: personalBests, isLoading: pbLoading } = useQuery({
    queryKey: ['personal-bests', athleteId],
    queryFn: () => listPersonalBests(athleteId),
  })

  const deletePbMutation = useMutation({
    mutationFn: (id: string) => deletePersonalBest(id),
    onSuccess: () => {
      toast.success('Personal best removed')
      void queryClient.invalidateQueries({ queryKey: ['personal-bests', athleteId] })
    },
    onError: () => toast.error('Could not remove personal best'),
  })

  const insight = analytics28d
    ? deriveInsight(analytics28d.adherence.rate, analytics28d.avgRpeDelta)
    : null
  const checkInsSubmitted = checkIns ? countCheckInsInWindow(checkIns.items, 28, now) : null

  const dayEntries = new Map<string, { workout: Workout; completed: boolean }[]>()
  if (weekSchedule) {
    for (const entry of weekSchedule.entries) {
      const key = new Date(entry.workout.scheduledDate).toISOString().slice(0, 10)
      const list = dayEntries.get(key) ?? []
      list.push(entry)
      dayEntries.set(key, list)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Volume · 8 weeks</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics8w && analytics8w.weeklyTrend.length > 0 ? (
                <WeeklyVolumeChart weeklyTrend={analytics8w.weeklyTrend} />
              ) : (
                <EmptyState title="No training data yet" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Adherence · last 28 days</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {analytics28d && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-2xl font-bold text-navy">
                      {analytics28d.adherence.rate === null ? '-' : `${Math.round(analytics28d.adherence.rate * 100)}%`}
                    </p>
                    <p className="text-xs text-navy/50">Adherence</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-navy">
                      {analytics28d.adherence.completed} / {analytics28d.adherence.scheduled}
                    </p>
                    <p className="text-xs text-navy/50">Sessions completed</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-navy">
                      {checkInsSubmitted === null ? '-' : `${checkInsSubmitted} / 28`}
                    </p>
                    <p className="text-xs text-navy/50">Check-ins submitted</p>
                  </div>
                </div>
              )}
              {insight && <p className="text-sm text-navy/70">{insight}</p>}
            </CardContent>
          </Card>

          {liveConsent && (
            <Card>
              <CardHeader>
                <CardTitle>Check-in trend · 14 days</CardTitle>
              </CardHeader>
              <CardContent>
                <CheckInTrendRows checkIns={checkIns?.items ?? []} />
              </CardContent>
            </Card>
          )}

          {canManage && notes && notes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Coach notes</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                {notes.slice(0, 2).map((note) => (
                  <p key={note.id} className="text-sm text-navy/70">
                    <span className="text-navy/40">{formatDate(note.createdAt, 'd MMM')}</span> - {note.content}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>This week</CardTitle>
            </CardHeader>
            <CardContent>
              {weekLoading || !weekSchedule ? (
                <FullPageSpinner />
              ) : (
                <div className="flex flex-col gap-2">
                  {DAY_LABELS.map((label, i) => {
                    const d = new Date(weekSchedule.weekStart)
                    d.setUTCDate(d.getUTCDate() + i)
                    const key = d.toISOString().slice(0, 10)
                    const isToday = key === now.toISOString().slice(0, 10)
                    const entry = (dayEntries.get(key) ?? [])[0]
                    return (
                      <div key={key} className="flex items-center justify-between border-b border-navy/10 py-1.5 last:border-0">
                        <p className="w-10 shrink-0 text-xs font-medium text-navy/50">{label}</p>
                        {entry ? (
                          <p className="flex-1 text-sm text-navy">{WORKOUT_TYPE_STYLES[entry.workout.type].label}</p>
                        ) : (
                          <p className="flex-1 text-sm text-navy/40">Rest</p>
                        )}
                        {entry && (
                          <Badge variant={entry.completed ? 'good' : isToday ? 'watch' : 'neutral'}>
                            {entry.completed ? 'Done' : isToday ? 'Today' : 'Planned'}
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Personal bests</CardTitle>
              <Button variant="outline" size="sm" onClick={() => setPbDialog({ open: true })}>
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </CardHeader>
            <CardContent>
              {pbLoading && <FullPageSpinner />}
              {!pbLoading && personalBests && personalBests.length === 0 && (
                <EmptyState title="No personal bests logged yet" />
              )}
              {!pbLoading && personalBests && personalBests.length > 0 && (
                <div className="flex flex-col gap-2">
                  {personalBests.map((pb) => (
                    <div key={pb.id} className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-navy">{pb.distance}</p>
                        <p className="text-xs text-navy/50">
                          {formatDuration(pb.timeSeconds)}
                          {pb.achievedDate && ` · ${formatDate(pb.achievedDate)}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {pb.source === 'VERIFIED' && <Badge variant="good">Verified</Badge>}
                        <button
                          className="text-xs text-navy/50 hover:text-green"
                          onClick={() => setPbDialog({ open: true, personalBest: pb })}
                        >
                          Edit
                        </button>
                        <button
                          className="text-xs text-navy/50 hover:text-status-attention"
                          onClick={() => deletePbMutation.mutate(pb.id)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PersonalBestDialog
        athleteId={athleteId}
        personalBest={pbDialog.personalBest}
        open={pbDialog.open}
        onOpenChange={(open) => setPbDialog({ open })}
      />
    </div>
  )
}
