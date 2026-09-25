import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { Download, Pencil, Plus, Upload, Wallet } from 'lucide-react'
import { utils, writeFile } from 'xlsx'
import { getOrganisation } from '@/api/organisations'
import { deleteCoach, listCoachesForOrganisation, resendCoachInvite } from '@/api/coaches'
import { listRoster } from '@/api/athletes'
import {
  deleteClubAdmin,
  listClubAdminsForOrganisation,
  resendClubAdminInvite,
} from '@/api/clubAdmins'
import {
  deleteClubMember,
  inviteClubMember,
  listClubMembers,
  resendClubMemberInvite,
} from '@/api/clubMembers'
import type { ClubMember, Coach } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { InviteCoachDialog } from './InviteCoachDialog'
import { InviteClubAdminDialog } from './InviteClubAdminDialog'
import { EditOrganisationDialog } from './EditOrganisationDialog'
import { CreateClubMemberDialog } from './CreateClubMemberDialog'
import { EditClubMemberDialog } from './EditClubMemberDialog'
import { ImportClubMembersCsvDialog } from './ImportClubMembersCsvDialog'
import { ClubMemberPaymentsDialog } from './ClubMemberPaymentsDialog'
import { InviteLinkDialog } from '../roster/InviteLinkDialog'
import { getMembershipStatus, type MembershipStatus } from './membershipStatus'
import { filterClubMembers } from './clubMemberFilter'
import { toClubMemberExportRows } from './clubMembersExport'

const MEMBERSHIP_STATUS_VARIANT: Record<MembershipStatus, 'good' | 'watch' | 'attention' | 'inactive'> = {
  ACTIVE: 'good',
  EXPIRING_SOON: 'watch',
  EXPIRED: 'attention',
  NO_EXPIRY: 'inactive',
}
const MEMBERSHIP_STATUS_LABEL: Record<MembershipStatus, string> = {
  ACTIVE: 'Active',
  EXPIRING_SOON: 'Expiring soon',
  EXPIRED: 'Expired',
  NO_EXPIRY: 'No expiry',
}

function exportClubMembersToExcel(members: ClubMember[], organisationName: string) {
  const sheet = utils.json_to_sheet(toClubMemberExportRows(members))
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, sheet, 'Club Members')
  writeFile(workbook, `${organisationName.replace(/[^a-z0-9]+/gi, '-')}-club-members.xlsx`)
}

const statusVariant = {
  ACTIVE: 'good',
  INVITED: 'watch',
  SUSPENDED: 'attention',
  DEACTIVATED: 'inactive',
} as const

/**
 * A COACH (not PLATFORM_ADMIN) can only list their own roster - GET
 * /coaches/:coachId/athletes 403s for a peer coach's id (OrgScopeGuard's
 * 'coach' case). This page is also used as "My Team" by a coach viewing
 * their own organisation's coaches, which may include peers - so a failed
 * lookup is swallowed rather than breaking the whole page; that coach's
 * count just shows as unavailable.
 */
async function loadAthleteCounts(coaches: Coach[]): Promise<Record<string, number>> {
  const counts = await Promise.all(
    coaches.map(async (coach): Promise<readonly [string, number | null]> => {
      try {
        return [coach.id, (await listRoster(coach.id)).length]
      } catch {
        return [coach.id, null]
      }
    }),
  )
  return Object.fromEntries(counts.filter((c): c is readonly [string, number] => c[1] !== null))
}

export function OrganisationDetailPage({ organisationId: organisationIdProp }: { organisationId?: string } = {}) {
  const params = useParams<{ organisationId: string }>()
  const organisationId = organisationIdProp ?? params.organisationId
  const queryClient = useQueryClient()
  const { ctx } = useAuth()
  const isAdmin = ctx?.role === 'PLATFORM_ADMIN'
  const isClubAdmin = ctx?.role === 'CLUB_ADMIN'
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteClubAdminOpen, setInviteClubAdminOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [removeId, setRemoveId] = useState<string | null>(null)
  const [removeClubAdminId, setRemoveClubAdminId] = useState<string | null>(null)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [importMembersOpen, setImportMembersOpen] = useState(false)
  const [memberInvite, setMemberInvite] = useState<{ token: string; expiresAt: string } | null>(null)
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null)
  const [paymentsMember, setPaymentsMember] = useState<ClubMember | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const [memberStatusFilter, setMemberStatusFilter] = useState<MembershipStatus | 'ALL'>('ALL')

  const { data: organisation, isLoading: orgLoading } = useQuery({
    queryKey: ['organisation', organisationId],
    queryFn: () => getOrganisation(organisationId!),
    enabled: !!organisationId,
  })
  const { data: coaches, isLoading: coachesLoading } = useQuery({
    queryKey: ['coaches', organisationId],
    queryFn: () => listCoachesForOrganisation(organisationId!),
    enabled: !!organisationId && !isClubAdmin,
  })
  const { data: athleteCounts } = useQuery({
    queryKey: ['coach-athlete-counts', organisationId, coaches?.map((c) => c.id)],
    queryFn: () => loadAthleteCounts(coaches!),
    enabled: !!coaches && coaches.length > 0,
  })
  const { data: clubAdmins, isLoading: clubAdminsLoading } = useQuery({
    queryKey: ['club-admins', organisationId],
    queryFn: () => listClubAdminsForOrganisation(organisationId!),
    enabled: !!organisationId && !isClubAdmin,
  })
  const { data: members, isLoading: membersLoading } = useQuery({
    queryKey: ['club-members', organisationId],
    queryFn: () => listClubMembers(organisationId!),
    enabled: !!organisationId,
  })

  const inviteMemberMutation = useMutation({
    mutationFn: (memberId: string) => inviteClubMember(memberId),
    onSuccess: (result) => {
      toast.success('Invite created')
      setMemberInvite({ token: result.inviteToken, expiresAt: result.inviteTokenExpiresAt })
      void queryClient.invalidateQueries({ queryKey: ['club-members', organisationId] })
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not invite member')
          : 'Could not invite member'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  const resendMemberInviteMutation = useMutation({
    mutationFn: (memberId: string) => resendClubMemberInvite(memberId),
    onSuccess: (result) => {
      toast.success('Invite resent')
      setMemberInvite({ token: result.inviteToken, expiresAt: result.inviteTokenExpiresAt })
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not resend invite')
          : 'Could not resend invite'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => deleteClubMember(memberId),
    onSuccess: () => {
      toast.success('Member removed')
      void queryClient.invalidateQueries({ queryKey: ['club-members', organisationId] })
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not remove member')
          : 'Could not remove member'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
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

  const removeMutation = useMutation({
    mutationFn: (coachId: string) => deleteCoach(coachId),
    onSuccess: () => {
      toast.success('Coach removed')
      setRemoveId(null)
      void queryClient.invalidateQueries({ queryKey: ['coaches', organisationId] })
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not remove coach')
          : 'Could not remove coach'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  const resendClubAdminMutation = useMutation({
    mutationFn: (id: string) => resendClubAdminInvite(id),
    onSuccess: () => toast.success('Invite resent'),
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not resend invite')
          : 'Could not resend invite'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  const removeClubAdminMutation = useMutation({
    mutationFn: (id: string) => deleteClubAdmin(id),
    onSuccess: () => {
      toast.success('Club admin removed')
      setRemoveClubAdminId(null)
      void queryClient.invalidateQueries({ queryKey: ['club-admins', organisationId] })
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ??
            'Could not remove club admin')
          : 'Could not remove club admin'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  if (orgLoading || !organisation) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">{organisation.name}</h1>
          <p className="text-sm text-navy/60">{organisation.type}</p>
        </div>
        {isAdmin && (
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        )}
      </div>

      {!isClubAdmin && (
        <>
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
                      <div className="flex gap-2">
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
                        {isAdmin && (
                          <Button variant="outline" size="sm" onClick={() => setRemoveId(coach.id)}>
                            Remove
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-navy">Club Admins</h2>
            <Button onClick={() => setInviteClubAdminOpen(true)}>
              <Plus className="h-4 w-4" />
              Invite club admin
            </Button>
          </div>

          {clubAdminsLoading && <FullPageSpinner />}

          {!clubAdminsLoading && clubAdmins && clubAdmins.length === 0 && (
            <EmptyState
              title="No club admins yet"
              description="Invite someone to manage this club's membership without coaching access."
              action={<Button onClick={() => setInviteClubAdminOpen(true)}>Invite club admin</Button>}
            />
          )}

          {!clubAdminsLoading && clubAdmins && clubAdmins.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clubAdmins.map((clubAdmin) => (
                  <TableRow key={clubAdmin.id}>
                    <TableCell className="font-medium text-navy">{clubAdmin.user.name}</TableCell>
                    <TableCell className="text-navy/60">{clubAdmin.user.email}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[clubAdmin.user.status]}>{clubAdmin.user.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {clubAdmin.user.status === 'INVITED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendClubAdminMutation.mutate(clubAdmin.id)}
                            disabled={resendClubAdminMutation.isPending}
                          >
                            Resend invite
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setRemoveClubAdminId(clubAdmin.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">
          Club Members{members && ` (${members.length})`}
        </h2>
        <div className="flex gap-2">
          {members && members.length > 0 && (
            <Button
              variant="outline"
              onClick={() => exportClubMembersToExcel(members, organisation.name)}
            >
              <Download className="h-4 w-4" />
              Export to Excel
            </Button>
          )}
          <Button variant="outline" onClick={() => setImportMembersOpen(true)}>
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => setAddMemberOpen(true)}>
            <Plus className="h-4 w-4" />
            Add member
          </Button>
        </div>
      </div>

      {members && members.length > 0 && (
        <div className="flex gap-3">
          <Input
            placeholder="Search by name, email, or member #"
            value={memberSearch}
            onChange={(e) => setMemberSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select
            value={memberStatusFilter}
            onValueChange={(v) => setMemberStatusFilter(v as MembershipStatus | 'ALL')}
          >
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {(Object.keys(MEMBERSHIP_STATUS_LABEL) as MembershipStatus[]).map((status) => (
                <SelectItem key={status} value={status}>
                  {MEMBERSHIP_STATUS_LABEL[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {membersLoading && <FullPageSpinner />}

      {!membersLoading && members && members.length === 0 && (
        <EmptyState
          title="No club members yet"
          description="Add a member to start tracking the club's roster."
          action={<Button onClick={() => setAddMemberOpen(true)}>Add member</Button>}
        />
      )}

      {!membersLoading && members && members.length > 0 && (
        <>
        {(() => {
          const filteredMembers = filterClubMembers(members, memberSearch, memberStatusFilter)
          if (filteredMembers.length === 0) {
            return <EmptyState title="No club members match these filters" />
          }
          return (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member #</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Login status</TableHead>
              <TableHead>Membership</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredMembers.map((member) => {
              const membershipStatus = getMembershipStatus(member.membershipExpiryDate, new Date())
              return (
              <TableRow key={member.id}>
                <TableCell className="font-mono text-navy/60">{member.membershipNumber}</TableCell>
                <TableCell className="font-medium text-navy">
                  {member.firstName} {member.lastName}
                </TableCell>
                <TableCell className="text-navy/60">{member.email}</TableCell>
                <TableCell>
                  {member.user ? (
                    <Badge variant={statusVariant[member.user.status]}>{member.user.status}</Badge>
                  ) : (
                    <Badge variant="inactive">No login</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={MEMBERSHIP_STATUS_VARIANT[membershipStatus]}>
                    {MEMBERSHIP_STATUS_LABEL[membershipStatus]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setEditingMember(member)}>
                      Edit
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPaymentsMember(member)}>
                      <Wallet className="h-4 w-4" />
                      Payments
                    </Button>
                    {!member.user && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => inviteMemberMutation.mutate(member.id)}
                        disabled={inviteMemberMutation.isPending}
                      >
                        Invite
                      </Button>
                    )}
                    {member.user?.status === 'INVITED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resendMemberInviteMutation.mutate(member.id)}
                        disabled={resendMemberInviteMutation.isPending}
                      >
                        Resend invite
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeMemberMutation.mutate(member.id)}
                      disabled={removeMemberMutation.isPending}
                    >
                      Remove
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              )
            })}
          </TableBody>
        </Table>
          )
        })()}
        </>
      )}

      {organisationId && (
        <InviteCoachDialog organisationId={organisationId} open={inviteOpen} onOpenChange={setInviteOpen} />
      )}
      {organisationId && (
        <InviteClubAdminDialog
          organisationId={organisationId}
          open={inviteClubAdminOpen}
          onOpenChange={setInviteClubAdminOpen}
        />
      )}
      {organisationId && (
        <CreateClubMemberDialog
          organisationId={organisationId}
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
        />
      )}
      {organisationId && (
        <ImportClubMembersCsvDialog
          organisationId={organisationId}
          open={importMembersOpen}
          onOpenChange={setImportMembersOpen}
        />
      )}
      {organisationId && (
        <EditClubMemberDialog
          organisationId={organisationId}
          member={editingMember}
          open={!!editingMember}
          onOpenChange={(open) => !open && setEditingMember(null)}
        />
      )}
      <ClubMemberPaymentsDialog
        member={paymentsMember}
        open={!!paymentsMember}
        onOpenChange={(open) => !open && setPaymentsMember(null)}
      />
      {memberInvite && (
        <InviteLinkDialog
          open={!!memberInvite}
          onOpenChange={(next) => !next && setMemberInvite(null)}
          inviteToken={memberInvite.token}
          expiresAt={memberInvite.expiresAt}
        />
      )}
      {isAdmin && (
        <EditOrganisationDialog organisation={organisation} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <Dialog open={!!removeId} onOpenChange={(open) => !open && setRemoveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this coach?</DialogTitle>
            <DialogDescription>
              This removes them from the organisation. Their athletes and training history are kept, not
              deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeId && removeMutation.mutate(removeId)}
              disabled={removeMutation.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!removeClubAdminId} onOpenChange={(open) => !open && setRemoveClubAdminId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this club admin?</DialogTitle>
            <DialogDescription>
              This removes their access to manage club membership for this organisation.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveClubAdminId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeClubAdminId && removeClubAdminMutation.mutate(removeClubAdminId)}
              disabled={removeClubAdminMutation.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
