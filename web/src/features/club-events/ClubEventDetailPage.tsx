import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { utils, writeFile } from 'xlsx'
import { Ban, CheckCircle, Download, Plus, Trash2, Upload } from 'lucide-react'
import {
  deleteClubEvent,
  deleteClubEventResult,
  getClubEvent,
  updateClubEvent,
} from '@/api/clubEvents'
import type { ClubEventDetail } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { formatDate, formatDuration } from '@/lib/format'
import { MEMBERSHIP_CATEGORY_LABELS } from '../admin/membershipCategory'
import { AddResultDialog } from './AddResultDialog'
import { ImportEventResultsCsvDialog } from './ImportEventResultsCsvDialog'
import { toClubEventResultExportRows } from './clubEventResultsExport'

function exportResultsToExcel(event: ClubEventDetail) {
  const sheet = utils.json_to_sheet(toClubEventResultExportRows(event.results))
  const workbook = utils.book_new()
  utils.book_append_sheet(workbook, sheet, 'Results')
  writeFile(workbook, `${event.name.replace(/[^a-z0-9]+/gi, '-')}-results.xlsx`)
}

const STATUS_VARIANT = { DRAFT: 'inactive', PUBLISHED: 'good' } as const
const RESULT_STATUS_LABEL = { FINISHED: null, DNF: 'DNF', DNS: 'DNS' } as const

function errorMessage(err: unknown, fallback: string): string {
  const message =
    err instanceof AxiosError
      ? ((err.response?.data as { message?: string } | undefined)?.message ?? fallback)
      : fallback
  return Array.isArray(message) ? message.join(', ') : message
}

export function ClubEventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { ctx } = useAuth()
  const isManager = ctx?.role === 'COACH' || ctx?.role === 'CLUB_ADMIN' || ctx?.role === 'PLATFORM_ADMIN'
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [addResultOpen, setAddResultOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: event, isLoading } = useQuery({
    queryKey: ['club-event', eventId],
    queryFn: () => getClubEvent(eventId!),
    enabled: !!eventId,
  })

  const publishMutation = useMutation({
    mutationFn: (status: 'DRAFT' | 'PUBLISHED') => updateClubEvent(eventId!, { status }),
    onSuccess: (updated) => {
      toast.success(updated.status === 'PUBLISHED' ? 'Event published' : 'Event unpublished')
      void queryClient.invalidateQueries({ queryKey: ['club-event', eventId] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not update event')),
  })

  const deleteEventMutation = useMutation({
    mutationFn: () => deleteClubEvent(eventId!),
    onSuccess: () => {
      toast.success('Event deleted')
      navigate('/events')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not delete event')),
  })

  const deleteResultMutation = useMutation({
    mutationFn: (resultId: string) => deleteClubEventResult(resultId),
    onSuccess: () => {
      toast.success('Result removed')
      void queryClient.invalidateQueries({ queryKey: ['club-event', eventId] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not remove result')),
  })

  if (isLoading || !event) return <FullPageSpinner />

  const filteredResults = event.results.filter(
    (r) => categoryFilter === 'ALL' || r.clubMember.membershipCategory === categoryFilter,
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-navy">{event.name}</h1>
            <Badge variant={STATUS_VARIANT[event.status]}>{event.status}</Badge>
          </div>
          <p className="text-sm text-navy/60">
            {formatDate(event.eventDate)}
            {event.distance && ` · ${event.distance}`}
          </p>
        </div>
        {isManager && (
          <div className="flex gap-2">
            {event.status === 'DRAFT' ? (
              <Button onClick={() => publishMutation.mutate('PUBLISHED')} disabled={publishMutation.isPending}>
                <CheckCircle className="h-4 w-4" />
                Publish
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => publishMutation.mutate('DRAFT')}
                disabled={publishMutation.isPending}
              >
                <Ban className="h-4 w-4" />
                Unpublish
              </Button>
            )}
            <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-navy">
          Leaderboard{event.results.length > 0 && ` (${event.results.length})`}
        </h2>
        <div className="flex gap-2">
          {event.results.length > 0 && (
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All categories</SelectItem>
                {Object.entries(MEMBERSHIP_CATEGORY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {event.results.length > 0 && (
            <Button variant="outline" onClick={() => exportResultsToExcel(event)}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
          {isManager && (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
              <Button onClick={() => setAddResultOpen(true)}>
                <Plus className="h-4 w-4" />
                Add result
              </Button>
            </>
          )}
        </div>
      </div>

      {filteredResults.length === 0 && (
        <EmptyState
          title={event.results.length === 0 ? 'No results yet' : 'No results in this category'}
          description={isManager ? 'Add a result manually or import a CSV file.' : undefined}
        />
      )}

      {filteredResults.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Member</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Time</TableHead>
              {isManager && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredResults.map((result) => (
              <TableRow key={result.id}>
                <TableCell className="font-mono text-navy/60">{result.rank ?? '-'}</TableCell>
                <TableCell className="font-medium text-navy">
                  {result.clubMember.firstName} {result.clubMember.lastName}{' '}
                  <span className="font-mono text-xs text-navy/40">#{result.clubMember.membershipNumber}</span>
                </TableCell>
                <TableCell className="text-navy/60">
                  {result.clubMember.membershipCategory
                    ? MEMBERSHIP_CATEGORY_LABELS[result.clubMember.membershipCategory]
                    : '-'}
                </TableCell>
                <TableCell className="text-navy/60">
                  {RESULT_STATUS_LABEL[result.status] ?? formatDuration(result.finishTimeSeconds)}
                </TableCell>
                {isManager && (
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteResultMutation.mutate(result.id)}
                      disabled={deleteResultMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {ctx?.organisationId && (
        <AddResultDialog
          organisationId={ctx.organisationId}
          eventId={event.id}
          open={addResultOpen}
          onOpenChange={setAddResultOpen}
        />
      )}
      <ImportEventResultsCsvDialog eventId={event.id} open={importOpen} onOpenChange={setImportOpen} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this event?</DialogTitle>
            <DialogDescription>
              This removes the event and every result in it. Members will no longer see it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteEventMutation.mutate()}
              disabled={deleteEventMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
