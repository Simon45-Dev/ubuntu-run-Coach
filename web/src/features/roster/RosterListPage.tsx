import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { listRoster } from '@/api/athletes'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CreateAthleteDialog } from './CreateAthleteDialog'

const statusVariant = {
  ACTIVE: 'good',
  INVITED: 'watch',
  SUSPENDED: 'attention',
  DEACTIVATED: 'inactive',
} as const

export function RosterListPage() {
  const { ctx } = useAuth()
  const coachId = ctx?.coachId ?? ''
  const [createOpen, setCreateOpen] = useState(false)

  const { data: athletes, isLoading } = useQuery({
    queryKey: ['roster', coachId],
    queryFn: () => listRoster(coachId),
    enabled: !!coachId,
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Athletes</h1>
          <p className="text-sm text-navy/60">Spend less time managing athletes, more time coaching them.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add athlete
        </Button>
      </div>

      {isLoading && <FullPageSpinner />}

      {!isLoading && athletes && athletes.length === 0 && (
        <EmptyState
          title="No athletes yet"
          description="Add your first athlete to start building their training plan."
          action={<Button onClick={() => setCreateOpen(true)}>Add athlete</Button>}
        />
      )}

      {!isLoading && athletes && athletes.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Goal</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {athletes.map((athlete) => (
              <TableRow key={athlete.id}>
                <TableCell>
                  <Link to={`/athletes/${athlete.id}`} className="font-medium text-navy hover:text-green">
                    {athlete.user.name}
                  </Link>
                </TableCell>
                <TableCell className="text-navy/60">{athlete.user.email}</TableCell>
                <TableCell className="text-navy/60">{athlete.goal ?? '-'}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[athlete.user.status]}>{athlete.user.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CreateAthleteDialog coachId={coachId} open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
