import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { LoginPage } from '@/auth/LoginPage'
import { AcceptInvitePage } from '@/auth/AcceptInvitePage'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DashboardLayout } from '@/layout/DashboardLayout'
import { RosterListPage } from '@/features/roster/RosterListPage'
import { AthleteProfilePage } from '@/features/roster/AthleteProfilePage'
import { PlanDetailPage } from '@/features/plans/PlanDetailPage'
import { MessagesPage } from '@/features/messages/MessagesPage'
import { ActionCentrePage } from '@/features/action-centre/ActionCentrePage'
import { GroupsListPage } from '@/features/groups/GroupsListPage'
import { GroupDetailPage } from '@/features/groups/GroupDetailPage'
import { TemplatesListPage } from '@/features/templates/TemplatesListPage'
import { TemplateDetailPage } from '@/features/templates/TemplateDetailPage'

function RootRedirect() {
  const { ctx } = useAuth()
  if (ctx?.role === 'COACH') return <Navigate to="/action-centre" replace />
  if (ctx?.role === 'ATHLETE' && ctx.athleteId) {
    return <Navigate to={`/athletes/${ctx.athleteId}`} replace />
  }
  return <Navigate to="/admin" replace />
}

function AdminPlaceholderPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold text-navy">Admin console</h1>
      <p className="text-sm text-navy/60">
        The platform admin console isn't part of this dashboard slice yet - it covers the coach and athlete
        experience for now.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/admin" element={<AdminPlaceholderPage />} />
          <Route element={<ProtectedRoute allow={['COACH', 'PLATFORM_ADMIN']} />}>
            <Route path="/action-centre" element={<ActionCentrePage />} />
            <Route path="/roster" element={<RosterListPage />} />
            <Route path="/groups" element={<GroupsListPage />} />
            <Route path="/groups/:groupId" element={<GroupDetailPage />} />
            <Route path="/groups/:groupId/plans/:planId" element={<PlanDetailPage />} />
            <Route path="/templates" element={<TemplatesListPage />} />
            <Route path="/templates/:templateId" element={<TemplateDetailPage />} />
          </Route>
          <Route path="/athletes/:athleteId" element={<AthleteProfilePage />} />
          <Route path="/athletes/:athleteId/plans/:planId" element={<PlanDetailPage />} />
          <Route path="/messages" element={<MessagesPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
