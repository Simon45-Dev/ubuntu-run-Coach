import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ShieldCheck } from 'lucide-react'
import { getCheckIns, grantConsent, listConsents, withdrawConsent } from '@/api/checkIns'
import type { CheckIn } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { FullPageSpinner } from '@/components/Spinner'
import { formatDate } from '@/lib/format'
import { CheckInForm } from './CheckInForm'

// No real versioned privacy-policy document exists in this codebase yet -
// matches the placeholder the backend's own e2e fixtures use.
const POLICY_VERSION = 'v1'

function CheckInRow({ checkIn }: { checkIn: CheckIn }) {
  const parts = [
    checkIn.sleepQuality != null && `Sleep ${checkIn.sleepQuality}`,
    checkIn.energy != null && `Energy ${checkIn.energy}`,
    checkIn.soreness != null && `Soreness ${checkIn.soreness}`,
    checkIn.stress != null && `Stress ${checkIn.stress}`,
    checkIn.motivation != null && `Motivation ${checkIn.motivation}`,
  ].filter(Boolean)

  return (
    <div className="flex flex-col gap-1 border-b border-navy/10 py-3 last:border-0">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-navy">{formatDate(checkIn.date)}</p>
      </div>
      <p className="text-sm text-navy/60">{parts.length > 0 ? parts.join(' · ') : 'No ratings logged'}</p>
      {checkIn.pain && <p className="text-sm text-status-attention">Pain/discomfort: {checkIn.pain}</p>}
    </div>
  )
}

export function CheckInsTab({
  athleteId,
  isSelf,
}: {
  athleteId: string
  isSelf: boolean
}) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)

  const { data: consents, isLoading: consentsLoading } = useQuery({
    queryKey: ['consents', athleteId],
    queryFn: () => listConsents(athleteId),
  })

  const liveConsent = consents?.items.find(
    (c) => c.consentType === 'HEALTH_CHECKIN_DATA' && !c.withdrawnAt,
  )

  const { data: checkIns, isLoading: checkInsLoading } = useQuery({
    queryKey: ['check-ins', athleteId, page],
    queryFn: () => getCheckIns(athleteId, page),
    enabled: !!liveConsent,
  })

  const grantMutation = useMutation({
    mutationFn: () =>
      grantConsent(athleteId, { consentType: 'HEALTH_CHECKIN_DATA', policyVersion: POLICY_VERSION }),
    onSuccess: () => {
      toast.success('Consent granted')
      void queryClient.invalidateQueries({ queryKey: ['consents', athleteId] })
    },
    onError: () => toast.error('Could not grant consent'),
  })

  const withdrawMutation = useMutation({
    mutationFn: () => withdrawConsent(liveConsent!.id),
    onSuccess: () => {
      toast.success('Consent withdrawn')
      void queryClient.invalidateQueries({ queryKey: ['consents', athleteId] })
    },
    onError: () => toast.error('Could not withdraw consent'),
  })

  if (consentsLoading) return <FullPageSpinner />

  if (!liveConsent) {
    return isSelf ? (
      <Card>
        <CardContent className="flex flex-col items-start gap-3 pt-4">
          <ShieldCheck className="h-6 w-6 text-green" />
          <p className="font-medium text-navy">Share daily check-ins with your coach?</p>
          <p className="text-sm text-navy/60">
            This lets you log sleep, energy, soreness, stress, motivation, and any pain or
            discomfort each day. Your coach can see this to adjust your training - you can withdraw
            this at any time, which also hides your past check-ins from them.
          </p>
          <Button onClick={() => grantMutation.mutate()} disabled={grantMutation.isPending}>
            {grantMutation.isPending ? 'Granting...' : 'Grant consent'}
          </Button>
        </CardContent>
      </Card>
    ) : (
      <EmptyState
        title="No active consent for health check-in data"
        description="This athlete hasn't granted consent to share check-ins, or has withdrawn it."
      />
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between rounded-md bg-green/10 px-4 py-2 text-sm text-navy">
        <span>Consent active since {formatDate(liveConsent.grantedAt)}</span>
        {isSelf && (
          <button
            className="font-medium text-navy/60 hover:text-status-attention"
            onClick={() => withdrawMutation.mutate()}
            disabled={withdrawMutation.isPending}
          >
            Withdraw consent
          </button>
        )}
      </div>

      {isSelf && (
        <CheckInForm
          athleteId={athleteId}
          todaysCheckIn={checkIns?.items[0]}
        />
      )}

      <Card>
        <CardContent className="pt-4">
          {checkInsLoading && <FullPageSpinner />}
          {!checkInsLoading && checkIns && checkIns.items.length === 0 && (
            <EmptyState title="No check-ins logged yet" />
          )}
          {!checkInsLoading && checkIns && checkIns.items.length > 0 && (
            <>
              <div className="flex flex-col">
                {checkIns.items.map((checkIn) => (
                  <CheckInRow key={checkIn.id} checkIn={checkIn} />
                ))}
              </div>
              {checkIns.page * checkIns.pageSize < checkIns.total && (
                <button
                  className="mt-3 text-sm text-green hover:underline"
                  onClick={() => setPage((p) => p + 1)}
                >
                  Load more
                </button>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
