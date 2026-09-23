import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { Plus } from 'lucide-react'
import { getOrganisation } from '@/api/organisations'
import { listCoachesForOrganisation, resendCoachInvite } from '@/api/coaches'
import { listRoster } from '@/api/athletes'
import type { Coach } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { InviteCoachDialog } from './InviteCoachDialog'

const statusVariant = {
  ACTIVE: 'good',
  INVITED: 'watch',
  SUSPENDED: 'attention',
  DEACTIVATED: 'inactive',
} as const

async function loadAthleteCounts(coaches: Coach[]): Promise<Record<string, number>> {
  const counts = await Promise.all(
    coaches.map(async (coach) => [coach.id, (await listRoster(coach.id)).length] as const),
  )
  return Object.fromEntries(counts)
}

export function OrganisationDetailPage() {
  const { organisationId } = useParams<{ organisationId: string }>()
  const [inviteOpen, setInviteOpen] = useState(false)

  const { data: organisation, isLoading: orgLoading } = useQuery({
    queryKey: ['organisation', organisationId],
    queryFn: () => getOrganisation(organisationId!),
    enabled: !!organisationId,
  })
  const { data: coaches, isLoading: coachesLoading } = useQuery({
    queryKey: ['coaches', organisationId],
    queryFn: () => listCoachesForOrganisation(organisationId!),
    enabled: !!organisationId,
  })
  const { data: athleteCounts } = useQuery({
    queryKey: ['coach-athlete-counts', organisationId, coaches?.map((c) => c.id)],
    queryFn: () => loadAthleteCounts(coaches!),
    enabled: !!coaches && coaches.length > 0,
  })

  const resendMutation = useMutation({
    mutationFn: (coachId: string) => resendCoachInvite(coachId),
    onSuccess: () => toast.success('Invite resent'),
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not resend invite')
          : 'Could not resend invite'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  if (orgLoading || !organisation) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">{organisation.name}</h1>
        <p className="text-sm text-navy/60">{organisation.type}</p>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">Coaches</h2>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="h-4 w-4" />
          Invite coach
        </Button>
      </div>

      {coachesLoading && <FullPageSpinner />}

      {!coachesLoading && coaches && coaches.length === 0 && (
        <EmptyState
          title="No coaches yet"
          description="Invite a coach to let them start onboarding athletes."
          action={<Button onClick={() => setInviteOpen(true)}>Invite coach</Button>}
        />
      )}

      {!coachesLoading && coaches && coaches.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Athletes</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {coaches.map((coach) => (
              <TableRow key={coach.id}>
                <TableCell className="font-medium text-navy">{coach.user.name}</TableCell>
                <TableCell className="text-navy/60">{coach.user.email}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[coach.user.status]}>{coach.user.status}</Badge>
                </TableCell>
                <TableCell className="text-navy/60">{athleteCounts?.[coach.id] ?? '-'}</TableCell>
                <TableCell>
                  {coach.user.status === 'INVITED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resendMutation.mutate(coach.id)}
                      disabled={resendMutation.isPending}
                    >
                      Resend invite
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {organisationId && (
        <InviteCoachDialog organisationId={organisationId} open={inviteOpen} onOpenChange={setInviteOpen} />
      )}
    </div>
  )
}
