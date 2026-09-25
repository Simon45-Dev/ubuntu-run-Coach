import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { updateClubMember } from '@/api/clubMembers'
import { MEMBERSHIP_CATEGORIES, type ClubMember } from '@/api/types'
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

// Mirrors backend UpdateClubMemberDto constraints - coach/admin only, can also
// see and set membershipExpiryDate/lastRenewalDate, unlike self-service.
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
  membershipExpiryDate: z.string().optional(),
  lastRenewalDate: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  nextOfKinRelationship: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : ''
}

export function EditClubMemberDialog({
  organisationId,
  member,
  open,
  onOpenChange,
}: {
  organisationId: string
  member: ClubMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })
  const membershipCategory = watch('membershipCategory')

  useEffect(() => {
    if (!member) return
    reset({
      firstName: member.firstName,
      lastName: member.lastName,
      idNumber: member.idNumber ?? '',
      email: member.email,
      phone: member.phone ?? '',
      dateOfBirth: toDateInput(member.dateOfBirth),
      address: member.address ?? '',
      membershipCategory: member.membershipCategory ?? undefined,
      joinDate: toDateInput(member.joinDate),
      membershipExpiryDate: toDateInput(member.membershipExpiryDate),
      lastRenewalDate: toDateInput(member.lastRenewalDate),
      nextOfKinName: member.nextOfKinName ?? '',
      nextOfKinPhone: member.nextOfKinPhone ?? '',
      nextOfKinRelationship: member.nextOfKinRelationship ?? '',
    })
  }, [member, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateClubMember(member!.id, values),
    onSuccess: () => {
      toast.success('Member updated')
      void queryClient.invalidateQueries({ queryKey: ['club-members', organisationId] })
      void queryClient.invalidateQueries({ queryKey: ['club-members-stats', organisationId] })
      onOpenChange(false)
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not update member')
          : 'Could not update member'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit club member</DialogTitle>
          <DialogDescription>Membership number stays fixed - everything else can be updated.</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="flex flex-col gap-4"
        >
          <p className="text-xs font-medium uppercase text-navy/40">Personal info</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-firstName">First name</Label>
              <Input id="edit-firstName" {...register('firstName')} />
              {errors.firstName && (
                <p className="text-sm text-status-attention">{errors.firstName.message}</p>
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-lastName">Last name</Label>
              <Input id="edit-lastName" {...register('lastName')} />
              {errors.lastName && (
                <p className="text-sm text-status-attention">{errors.lastName.message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-idNumber">ID number</Label>
              <Input id="edit-idNumber" {...register('idNumber')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-dateOfBirth">Date of birth</Label>
              <Input id="edit-dateOfBirth" type="date" {...register('dateOfBirth')} />
            </div>
          </div>

          <p className="mt-2 text-xs font-medium uppercase text-navy/40">Contact</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-email">Email</Label>
            <Input id="edit-email" type="email" {...register('email')} />
            {errors.email && <p className="text-sm text-status-attention">{errors.email.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input id="edit-phone" {...register('phone')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-address">Address</Label>
            <Input id="edit-address" {...register('address')} />
          </div>

          <p className="mt-2 text-xs font-medium uppercase text-navy/40">Membership</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-membershipCategory">Category</Label>
            <Select
              value={membershipCategory ?? undefined}
              onValueChange={(v) =>
                setValue('membershipCategory', v as FormValues['membershipCategory'])
              }
            >
              <SelectTrigger id="edit-membershipCategory">
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
            <Label htmlFor="edit-joinDate">Join date</Label>
            <Input id="edit-joinDate" type="date" {...register('joinDate')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-membershipExpiryDate">Membership expiry</Label>
              <Input id="edit-membershipExpiryDate" type="date" {...register('membershipExpiryDate')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-lastRenewalDate">Last renewal</Label>
              <Input id="edit-lastRenewalDate" type="date" {...register('lastRenewalDate')} />
            </div>
          </div>

          <p className="mt-2 text-xs font-medium uppercase text-navy/40">Next of kin</p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-nextOfKinName">Name</Label>
            <Input id="edit-nextOfKinName" {...register('nextOfKinName')} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-nextOfKinPhone">Phone</Label>
              <Input id="edit-nextOfKinPhone" {...register('nextOfKinPhone')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-nextOfKinRelationship">Relationship</Label>
              <Input id="edit-nextOfKinRelationship" {...register('nextOfKinRelationship')} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
