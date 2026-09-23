import { useInfiniteQuery } from '@tanstack/react-query'
import { listAuditLog } from '@/api/auditLog'
import { Button } from '@/components/ui/button'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'

function humanizeAction(action: string): string {
  const lower = action.replace(/_/g, ' ').toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function AuditLogPage() {
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['audit-log'],
    queryFn: ({ pageParam }) => listAuditLog(pageParam, 20),
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

      {isLoading && <FullPageSpinner />}

      {!isLoading && items.length === 0 && (
        <EmptyState title="No audit log entries yet" description="Actions like deletions and status changes will appear here." />
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
