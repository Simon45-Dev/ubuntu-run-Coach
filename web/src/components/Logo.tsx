import { cn } from '@/lib/utils'

interface LogoProps {
  /** Which background this sits on - picks light or dark text accordingly. */
  background?: 'dark' | 'light'
  /** 'default' for the sidebar; 'compact' for the smaller auth-page card header. */
  size?: 'default' | 'compact'
  className?: string
}

/**
 * Typographic wordmark - replaces the old raster logo.png (a clip-art-style
 * icon that read as a placeholder asset). No icon mark, by design: a clean,
 * confident wordmark is lower-risk than a hand-drawn icon and fits plenty of
 * serious SaaS brands' own treatments.
 */
export function Logo({ background = 'dark', size = 'default', className }: LogoProps) {
  const onDark = background === 'dark'
  return (
    <div className={cn('flex w-fit flex-col leading-none', className)}>
      <span
        className={cn(
          'font-semibold tracking-[0.35em]',
          size === 'default' ? 'text-xs' : 'text-[10px]',
          onDark ? 'text-white/60' : 'text-navy/50',
        )}
      >
        UBUNTU
      </span>
      <span
        className={cn(
          'font-extrabold tracking-tight',
          size === 'default' ? 'text-4xl' : 'text-2xl',
          onDark ? 'text-white' : 'text-forest',
        )}
      >
        RUN<span className="text-orange">.</span>
      </span>
    </div>
  )
}
