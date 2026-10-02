import { cn } from '@/lib/utils'
import { Card, CardContent } from './card'

/** A single placeholder block - compose several, matching the real content's layout, to build a page's loading shape. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-navy/10', className)} />
}

/** Matches GroupsListPage/ClubEventsListPage's icon-circle + title + subtitle card grid. */
export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardContent className="flex items-center gap-3 pt-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
