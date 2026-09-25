import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { getClubMember, updateClubMember } from '@/api/clubMembers'
import { getOrganisation } from '@/api/organisations'
import { useAuth } from '@/auth/AuthProvider'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullPageSpinner } from '@/components/Spinner'
import { formatDate } from '@/lib/format'

const schema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  idNumber: z.string().optional(),
  email: z.string().email('Enter a valid email'),
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  address: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  nextOfKinRelationship: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function MyMembershipPage() {
  const { ctx } = useAuth()
  const queryClient = useQueryClient()
  const memberId = ctx?.clubMemberId

  const { data: member, isLoading } = useQuery({
    queryKey: ['club-members', 'me', memberId],
    queryFn: () => getClubMember(memberId!),
    enabled: !!memberId,
  })
  const { data: organisation } = useQuery({
    queryKey: ['organisation', member?.organisationId],
    queryFn: () => getOrganisation(member!.organisationId),
    enabled: !!member?.organisationId,
  })

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!member) return
    reset({
      firstName: member.firstName,
      lastName: member.lastName,
      idNumber: member.idNumber ?? '',
      email: member.email,
      phone: member.phone ?? '',
      dateOfBirth: member.dateOfBirth ? member.dateOfBirth.slice(0, 10) : '',
      address: member.address ?? '',
      nextOfKinName: member.nextOfKinName ?? '',
      nextOfKinPhone: member.nextOfKinPhone ?? '',
      nextOfKinRelationship: member.nextOfKinRelationship ?? '',
    })
  }, [member, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => updateClubMember(memberId!, values),
    onSuccess: (updated) => {
      toast.success('Profile updated')
      queryClient.setQueryData(['club-members', 'me', memberId], updated)
    },
    onError: (err) => {
      const message =
        err instanceof AxiosError
          ? ((err.response?.data as { message?: string } | undefined)?.message ?? 'Could not update profile')
          : 'Could not update profile'
      toast.error(Array.isArray(message) ? message.join(', ') : message)
    },
  })

  if (isLoading || !member) return <FullPageSpinner />

  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-navy">My Membership</h1>
          <Badge variant="good">#{member.membershipNumber}</Badge>
        </div>
        <p className="text-sm text-navy/60">{organisation?.name ?? 'Loading club...'}</p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>My details</CardTitle>
        </CardHeader>
        <CardContent>
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
                <Label htmlFor="idNumber">ID number</Label>
                <Input id="idNumber" {...register('idNumber')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dateOfBirth">Date of birth</Label>
                <Input id="dateOfBirth" type="date" {...register('dateOfBirth')} />
              </div>
            </div>

            <p className="mt-2 text-xs font-medium uppercase text-navy/40">Contact</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register('email')} />
              {errors.email && <p className="text-sm text-status-attention">{errors.email.message}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register('phone')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="address">Address</Label>
              <Input id="address" {...register('address')} />
            </div>

            <p className="mt-2 text-xs font-medium uppercase text-navy/40">Next of kin</p>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nextOfKinName">Name</Label>
              <Input id="nextOfKinName" {...register('nextOfKinName')} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nextOfKinPhone">Phone</Label>
                <Input id="nextOfKinPhone" {...register('nextOfKinPhone')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nextOfKinRelationship">Relationship</Label>
                <Input id="nextOfKinRelationship" {...register('nextOfKinRelationship')} />
              </div>
            </div>

            <Button type="submit" disabled={!isDirty || mutation.isPending} className="self-start">
              {mutation.isPending ? 'Saving...' : 'Save changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Membership</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-navy/40">Join date</p>
            <p className="text-navy">{formatDate(member.joinDate)}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-navy/40">Membership expiry</p>
            <p className="text-navy">
              {member.membershipExpiryDate ? formatDate(member.membershipExpiryDate) : 'Not set'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-navy/40">Last renewal</p>
            <p className="text-navy">
              {member.lastRenewalDate ? formatDate(member.lastRenewalDate) : 'Not yet renewed'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-navy/40">Member since</p>
            <p className="text-navy">{formatDate(member.createdAt)}</p>
          </div>
        </CardContent>
        <CardContent className="pt-0">
          <p className="text-xs text-navy/40">
            These dates are managed by your coach or club admin - contact them to renew your membership.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
