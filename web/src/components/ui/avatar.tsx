import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from 'react'
import * as AvatarPrimitive from '@radix-ui/react-avatar'
import { cn } from '@/lib/utils'

export const Avatar = forwardRef<
  ElementRef<typeof AvatarPrimitive.Root>,
  ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn('flex h-9 w-9 shrink-0 overflow-hidden rounded-full', className)}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + last).toUpperCase()
}

export function AvatarInitials({ name, className }: { name: string; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarPrimitive.Fallback className="flex h-full w-full items-center justify-center bg-green/15 text-sm font-semibold text-green">
        {initials(name)}
      </AvatarPrimitive.Fallback>
    </Avatar>
  )
}
