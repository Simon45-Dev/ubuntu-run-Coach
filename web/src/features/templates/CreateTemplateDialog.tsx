import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createTemplate } from '@/api/templates'
import { TRAINING_PLAN_PHASES } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  goal: z.string().optional(),
  phase: z.enum(TRAINING_PLAN_PHASES).optional(),
})

type FormValues = z.infer<typeof schema>

export function CreateTemplateDialog({
  coachId,
  open,
  onOpenChange,
}: {
  coachId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      createTemplate(coachId, { ...values, goal: values.goal || undefined }),
    onSuccess: () => {
      toast.success('Template created')
      void queryClient.invalidateQueries({ queryKey: ['templates', coachId] })
      reset()
      onOpenChange(false)
    },
    onError: () => toast.error('Could not create template'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New template</DialogTitle>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Template name</Label>
            <Input id="name" placeholder="e.g. 10K Base Build" {...register('name')} />
            {errors.name && <p className="text-sm text-status-attention">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal">Goal (optional)</Label>
            <Input id="goal" placeholder="e.g. Sub-50 10K" {...register('goal')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Phase (optional)</Label>
            <Controller
              control={control}
              name="phase"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a phase" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRAINING_PLAN_PHASES.map((phase) => (
                      <SelectItem key={phase} value={phase}>
                        {phase}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating...' : 'Create template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
