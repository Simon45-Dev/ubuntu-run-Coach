import { NavLink } from 'react-router-dom'
import {
  Bell,
  Building2,
  History,
  House,
  IdCard,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Siren,
  Trophy,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
}

/**
 * Quick one-tap access to the 3-4 most-used routes per role, alongside (not
 * instead of) the existing hamburger/sidebar overlay - everything else
 * (Settings, and less-frequent role-specific items) stays in that overlay.
 * Mirrors Sidebar.tsx's role-gating and icon choices so the two navs agree.
 */
export function MobileBottomNav() {
  const { ctx } = useAuth()

  const items: NavItem[] = (() => {
    switch (ctx?.role) {
      case 'COACH':
        return [
          { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          { to: '/action-centre', icon: Siren, label: 'Action' },
          { to: '/roster', icon: Users, label: 'Athletes' },
          { to: '/messages', icon: MessageCircle, label: 'Messages' },
        ]
      case 'ATHLETE':
        return [
          { to: '/home', icon: House, label: 'Home' },
          ...(ctx.athleteId
            ? [{ to: `/athletes/${ctx.athleteId}`, icon: Users, label: 'Training' }]
            : []),
          { to: '/messages', icon: MessageCircle, label: 'Messages' },
          { to: '/notifications', icon: Bell, label: 'Alerts' },
        ]
      case 'PLATFORM_ADMIN':
        return [
          { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
          { to: '/admin/organisations', icon: Building2, label: 'Orgs' },
          { to: '/admin/users', icon: UserCog, label: 'Users' },
          { to: '/admin/audit-log', icon: History, label: 'Audit' },
        ]
      case 'CLUB_MEMBER':
        return [
          { to: '/membership', icon: IdCard, label: 'Membership' },
          { to: '/events', icon: Trophy, label: 'Events' },
          { to: '/settings', icon: Settings, label: 'Settings' },
        ]
      case 'CLUB_ADMIN':
        return [
          { to: '/my-club', icon: Building2, label: 'My Club' },
          { to: '/events', icon: Trophy, label: 'Events' },
          { to: '/settings', icon: Settings, label: 'Settings' },
        ]
      default:
        return []
    }
  })()

  if (items.length === 0) return null

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid border-t border-navy/10 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
    >
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/admin'}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
              isActive ? 'text-green' : 'text-navy/50',
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
