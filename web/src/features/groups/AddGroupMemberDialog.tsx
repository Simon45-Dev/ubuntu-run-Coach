import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listRoster } from '@/api/athletes'
import { addGroupMember } from '@/api/groups'
import type { Group } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function AddGroupMemberDialog({
  coachId,
  group,
  open,
  onOpenChange,
}: {
  coachId: string
  group: Group
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [athleteId, setAthleteId] = useState<string | undefined>(undefined)

  const { data: roster } = useQuery({
    queryKey: ['roster', coachId],
    queryFn: () => listRoster(coachId),
    enabled: open,
  })

  const memberIds = new Set(group.memberships.map((m) => m.athleteId))
  const available = roster?.filter((a) => !memberIds.has(a.id)) ?? []

  const mutation = useMutation({
    mutationFn: () => addGroupMember(group.id, athleteId!),
    onSuccess: () => {
      toast.success('Member added')
      void queryClient.invalidateQueries({ queryKey: ['group', group.id] })
      setAthleteId(undefined)
      onOpenChange(false)
    },
    onError: () => toast.error('Could not add member'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a member to {group.name}</DialogTitle>
          <DialogDescription>Only athletes on your own roster can be added.</DialogDescription>
        </DialogHeader>
        {available.length === 0 ? (
          <p className="text-sm text-navy/60">
            Every athlete on your roster is already in this group.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label>Athlete</Label>
            <Select value={athleteId} onValueChange={setAthleteId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an athlete" />
              </SelectTrigger>
              <SelectContent>
                {available.map((athlete) => (
                  <SelectItem key={athlete.id} value={athlete.id}>
                    {athlete.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!athleteId || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? 'Adding...' : 'Add member'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
