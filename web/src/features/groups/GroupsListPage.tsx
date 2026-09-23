import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Users } from 'lucide-react'
import { listGroups } from '@/api/groups'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { CreateGroupDialog } from './CreateGroupDialog'

export function GroupsListPage() {
  const { ctx } = useAuth()
  const coachId = ctx?.coachId ?? ''
  const [createOpen, setCreateOpen] = useState(false)

  const { data: groups, isLoading } = useQuery({
    queryKey: ['groups', coachId],
    queryFn: () => listGroups(coachId),
    enabled: !!coachId,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Groups</h1>
          <p className="text-sm text-navy/60">Train and message a squad together.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New group
        </Button>
      </div>

      {isLoading && <FullPageSpinner />}

      {!isLoading && groups && groups.length === 0 && (
        <EmptyState
          title="No groups yet"
          description="Create a group to assign a training plan to a whole squad at once."
          action={<Button onClick={() => setCreateOpen(true)}>New group</Button>}
        />
      )}

      {!isLoading && groups && groups.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link key={group.id} to={`/groups/${group.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 pt-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green/10">
                    <Users className="h-5 w-5 text-green" />
                  </div>
                  <div>
                    <p className="font-semibold text-navy">{group.name}</p>
                    <p className="text-sm text-navy/60">
                      {group.memberships.length} {group.memberships.length === 1 ? 'member' : 'members'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <CreateGroupDialog coachId={coachId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
