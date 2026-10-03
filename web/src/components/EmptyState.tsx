import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-navy/15 bg-white/60 px-6 py-12 text-center">
      {Icon && (
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-navy/5">
          <Icon className="h-5 w-5 text-navy/40" />
        </div>
      )}
      <p className="text-sm font-medium text-navy">{title}</p>
      {description && <p className="text-sm text-navy/50">{description}</p>}
      {action}
    </div>
  )
}
