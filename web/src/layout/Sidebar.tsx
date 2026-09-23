import { NavLink } from 'react-router-dom'
import {
  Bell,
  Building2,
  ClipboardList,
  History,
  House,
  LayoutDashboard,
  MessageCircle,
  Settings,
  Siren,
  UserCog,
  Users,
  UsersRound,
} from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import logo from '@/assets/logo.png'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { ctx } = useAuth()
  const isCoach = ctx?.role === 'COACH'
  const isAthlete = ctx?.role === 'ATHLETE'
  const isAdmin = ctx?.role === 'PLATFORM_ADMIN'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-green/10 text-green' : 'text-white/70 hover:bg-white/10 hover:text-white',
    )

  return (
    <aside className="flex h-screen w-60 flex-col bg-forest px-3 py-4">
      <img src={logo} alt="Ubuntu Run" className="mb-6 h-auto w-full px-2" />
      <nav className="flex flex-1 flex-col gap-1">
        {isAdmin && (
          <NavLink to="/admin" className={linkClass}>
            <Building2 className="h-4 w-4" />
            Organisations
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin/users" className={linkClass}>
            <UserCog className="h-4 w-4" />
            Users
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/admin/audit-log" className={linkClass}>
            <History className="h-4 w-4" />
            Audit Log
          </NavLink>
        )}
        {isCoach && (
          <NavLink to="/dashboard" className={linkClass}>
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </NavLink>
        )}
        {isAthlete && (
          <NavLink to="/home" className={linkClass}>
            <House className="h-4 w-4" />
            Home
          </NavLink>
        )}
        {isCoach && (
          <NavLink to="/action-centre" className={linkClass}>
            <Siren className="h-4 w-4" />
            Action Centre
          </NavLink>
        )}
        {isCoach && (
          <NavLink to="/roster" className={linkClass}>
            <Users className="h-4 w-4" />
            Athletes
          </NavLink>
        )}
        {isCoach && (
          <NavLink to="/groups" className={linkClass}>
            <UsersRound className="h-4 w-4" />
            Groups
          </NavLink>
        )}
        {isCoach && (
          <NavLink to="/templates" className={linkClass}>
            <ClipboardList className="h-4 w-4" />
            Templates
          </NavLink>
        )}
        {isCoach && (
          <NavLink to="/team" className={linkClass}>
            <Building2 className="h-4 w-4" />
            My Team
          </NavLink>
        )}
        {isAthlete && ctx.athleteId && (
          <NavLink to={`/athletes/${ctx.athleteId}`} className={linkClass}>
            <Users className="h-4 w-4" />
            My Training
          </NavLink>
        )}
        {(isCoach || isAthlete) && (
          <NavLink to="/messages" className={linkClass}>
            <MessageCircle className="h-4 w-4" />
            Messages
          </NavLink>
        )}
        {(isCoach || isAthlete) && (
          <NavLink to="/notifications" className={linkClass}>
            <Bell className="h-4 w-4" />
            Notifications
          </NavLink>
        )}
        <NavLink to="/settings" className={linkClass}>
          <Settings className="h-4 w-4" />
          Settings
        </NavLink>
      </nav>
    </aside>
  )
}
