import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, ChevronDown, LogOut } from 'lucide-react'
import { listNotifications } from '@/api/notifications'
import { getCurrentUser } from '@/api/users'
import { useAuth } from '@/auth/AuthProvider'
import { AvatarInitials } from '@/components/ui/avatar'

const ROLE_LABELS = { COACH: 'Coach', ATHLETE: 'Athlete', PLATFORM_ADMIN: 'Platform Admin' } as const

export function Topbar() {
  const { ctx, logout } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const { data: user } = useQuery({
    queryKey: ['me'],
    queryFn: getCurrentUser,
  })

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => listNotifications({ unreadOnly: true, pageSize: 1 }),
  })

  useEffect(() => {
    if (!menuOpen) return
    function onClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [menuOpen])

  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b border-navy/10 bg-white px-6">
      <Link to="/notifications" className="relative rounded-full p-2 text-navy/60 hover:bg-mist hover:text-navy">
        <Bell className="h-5 w-5" />
        {!!unread?.total && (
          <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-attention text-[10px] font-semibold text-white">
            {unread.total > 9 ? '9+' : unread.total}
          </span>
        )}
      </Link>

      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-mist"
        >
          <AvatarInitials name={user?.name ?? '?'} />
          <div className="text-left">
            <p className="text-sm font-medium text-navy">{user?.name ?? 'Loading...'}</p>
            {ctx?.role && <p className="text-xs text-navy/50">{ROLE_LABELS[ctx.role]}</p>}
          </div>
          <ChevronDown className="h-4 w-4 text-navy/40" />
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-md border border-navy/10 bg-white py-1 shadow-md">
            <button
              onClick={() => void logout()}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-navy hover:bg-mist"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
