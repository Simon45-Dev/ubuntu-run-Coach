import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  BatteryLow,
  CalendarX,
  Flag,
  HeartPulse,
  RefreshCw,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react'
import { getActionCentre } from '@/api/actionCentre'
import type { ActionCentreAlert, AlertPriority, AlertType } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { FullPageSpinner } from '@/components/Spinner'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const ALERT_TYPE_META: Record<AlertType, { icon: LucideIcon; accent: string }> = {
  PAIN_INJURY: { icon: HeartPulse, accent: 'text-status-attention' },
  MISSED_TRAINING: { icon: CalendarX, accent: 'text-status-watch' },
  LOW_READINESS: { icon: BatteryLow, accent: 'text-status-watch' },
  TRAINING_SPIKE: { icon: TrendingUp, accent: 'text-status-watch' },
  RACE_APPROACHING: { icon: Flag, accent: 'text-navy' },
  POSITIVE_PROGRESS: { icon: Trophy, accent: 'text-green' },
}

const PRIORITY_SECTIONS: { priority: AlertPriority; title: string; badgeVariant: 'attention' | 'watch' | 'neutral' }[] = [
  { priority: 'HIGH', title: 'Needs attention', badgeVariant: 'attention' },
  { priority: 'MEDIUM', title: 'Worth a look', badgeVariant: 'watch' },
  { priority: 'LOW', title: 'FYI', badgeVariant: 'neutral' },
]

function AlertCard({ alert, badgeVariant }: { alert: ActionCentreAlert; badgeVariant: 'attention' | 'watch' | 'neutral' }) {
  const { icon: Icon, accent } = ALERT_TYPE_META[alert.type]
  return (
    <Card>
      <CardContent className="flex items-start gap-3 pt-4">
        <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', accent)} />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <Link
              to={`/athletes/${alert.athleteId}`}
              className="font-semibold text-navy hover:text-green"
            >
              {alert.athleteName}
            </Link>
            <Badge variant={badgeVariant}>{alert.priority}</Badge>
          </div>
          <p className="mt-1 text-sm text-navy/70">{alert.message}</p>
          <p className="mt-1 text-xs text-navy/40">{formatDate(alert.detectedAt, 'd MMM HH:mm')}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export function ActionCentrePage() {
  const { ctx } = useAuth()
  const coachId = ctx?.coachId ?? ''
  const queryClient = useQueryClient()

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['action-centre', coachId],
    queryFn: () => getActionCentre(coachId),
    enabled: !!coachId,
  })

  if (isLoading) return <FullPageSpinner />

  const alerts = data?.alerts ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Action Centre</h1>
          <p className="text-sm text-navy/60">See which athletes need your attention.</p>
        </div>
        <Button
          variant="outline"
          disabled={isFetching}
          onClick={() => void queryClient.invalidateQueries({ queryKey: ['action-centre', coachId] })}
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {alerts.length === 0 && (
        <EmptyState
          title="Nothing needs your attention right now"
          description="You're all caught up - check back later or refresh to look again."
        />
      )}

      {PRIORITY_SECTIONS.map(({ priority, title, badgeVariant }) => {
        const section = alerts.filter((a) => a.priority === priority)
        if (section.length === 0) return null
        return (
          <div key={priority} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-navy/50">{title}</h2>
            <div className="flex flex-col gap-2">
              {section.map((alert, i) => (
                <AlertCard key={`${alert.athleteId}-${alert.type}-${i}`} alert={alert} badgeVariant={badgeVariant} />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
