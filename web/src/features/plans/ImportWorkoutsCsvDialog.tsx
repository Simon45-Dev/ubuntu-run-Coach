import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { importWorkoutsCsv } from '@/api/workouts'
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

export function ImportWorkoutsCsvDialog({
  trainingPlanId,
  open,
  onOpenChange,
}: {
  trainingPlanId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<string[] | null>(null)

  const mutation = useMutation({
    mutationFn: () => importWorkoutsCsv(trainingPlanId, file!),
    onSuccess: (workouts) => {
      toast.success(`Imported ${workouts.length} workout${workouts.length === 1 ? '' : 's'}`)
      void queryClient.invalidateQueries({ queryKey: ['workouts', trainingPlanId] })
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
        toast.error(data?.message ?? 'Could not import workouts')
        return
      }
      toast.error('Could not import workouts')
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
          <DialogTitle>Import workouts from CSV</DialogTitle>
          <DialogDescription>
            A header row followed by one workout per row. Columns: <code>date</code> (YYYY-MM-DD),{' '}
            <code>type</code> (EASY, TEMPO, INTERVAL, LONG_RUN, RACE, REST, CROSS_TRAIN), and optionally{' '}
            <code>distanceKm</code>, <code>durationSec</code>, <code>paceTarget</code>,{' '}
            <code>hrZoneTarget</code>, <code>rpeTarget</code>, <code>instructions</code>. Every row must fall
            within this plan's dates - if anything's wrong, nothing is imported.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="csv-file">CSV file</Label>
          <Input
            id="csv-file"
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
