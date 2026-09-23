import { useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, X } from 'lucide-react'
import { deleteGroup, getGroup, removeGroupMember, updateGroup } from '@/api/groups'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlansTab } from '@/features/plans/PlansTab'
import { AddGroupMemberDialog } from './AddGroupMemberDialog'

export function GroupDetailPage() {
  const { groupId } = useParams<{ groupId: string }>()
  const { ctx } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = ctx?.role === 'COACH' || ctx?.role === 'PLATFORM_ADMIN'

  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)

  const { data: group, isLoading } = useQuery({
    queryKey: ['group', groupId],
    queryFn: () => getGroup(groupId!),
    enabled: !!groupId,
  })

  const renameMutation = useMutation({
    mutationFn: () => updateGroup(groupId!, { name }),
    onSuccess: (updated) => {
      toast.success('Group renamed')
      queryClient.setQueryData(['group', groupId], updated)
      setEditingName(false)
    },
    onError: () => toast.error('Could not rename group'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteGroup(groupId!),
    onSuccess: () => {
      toast.success('Group deleted')
      navigate('/groups')
    },
    onError: () => toast.error('Could not delete group'),
  })

  const removeMemberMutation = useMutation({
    mutationFn: (athleteId: string) => removeGroupMember(groupId!, athleteId),
    onSuccess: (updated) => {
      toast.success('Member removed')
      queryClient.setQueryData(['group', groupId], updated)
    },
    onError: () => toast.error('Could not remove member'),
  })

  if (isLoading || !group) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} className="w-64" autoFocus />
            <Button size="sm" onClick={() => renameMutation.mutate()} disabled={renameMutation.isPending}>
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingName(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <div>
            <h1 className="text-2xl font-bold text-navy">{group.name}</h1>
            {canManage && (
              <button
                className="text-sm text-navy/50 hover:text-green"
                onClick={() => {
                  setName(group.name)
                  setEditingName(true)
                }}
              >
                Rename
              </button>
            )}
          </div>
        )}
        {canManage && (
          <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
            Delete group
          </Button>
        )}
      </div>

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="plans">Training Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Members</CardTitle>
              {canManage && (
                <Button variant="outline" size="sm" onClick={() => setAddMemberOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Add member
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {group.memberships.length === 0 ? (
                <EmptyState title="No members yet" description="Add athletes from your roster to this group." />
              ) : (
                <div className="flex flex-col divide-y divide-navy/10">
                  {group.memberships.map((membership) => (
                    <div key={membership.id} className="flex items-center justify-between py-2">
                      <Link
                        to={`/athletes/${membership.athlete.id}`}
                        className="font-medium text-navy hover:text-green"
                      >
                        {membership.athlete.user.name}
                      </Link>
                      {canManage && (
                        <button
                          className="text-navy/40 hover:text-status-attention"
                          onClick={() => removeMemberMutation.mutate(membership.athleteId)}
                          aria-label={`Remove ${membership.athlete.user.name}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans">
          <PlansTab owner={{ type: 'group', id: group.id }} canManage={canManage} />
        </TabsContent>
      </Tabs>

      {canManage && (
        <AddGroupMemberDialog
          coachId={group.coachId}
          group={group}
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
        />
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {group.name}?</DialogTitle>
            <DialogDescription>
              This removes the group. Its training plans and history are kept, not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
