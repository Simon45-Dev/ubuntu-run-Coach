import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { deleteAthlete, getAthlete, resendInvite, updateAthlete } from '@/api/athletes'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FullPageSpinner } from '@/components/Spinner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlansTab } from '@/features/plans/PlansTab'
import { CheckInsTab } from '@/features/check-ins/CheckInsTab'
import { RaceGoalsTab } from '@/features/race-goals/RaceGoalsTab'
import { CoachNotesTab } from '@/features/coach-notes/CoachNotesTab'
import { InviteLinkDialog } from './InviteLinkDialog'

export function AthleteProfilePage() {
  const { athleteId } = useParams<{ athleteId: string }>()
  const { ctx } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const canManage = ctx?.role === 'COACH' || ctx?.role === 'PLATFORM_ADMIN'
  const isSelf = ctx?.role === 'ATHLETE' && ctx.athleteId === athleteId

  const { data: athlete, isLoading } = useQuery({
    queryKey: ['athlete', athleteId],
    queryFn: () => getAthlete(athleteId!),
    enabled: !!athleteId,
  })

  const [goal, setGoal] = useState('')
  const [trainingBackground, setTrainingBackground] = useState('')
  const [editing, setEditing] = useState(false)

  const updateMutation = useMutation({
    mutationFn: () => updateAthlete(athleteId!, { goal, trainingBackground }),
    onSuccess: (updated) => {
      toast.success('Profile updated')
      queryClient.setQueryData(['athlete', athleteId], updated)
      setEditing(false)
    },
    onError: () => toast.error('Could not update profile'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteAthlete(athleteId!),
    onSuccess: () => {
      toast.success('Athlete removed')
      navigate('/roster')
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not remove athlete')
          : 'Could not remove athlete'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  const [invite, setInvite] = useState<{ token: string; expiresAt: string } | null>(null)
  const resendInviteMutation = useMutation({
    mutationFn: () => resendInvite(athleteId!),
    onSuccess: (result) => {
      toast.success('Invite resent')
      setInvite({ token: result.inviteToken, expiresAt: result.inviteTokenExpiresAt })
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not resend invite')
          : 'Could not resend invite'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  if (isLoading || !athlete) return <FullPageSpinner />

  function startEditing() {
    setGoal(athlete!.goal ?? '')
    setTrainingBackground(athlete!.trainingBackground ?? '')
    setEditing(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{athlete.user.name}</h1>
          <p className="text-sm text-navy/60">{athlete.user.email}</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            {athlete.user.status === 'INVITED' && (
              <Button
                variant="outline"
                onClick={() => resendInviteMutation.mutate()}
                disabled={resendInviteMutation.isPending}
              >
                {resendInviteMutation.isPending ? 'Resending...' : 'Resend invite'}
              </Button>
            )}
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Remove athlete
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="plans">Training Plans</TabsTrigger>
          <TabsTrigger value="check-ins">Check-ins</TabsTrigger>
          <TabsTrigger value="race-goals">Race Goals</TabsTrigger>
          {canManage && <TabsTrigger value="notes">Notes</TabsTrigger>}
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Athlete profile</CardTitle>
              {!editing && (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {editing ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="goal">Goal</Label>
                    <Input id="goal" value={goal} onChange={(e) => setGoal(e.target.value)} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="trainingBackground">Training background</Label>
                    <Textarea
                      id="trainingBackground"
                      value={trainingBackground}
                      onChange={(e) => setTrainingBackground(e.target.value)}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                      {updateMutation.isPending ? 'Saving...' : 'Save'}
                    </Button>
                    <Button variant="outline" onClick={() => setEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-medium uppercase text-navy/40">Goal</p>
                    <p className="text-navy">{athlete.goal ?? 'Not set yet'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-navy/40">Training background</p>
                    <p className="text-navy">{athlete.trainingBackground ?? 'Not set yet'}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <PlansTab owner={{ type: 'athlete', id: athlete.id }} canManage={canManage} />
        </TabsContent>

        <TabsContent value="check-ins">
          <CheckInsTab athleteId={athlete.id} isSelf={isSelf} />
        </TabsContent>

        <TabsContent value="race-goals">
          <RaceGoalsTab athleteId={athlete.id} />
        </TabsContent>

        {canManage && (
          <TabsContent value="notes">
            <CoachNotesTab athleteId={athlete.id} />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {athlete.user.name}?</DialogTitle>
            <DialogDescription>
              This removes them from your roster. Their training plans and history are kept, not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {invite && (
        <InviteLinkDialog
          open={!!invite}
          onOpenChange={(next) => !next && setInvite(null)}
          inviteToken={invite.token}
          expiresAt={invite.expiresAt}
        />
      )}
    </div>
  )
}
