import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { deleteUser, listUsers, updateUserStatus } from '@/api/users'
import { ROLES, type Role, type UserStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

const statusVariant = {
  ACTIVE: 'good',
  INVITED: 'watch',
  SUSPENDED: 'attention',
  DEACTIVATED: 'inactive',
} as const

// INVITED isn't admin-settable - it's set/cleared only by the invite/accept flow.
const ADMIN_SETTABLE_STATUSES: UserStatus[] = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED']

function errorMessage(err: unknown, fallback: string): string {
  const message =
    err instanceof AxiosError
      ? ((err.response?.data as { message?: string } | undefined)?.message ?? fallback)
      : fallback
  return Array.isArray(message) ? message.join(', ') : message
}

export function UsersListPage() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<Role | 'ALL'>('ALL')
  const [removeId, setRemoveId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['users', search, role],
    queryFn: () => listUsers({ search: search || undefined, role: role === 'ALL' ? undefined : role }),
  })
  const users = data?.items

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: UserStatus }) => updateUserStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated')
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not update status')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: () => {
      toast.success('User removed')
      setRemoveId(null)
      void queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not remove user')),
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Users</h1>
        <p className="text-sm text-navy/60">Every user across the platform - coaches, athletes, and admins.</p>
      </div>

      <div className="flex gap-3">
        <Input
          placeholder="Search by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={role} onValueChange={(v) => setRole(v as Role | 'ALL')}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All roles</SelectItem>
            {ROLES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <FullPageSpinner />}

      {!isLoading && users && users.length === 0 && <EmptyState title="No users match these filters" />}

      {!isLoading && users && users.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium text-navy">{user.name}</TableCell>
                <TableCell className="text-navy/60">{user.email}</TableCell>
                <TableCell className="text-navy/60">{user.role}</TableCell>
                <TableCell>
                  {user.status === 'INVITED' ? (
                    <Badge variant={statusVariant.INVITED}>INVITED</Badge>
                  ) : (
                    <Select
                      value={user.status}
                      onValueChange={(status) =>
                        statusMutation.mutate({ id: user.id, status: status as UserStatus })
                      }
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ADMIN_SETTABLE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="outline" size="sm" onClick={() => setRemoveId(user.id)}>
                    Remove
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!removeId} onOpenChange={(open) => !open && setRemoveId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove this user?</DialogTitle>
            <DialogDescription>
              This deactivates their account. It doesn't delete their history or data.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => removeId && deleteMutation.mutate(removeId)}
              disabled={deleteMutation.isPending}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
