import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listNotifications, markNotificationRead } from '@/api/notifications'
import type { NotificationPriority } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const priorityVariant: Record<NotificationPriority, 'attention' | 'watch' | 'neutral'> = {
  HIGH: 'attention',
  MEDIUM: 'watch',
  LOW: 'neutral',
}

function humanizeType(type: string): string {
  const lower = type.replace(/_/g, ' ').toLowerCase()
  return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const [unreadOnly, setUnreadOnly] = useState(false)

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ['notifications', unreadOnly],
    queryFn: ({ pageParam }) => listNotifications({ page: pageParam, pageSize: 20, unreadOnly }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.page * lastPage.pageSize < lastPage.total ? lastPage.page + 1 : undefined,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const items = data?.pages.flatMap((p) => p.items) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Notifications</h1>
          <p className="text-sm text-navy/60">Updates that need your attention.</p>
        </div>
        <div className="flex gap-2">
          <Button variant={unreadOnly ? 'outline' : 'primary'} size="sm" onClick={() => setUnreadOnly(false)}>
            All
          </Button>
          <Button variant={unreadOnly ? 'primary' : 'outline'} size="sm" onClick={() => setUnreadOnly(true)}>
            Unread
          </Button>
        </div>
      </div>

      {isLoading && <FullPageSpinner />}

      {!isLoading && items.length === 0 && (
        <EmptyState
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description={unreadOnly ? undefined : "You'll see updates here as they come in."}
        />
      )}

      {items.length > 0 && (
        <div className="flex flex-col gap-2">
          {items.map((notification) => {
            const isUnread = !notification.readAt
            return (
              <Card key={notification.id} className={cn(isUnread && 'border-l-2 border-l-green')}>
                <CardContent className="flex items-center justify-between gap-3 pt-4">
                  <div className="flex items-center gap-3">
                    <Badge variant={priorityVariant[notification.priority]}>{notification.priority}</Badge>
                    <div>
                      <p className="font-medium text-navy">{humanizeType(notification.type)}</p>
                      <p className="text-xs text-navy/50">
                        {formatDate(notification.createdAt, 'd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                  </div>
                  {isUnread && (
                    <button
                      className="text-sm text-navy/50 hover:text-green"
                      onClick={() => markReadMutation.mutate(notification.id)}
                      disabled={markReadMutation.isPending}
                    >
                      Mark as read
                    </button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {hasNextPage && (
        <Button variant="outline" onClick={() => void fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
