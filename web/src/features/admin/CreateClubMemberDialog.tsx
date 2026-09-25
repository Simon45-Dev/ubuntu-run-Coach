import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { createClubMember } from '@/api/clubMembers'
import { MEMBERSHIP_CATEGORIES } from '@/api/types'
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
import { MEMBERSHIP_CATEGORY_LABELS } from './membershipCategory'

// Mirrors backend CreateClubMemberDto constraints.
const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  idNumber: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  membershipCategory: z.enum(MEMBERSHIP_CATEGORIES).optional(),
  joinDate: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  nextOfKinRelationship: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function CreateClubMemberDialog({
  organisationId,
  open,
  onOpenChange,
}: {
  organisationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { joinDate: new Date().toISOString().slice(0, 10) },
  })

  const mutation = useMutation({
    mutationFn: (values: FormValues) => createClubMember(organisationId, values),
    onSuccess: (member) => {
      toast.success(`${member.firstName} added - membership number ${member.membershipNumber}`)
      void queryClient.invalidateQueries({ queryKey: ['club-members', organisationId] })
      void queryClient.invalidateQueries({ queryKey: ['club-members-stats', organisationId] })
      reset()
      onOpenChange(false)
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not add member')
          : 'Could not add member'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a club member</DialogTitle>
          <DialogDescription>
            A membership number is assigned automatically. You can invite them to manage their own
            profile later, or leave it as a record you maintain yourself.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <p className="text-xs font-medium uppercase text-navy/40">Personal info</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-sm text-status-attention">{errors.firstName.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-sm text-status-attention">{errors.lastName.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="idNumber">ID number (optional)</Label>
              <Input id="idNumber" {...register('idNumber')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="dateOfBirth">Date of birth (optional)</Label>
              <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="membershipCategory">Category (optional)</Label>
            <Select
              onValueChange={(v) =>
                setValue('membershipCategory', v as FormValues['membershipCategory'])
              }
            >
              <SelectTrigger id="membershipCategory">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {MEMBERSHIP_CATEGORIES.map((category) => (
                  <SelectItem key={category} value={category}>
                    {MEMBERSHIP_CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="joinDate">Join date</Label>
            <Input id="joinDate" type="date" {...register('joinDate')} />
          </div>

          <p className="mt-2 text-xs font-medium uppercase text-navy/40">Contact</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-status-attention">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="phone">Phone (optional)</Label>
            <Input id="phone" {...register('phone')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address (optional)</Label>
            <Input id="address" {...register('address')} />
          </div>

          <p className="mt-2 text-xs font-medium uppercase text-navy/40">Next of kin</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nextOfKinName">Name (optional)</Label>
            <Input id="nextOfKinName" {...register('nextOfKinName')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nextOfKinPhone">Phone (optional)</Label>
              <Input id="nextOfKinPhone" {...register('nextOfKinPhone')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nextOfKinRelationship">Relationship (optional)</Label>
              <Input id="nextOfKinRelationship" placeholder="e.g. Spouse" {...register('nextOfKinRelationship')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding...' : 'Add member'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
