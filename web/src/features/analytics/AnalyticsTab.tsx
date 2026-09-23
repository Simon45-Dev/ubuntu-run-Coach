import { useQuery } from '@tanstack/react-query'
import { getAnalyticsSummary } from '@/api/analytics'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { formatDate, formatDistance, formatDuration } from '@/lib/format'

export function AnalyticsTab({ athleteId }: { athleteId: string }) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['analytics', athleteId],
    queryFn: () => getAnalyticsSummary(athleteId),
  })

  if (isLoading) return <FullPageSpinner />
  if (!summary) return null

  const { adherence, volume, weeklyTrend } = summary

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Adherence</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-navy">
              {adherence.completed} / {adherence.scheduled}
            </p>
            <p className="text-sm text-navy/60">
              {adherence.rate === null ? 'No workouts scheduled' : `${Math.round(adherence.rate * 100)}% completed`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-navy">{formatDistance(volume.totalDistanceKm)}</p>
            <p className="text-sm text-navy/60">{formatDuration(volume.totalDurationSec)} total time</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Weekly trend</CardTitle>
        </CardHeader>
        <CardContent>
          {weeklyTrend.length === 0 ? (
            <EmptyState
              title="No training data yet"
              description="Weekly trends appear once workouts are scheduled and completed."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {weeklyTrend.map((week) => {
                const rate = week.scheduled === 0 ? 0 : week.completed / week.scheduled
                return (
                  <div key={week.weekStart} className="flex items-center gap-3">
                    <p className="w-16 shrink-0 text-xs text-navy/50">{formatDate(week.weekStart, 'd MMM')}</p>
                    <div className="h-3 flex-1 overflow-hidden rounded-full bg-navy/10">
                      <div
                        className="h-full rounded-full bg-green"
                        style={{ width: `${Math.round(rate * 100)}%` }}
                      />
                    </div>
                    <p className="w-14 shrink-0 text-right text-xs text-navy/60">
                      {week.completed}/{week.scheduled}
                    </p>
                    <p className="w-24 shrink-0 text-right text-xs text-navy/60">
                      {formatDistance(week.distanceKm)}
                    </p>
                    <p className="w-16 shrink-0 text-right text-xs text-navy/60">
                      {formatDuration(week.durationSec)}
                    </p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
