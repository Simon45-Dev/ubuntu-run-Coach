import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { listRoster } from '@/api/athletes'
import { listGroups } from '@/api/groups'
import { applyTemplate } from '@/api/templates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const schema = z
  .object({
    assignTo: z.string().min(1, 'Choose who this plan is for'),
    startDate: z.string().min(1, 'Start date is required'),
    endDate: z.string().optional(),
    name: z.string().optional(),
  })
  .refine((v) => !v.endDate || v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })

type FormValues = z.infer<typeof schema>

export function ApplyTemplateDialog({
  templateId,
  coachId,
  open,
  onOpenChange,
}: {
  templateId: string
  coachId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const navigate = useNavigate()
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const { data: roster } = useQuery({
    queryKey: ['roster', coachId],
    queryFn: () => listRoster(coachId),
    enabled: open,
  })
  const { data: groups } = useQuery({
    queryKey: ['groups', coachId],
    queryFn: () => listGroups(coachId),
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const [kind, id] = values.assignTo.split(':')
      return applyTemplate(templateId, {
        athleteId: kind === 'athlete' ? id : undefined,
        groupId: kind === 'group' ? id : undefined,
        startDate: new Date(values.startDate).toISOString(),
        endDate: values.endDate ? new Date(values.endDate).toISOString() : undefined,
        name: values.name || undefined,
      })
    },
    onSuccess: (plan) => {
      toast.success('Training plan created')
      reset()
      onOpenChange(false)
      const parentPath = plan.athleteId ? `/athletes/${plan.athleteId}` : `/groups/${plan.groupId}`
      navigate(`${parentPath}/plans/${plan.id}`)
    },
    onError: () => toast.error('Could not apply template'),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply template</DialogTitle>
          <DialogDescription>Creates a real training plan from this template.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label>Assign to</Label>
            <Controller
              control={control}
              name="assignTo"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an athlete or group" />
                  </SelectTrigger>
                  <SelectContent>
                    {roster?.map((athlete) => (
                      <SelectItem key={`athlete:${athlete.id}`} value={`athlete:${athlete.id}`}>
                        Athlete: {athlete.user.name}
                      </SelectItem>
                    ))}
                    {groups?.map((group) => (
                      <SelectItem key={`group:${group.id}`} value={`group:${group.id}`}>
                        Group: {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.assignTo && <p className="text-sm text-status-attention">{errors.assignTo.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="startDate">Start date</Label>
              <Input id="startDate" type="date" {...register('startDate')} />
              {errors.startDate && <p className="text-sm text-status-attention">{errors.startDate.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="endDate">End date (optional)</Label>
              <Input id="endDate" type="date" {...register('endDate')} />
              {errors.endDate && <p className="text-sm text-status-attention">{errors.endDate.message}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Plan name (optional)</Label>
            <Input id="name" placeholder="Defaults to the template name" {...register('name')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Applying...' : 'Apply template'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
