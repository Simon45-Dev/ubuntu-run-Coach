import type { HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Brand status system (Guidelines Section 18): Green=Good, Orange=Watch,
 * Red=Attention, Grey=Inactive. Orange never carries white text - Navy text
 * on an Orange fill is the only AA-passing combination (Section 10).
 */
const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      variant: {
        good: 'bg-status-good/15 text-status-good',
        watch: 'bg-status-watch/15 text-navy',
        attention: 'bg-status-attention/15 text-status-attention',
        inactive: 'bg-status-inactive/15 text-status-inactive',
        neutral: 'bg-navy/5 text-navy',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
)

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, className }))} {...props} />
}
