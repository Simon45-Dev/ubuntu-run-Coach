import { NavLink } from 'react-router-dom'
import { ClipboardList, LogOut, MessageCircle, Siren, Users, UsersRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthProvider'
import logo from '@/assets/logo.png'
import { cn } from '@/lib/utils'

export function Sidebar() {
  const { ctx, logout } = useAuth()
  const isCoach = ctx?.role === 'COACH'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
      isActive ? 'bg-green/10 text-green' : 'text-white/70 hover:bg-white/10 hover:text-white',
    )

  return (
    <aside className="flex h-screen w-60 flex-col bg-navy px-3 py-4">
      <img src={logo} alt="Ubuntu Run" className="mb-6 h-auto w-full px-2" />
      <nav className="flex flex-1 flex-col gap-1">
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
        {ctx?.role === 'ATHLETE' && ctx.athleteId && (
          <NavLink to={`/athletes/${ctx.athleteId}`} className={linkClass}>
            <Users className="h-4 w-4" />
            My Training
          </NavLink>
        )}
        {(isCoach || ctx?.role === 'ATHLETE') && (
          <NavLink to="/messages" className={linkClass}>
            <MessageCircle className="h-4 w-4" />
            Messages
          </NavLink>
        )}
      </nav>
      <button
        onClick={() => void logout()}
        className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </button>
    </aside>
  )
}
