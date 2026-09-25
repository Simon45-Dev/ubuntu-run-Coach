import { useAuth } from '@/auth/AuthProvider'
import { FullPageSpinner } from '@/components/Spinner'
import { OrganisationDetailPage } from './OrganisationDetailPage'

/** A club admin's own-organisation view of OrganisationDetailPage - only the Club Members section renders for this role. */
export function MyClubPage() {
  const { ctx } = useAuth()
  if (!ctx?.organisationId) return <FullPageSpinner />
  return <OrganisationDetailPage organisationId={ctx.organisationId} />
}
