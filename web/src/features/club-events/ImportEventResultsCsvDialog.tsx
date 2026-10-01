import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { importClubEventResultsCsv } from '@/api/clubEvents'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ImportEventResultsCsvDialog({
  eventId,
  open,
  onOpenChange,
}: {
  eventId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<string[] | null>(null)

  const mutation = useMutation({
    mutationFn: () => importClubEventResultsCsv(eventId, file!),
    onSuccess: (event) => {
      toast.success(`Imported ${event.results.length} result${event.results.length === 1 ? '' : 's'}`)
      void queryClient.invalidateQueries({ queryKey: ['club-event', eventId] })
      setFile(null)
      setErrors(null)
      onOpenChange(false)
    },
    onError: (err) => {
      setErrors(null)
      if (err instanceof AxiosError) {
        const data = err.response?.data as { message?: string; errors?: string[] } | undefined
        if (data?.errors) {
          setErrors(data.errors)
          return
        }
        toast.error(data?.message ?? 'Could not import results')
        return
      }
      toast.error('Could not import results')
    },
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFile(null)
          setErrors(null)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import results from CSV</DialogTitle>
          <DialogDescription>
            A header row followed by one result per row. Columns: <code>membershipNumber</code>{' '}
            (required), <code>finishTime</code> (MM:SS or HH:MM:SS - required unless DNF/DNS),{' '}
            <code>status</code> (FINISHED, DNF, or DNS - defaults to FINISHED). If anything's wrong,
            nothing is imported.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="results-csv-file">CSV file</Label>
          <Input
            id="results-csv-file"
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setErrors(null)
            }}
          />
        </div>

        {errors && (
          <div className="max-h-40 overflow-y-auto rounded-md bg-status-attention/10 p-3">
            <ul className="list-inside list-disc text-sm text-status-attention">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={!file || mutation.isPending}>
            {mutation.isPending ? 'Importing...' : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
