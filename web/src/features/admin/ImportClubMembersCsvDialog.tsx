import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { AxiosError } from 'axios'
import { importClubMembersCsv } from '@/api/clubMembers'
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

export function ImportClubMembersCsvDialog({
  organisationId,
  open,
  onOpenChange,
}: {
  organisationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [errors, setErrors] = useState<string[] | null>(null)

  const mutation = useMutation({
    mutationFn: () => importClubMembersCsv(organisationId, file!),
    onSuccess: (members) => {
      toast.success(`Imported ${members.length} member${members.length === 1 ? '' : 's'}`)
      void queryClient.invalidateQueries({ queryKey: ['club-members', organisationId] })
      void queryClient.invalidateQueries({ queryKey: ['club-members-stats', organisationId] })
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
        toast.error(data?.message ?? 'Could not import members')
        return
      }
      toast.error('Could not import members')
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
          <DialogTitle>Import club members from CSV</DialogTitle>
          <DialogDescription>
            A header row followed by one member per row. Columns: <code>firstName</code>,{' '}
            <code>lastName</code>, <code>email</code> (required), and optionally <code>idNumber</code>,{' '}
            <code>phone</code>, <code>dateOfBirth</code>, <code>address</code>, <code>joinDate</code>,{' '}
            <code>nextOfKinName</code>, <code>nextOfKinPhone</code>, <code>nextOfKinRelationship</code>.
            If anything's wrong, nothing is imported.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="club-members-csv-file">CSV file</Label>
          <Input
            id="club-members-csv-file"
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
