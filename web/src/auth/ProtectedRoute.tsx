import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import type { Role } from '@/api/types'

export function ProtectedRoute({ allow }: { allow?: Role[] }) {
  const { ctx, status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center text-navy/60">Loading...</div>
    )
  }
  if (status === 'unauthenticated' || !ctx) {
    return <Navigate to="/login" replace />
  }
  if (allow && !allow.includes(ctx.role)) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
