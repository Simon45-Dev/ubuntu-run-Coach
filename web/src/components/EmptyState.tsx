import type { ReactNode } from 'react'

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-navy/15 bg-white/60 px-6 py-12 text-center">
      <p className="text-sm font-medium text-navy">{title}</p>
      {description && <p className="text-sm text-navy/50">{description}</p>}
      {action}
    </div>
  )
}
