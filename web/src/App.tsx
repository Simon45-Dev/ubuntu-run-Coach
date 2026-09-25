import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { LoginPage } from '@/auth/LoginPage'
import { AcceptInvitePage } from '@/auth/AcceptInvitePage'
import { ForgotPasswordPage } from '@/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/auth/ResetPasswordPage'
import { ProtectedRoute } from '@/auth/ProtectedRoute'
import { DashboardLayout } from '@/layout/DashboardLayout'
import { RosterListPage } from '@/features/roster/RosterListPage'
import { AthleteProfilePage } from '@/features/roster/AthleteProfilePage'
import { PlanDetailPage } from '@/features/plans/PlanDetailPage'
import { MessagesPage } from '@/features/messages/MessagesPage'
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
import { ActionCentrePage } from '@/features/action-centre/ActionCentrePage'
import { GroupsListPage } from '@/features/groups/GroupsListPage'
import { GroupDetailPage } from '@/features/groups/GroupDetailPage'
import { TemplatesListPage } from '@/features/templates/TemplatesListPage'
import { TemplateDetailPage } from '@/features/templates/TemplateDetailPage'
import { CoachDashboardPage } from '@/features/dashboard/CoachDashboardPage'
import { AthleteHomePage } from '@/features/dashboard/AthleteHomePage'
import { AdminDashboardPage } from '@/features/admin/AdminDashboardPage'
import { OrganisationsListPage } from '@/features/admin/OrganisationsListPage'
import { OrganisationDetailPage } from '@/features/admin/OrganisationDetailPage'
import { MyTeamPage } from '@/features/admin/MyTeamPage'
import { MyClubPage } from '@/features/admin/MyClubPage'
import { AuditLogPage } from '@/features/admin/AuditLogPage'
import { UsersListPage } from '@/features/admin/UsersListPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { MyMembershipPage } from '@/features/club-members/MyMembershipPage'

function RootRedirect() {
  const { ctx } = useAuth()
  if (ctx?.role === 'COACH') return <Navigate to="/dashboard" replace />
  if (ctx?.role === 'ATHLETE' && ctx.athleteId) {
    return <Navigate to="/home" replace />
  }
  if (ctx?.role === 'CLUB_MEMBER') return <Navigate to="/membership" replace />
  if (ctx?.role === 'CLUB_ADMIN') return <Navigate to="/my-club" replace />
  return <Navigate to="/admin" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<RootRedirect />} />
          <Route element={<ProtectedRoute allow={['PLATFORM_ADMIN']} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/organisations" element={<OrganisationsListPage />} />
            <Route path="/admin/organisations/:organisationId" element={<OrganisationDetailPage />} />
            <Route path="/admin/audit-log" element={<AuditLogPage />} />
            <Route path="/admin/users" element={<UsersListPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={['COACH', 'PLATFORM_ADMIN']} />}>
            <Route path="/dashboard" element={<CoachDashboardPage />} />
            <Route path="/action-centre" element={<ActionCentrePage />} />
            <Route path="/roster" element={<RosterListPage />} />
            <Route path="/groups" element={<GroupsListPage />} />
            <Route path="/groups/:groupId" element={<GroupDetailPage />} />
            <Route path="/groups/:groupId/plans/:planId" element={<PlanDetailPage />} />
            <Route path="/templates" element={<TemplatesListPage />} />
            <Route path="/templates/:templateId" element={<TemplateDetailPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={['COACH']} />}>
            <Route path="/team" element={<MyTeamPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={['ATHLETE']} />}>
            <Route path="/home" element={<AthleteHomePage />} />
          </Route>
          <Route element={<ProtectedRoute allow={['CLUB_MEMBER']} />}>
            <Route path="/membership" element={<MyMembershipPage />} />
          </Route>
          <Route element={<ProtectedRoute allow={['CLUB_ADMIN']} />}>
            <Route path="/my-club" element={<MyClubPage />} />
          </Route>
          <Route path="/athletes/:athleteId" element={<AthleteProfilePage />} />
          <Route path="/athletes/:athleteId/plans/:planId" element={<PlanDetailPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
