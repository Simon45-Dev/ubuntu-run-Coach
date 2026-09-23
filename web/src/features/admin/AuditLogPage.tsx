import { useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listAuditLog } from '@/api/auditLog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'

// Hand-maintained, matching every @Audit(...) call across the backend - not
// fetched dynamically, same as WORKOUT_TYPE_STYLES. A new @Audit action
// elsewhere still works with the backend's free-text `action` filter; it
// just won't appear in this dropdown until added here.
const KNOWN_ACTIONS = [
  'USER_STATUS_CHANGED',
  'USER_DELETED',
  'ATHLETE_DELETED',
  'COACH_DELETED',
  'GROUP_DELETED',
  'TEMPLATE_DELETED',
  'TRAINING_PLAN_DELETED',
  'WORKOUT_DELETED',
  'CONSENT_GRANTED',
  'CONSENT_WITHDRAWN',
]

function humanizeAction(action: string): string {
  const lower = action.replace(/_/g, ' ').toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function AuditLogPage() {
  const [action, setAction] = useState('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['audit-log', action, from, to],
    queryFn: ({ pageParam }) =>
      listAuditLog({
        page: pageParam,
        pageSize: 20,
        action: action === 'ALL' ? undefined : action,
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
  })

  const items = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Audit Log</h1>
        <p className="text-sm text-navy/60">Status changes, deletions, and consent events across the platform.</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All actions</SelectItem>
              {KNOWN_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {humanizeAction(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
        {(action !== 'ALL' || from || to) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setAction('ALL')
              setFrom('')
              setTo('')
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {isLoading && <FullPageSpinner />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          title="No matching audit log entries"
          description="Actions like deletions and status changes will appear here."
        />
      )}

      {items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Actor</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-navy/60">{formatDate(entry.createdAt, 'd MMM yyyy, HH:mm')}</TableCell>
                <TableCell className="font-medium text-navy">{humanizeAction(entry.action)}</TableCell>
                <TableCell className="text-navy/60">
                  {entry.targetEntityType} <span className="text-navy/40">({entry.targetEntityId})</span>
                </TableCell>
                <TableCell className="text-navy/60">{entry.actorName ?? 'System'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {hasNextPage && (
        <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
