import { useAuth } from '@/auth/AuthProvider'
import { FullPageSpinner } from '@/components/Spinner'
import { OrganisationDetailPage } from './OrganisationDetailPage'

/** A coach's own-organisation view of OrganisationDetailPage - same coaches table, invite dialog, and resend action, just scoped to ctx.organisationId instead of a URL param. */
export function MyTeamPage() {
  const { ctx } = useAuth()
  if (!ctx?.organisationId) return <FullPageSpinner />
  return <OrganisationDetailPage organisationId={ctx.organisationId} />
}
