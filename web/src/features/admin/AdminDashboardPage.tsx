import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Building2, History, UserCog } from 'lucide-react'
import { getPlatformStats } from '@/api/platformStats'
import { getCurrentUser } from '@/api/users'
import type { PlatformStats, UserStatus, WeeklySignupEntry } from '@/api/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { formatDate } from '@/lib/format'

const STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INVITED: 'Pending invite',
  SUSPENDED: 'Suspended',
  DEACTIVATED: 'Deactivated',
}

function WeeklySignupsChart({ weeklySignups }: { weeklySignups: WeeklySignupEntry[] }) {
  const max = Math.max(1, ...weeklySignups.map((w) => w.users))
  return (
    <div className="flex h-40 items-end gap-3">
      {weeklySignups.map((week) => (
        <div key={week.weekStart} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-32 w-full items-end justify-center">
            <div
              className="w-2/3 rounded-t bg-green"
              style={{ height: `${Math.round((week.users / max) * 100)}%` }}
            />
          </div>
          <p className="text-[10px] text-navy/50">{formatDate(week.weekStart, 'd MMM')}</p>
          {week.organisations > 0 && (
            <p className="text-[10px] font-medium text-green">
              +{week.organisations} org{week.organisations === 1 ? '' : 's'}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

function UserStatusBars({ usersByStatus }: { usersByStatus: PlatformStats['totals']['usersByStatus'] }) {
  const total = Object.values(usersByStatus).reduce((sum, n) => sum + n, 0)
  return (
    <div className="flex flex-col gap-3">
      {(Object.keys(STATUS_LABELS) as UserStatus[]).map((status) => {
        const count = usersByStatus[status]
        const rate = total === 0 ? 0 : count / total
        return (
          <div key={status} className="flex items-center gap-3">
            <p className="w-28 shrink-0 text-xs text-navy/50">{STATUS_LABELS[status]}</p>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-navy/10">
              <div className="h-full rounded-full bg-green" style={{ width: `${Math.round(rate * 100)}%` }} />
            </div>
            <p className="w-8 shrink-0 text-right text-xs text-navy/60">{count}</p>
          </div>
        )
      })}
    </div>
  )
}

export function AdminDashboardPage() {
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: getCurrentUser })
  const { data: stats, isLoading } = useQuery({ queryKey: ['platform-stats'], queryFn: getPlatformStats })

  if (isLoading || !stats) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl bg-gradient-to-br from-forest to-green px-8 py-10 text-white">
        <h1 className="text-2xl font-bold">Platform Overview</h1>
        <p className="mt-1 text-white/80">
          {user ? `Welcome back, ${user.name.split(' ')[0]}.` : 'Every organisation, coach, and athlete on Ubuntu Run.'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Platform Totals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-xl font-bold text-navy">{stats.totals.organisations}</p>
                  <p className="text-xs text-navy/50">Organisations</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-navy">{stats.totals.coaches}</p>
                  <p className="text-xs text-navy/50">Coaches</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-navy">{stats.totals.athletes}</p>
                  <p className="text-xs text-navy/50">Athletes</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-navy">{stats.totals.clubMembers}</p>
                  <p className="text-xs text-navy/50">Club Members</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>User Status</CardTitle>
            </CardHeader>
            <CardContent>
              <UserStatusBars usersByStatus={stats.totals.usersByStatus} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Signups · 8 weeks</CardTitle>
            </CardHeader>
            <CardContent>
              <WeeklySignupsChart weeklySignups={stats.weeklySignups} />
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              <Link
                to="/admin/organisations"
                className="flex flex-col items-start gap-2 rounded-md border border-navy/10 p-3 hover:bg-mist"
              >
                <Building2 className="h-5 w-5 text-green" />
                <span className="text-sm font-medium text-navy">Organisations</span>
              </Link>
              <Link
                to="/admin/users"
                className="flex flex-col items-start gap-2 rounded-md border border-navy/10 p-3 hover:bg-mist"
              >
                <UserCog className="h-5 w-5 text-green" />
                <span className="text-sm font-medium text-navy">Users</span>
              </Link>
              <Link
                to="/admin/audit-log"
                className="flex flex-col items-start gap-2 rounded-md border border-navy/10 p-3 hover:bg-mist"
              >
                <History className="h-5 w-5 text-green" />
                <span className="text-sm font-medium text-navy">Audit Log</span>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Organisations</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.recentOrganisations.length === 0 ? (
                <EmptyState title="No organisations yet" />
              ) : (
                <div className="flex flex-col gap-1">
                  {stats.recentOrganisations.map((org) => (
                    <Link
                      key={org.id}
                      to={`/admin/organisations/${org.id}`}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-mist"
                    >
                      <div>
                        <p className="text-sm font-medium text-navy">{org.name}</p>
                        <p className="text-xs text-navy/50">{org.type}</p>
                      </div>
                      <span className="text-xs text-navy/40">{formatDate(org.createdAt, 'd MMM')}</span>
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
