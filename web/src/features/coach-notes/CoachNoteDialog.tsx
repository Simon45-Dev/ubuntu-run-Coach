import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createCoachNote, updateCoachNote } from '@/api/coachNotes'
import type { CoachNote } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const schema = z.object({
  content: z.string().min(1, 'Note cannot be empty'),
})

type FormValues = z.infer<typeof schema>

export function CoachNoteDialog({
  athleteId,
  note,
  open,
  onOpenChange,
}: {
  athleteId: string
  note?: CoachNote
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!open) return
    reset({ content: note?.content ?? '' })
  }, [open, note, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      note ? updateCoachNote(note.id, values.content) : createCoachNote(athleteId, values.content),
    onSuccess: () => {
      toast.success(note ? 'Note updated' : 'Note added')
      void queryClient.invalidateQueries({ queryKey: ['coach-notes', athleteId] })
      onOpenChange(false)
    },
    onError: () => toast.error('Could not save note'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{note ? 'Edit note' : 'Add note'}</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="content">Note</Label>
            <Textarea id="content" rows={5} {...register('content')} />
            {errors.content && <p className="text-sm text-status-attention">{errors.content.message}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save note'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
