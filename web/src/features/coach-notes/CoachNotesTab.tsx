import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { deleteCoachNote, listCoachNotes } from '@/api/coachNotes'
import type { CoachNote } from '@/api/types'
import { useAuth } from '@/auth/AuthProvider'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { EmptyState } from '@/components/EmptyState'
import { formatDate } from '@/lib/format'
import { CoachNoteDialog } from './CoachNoteDialog'

export function CoachNotesTab({ athleteId }: { athleteId: string }) {
  const { ctx } = useAuth()
  const queryClient = useQueryClient()
  const [dialog, setDialog] = useState<{ open: boolean; note?: CoachNote }>({ open: false })

  const { data: notes, isLoading } = useQuery({
    queryKey: ['coach-notes', athleteId],
    queryFn: () => listCoachNotes(athleteId),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCoachNote(id),
    onSuccess: () => {
      toast.success('Note removed')
      void queryClient.invalidateQueries({ queryKey: ['coach-notes', athleteId] })
    },
    onError: () => toast.error('Could not remove note'),
  })

  if (isLoading) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setDialog({ open: true })}>
          <Plus className="h-4 w-4" />
          Add note
        </Button>
      </div>

      {notes && notes.length === 0 && (
        <EmptyState
          title="No notes yet"
          description="Private notes for your own reference - the athlete never sees these."
          action={<Button onClick={() => setDialog({ open: true })}>Add note</Button>}
        />
      )}

      <div className="flex flex-col gap-2">
        {notes?.map((note) => {
          const isAuthor = note.coachId === ctx?.coachId
          return (
            <Card key={note.id}>
              <CardContent className="flex flex-col gap-2 pt-4">
                <p className="whitespace-pre-wrap text-navy">{note.content}</p>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-navy/40">{formatDate(note.createdAt, 'd MMM yyyy, HH:mm')}</p>
                  {isAuthor && (
                    <div className="flex gap-3">
                      <button
                        className="text-sm text-navy/50 hover:text-green"
                        onClick={() => setDialog({ open: true, note })}
                      >
                        Edit
                      </button>
                      <button
                        className="text-sm text-navy/50 hover:text-status-attention"
                        onClick={() => deleteMutation.mutate(note.id)}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <CoachNoteDialog
        athleteId={athleteId}
        note={dialog.note}
        open={dialog.open}
        onOpenChange={(open) => setDialog({ open })}
      />
    </div>
  )
}
