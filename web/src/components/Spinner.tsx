import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-green', className)} />
}

export function FullPageSpinner() {
  return (
    <div className="flex h-full min-h-40 items-center justify-center py-12">
      <Spinner />
    </div>
  )
}
