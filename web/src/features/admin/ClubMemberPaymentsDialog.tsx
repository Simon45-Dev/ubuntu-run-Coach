import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AxiosError } from 'axios'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import {
  createClubMemberPayment,
  deleteClubMemberPayment,
  listClubMemberPayments,
} from '@/api/clubMemberPayments'
import { PAYMENT_METHODS, type ClubMember } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { EmptyState } from '@/components/EmptyState'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatCurrency, formatDate } from '@/lib/format'

function errorMessage(err: unknown, fallback: string): string {
  const message =
    err instanceof AxiosError
      ? ((err.response?.data as { message?: string } | undefined)?.message ?? fallback)
      : fallback
  return Array.isArray(message) ? message.join(', ') : message
}

const schema = z.object({
  amount: z.coerce.number().positive('Enter an amount greater than 0'),
  method: z.enum(['CASH', 'EFT', 'CARD', 'OTHER']),
  paidAt: z.string().min(1, 'Date is required'),
  note: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

export function ClubMemberPaymentsDialog({
  member,
  open,
  onOpenChange,
}: {
  member: ClubMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const memberId = member?.id

  const { data: payments, isLoading } = useQuery({
    queryKey: ['club-member-payments', memberId],
    queryFn: () => listClubMemberPayments(memberId!),
    enabled: !!memberId && open,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { method: 'CASH', paidAt: new Date().toISOString().slice(0, 10) },
  })

  const createMutation = useMutation({
    mutationFn: (values: FormValues) => createClubMemberPayment(memberId!, values),
    onSuccess: () => {
      toast.success('Payment recorded')
      void queryClient.invalidateQueries({ queryKey: ['club-member-payments', memberId] })
      reset({ amount: undefined, method: 'CASH', paidAt: new Date().toISOString().slice(0, 10), note: '' })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not record payment')),
  })

  const deleteMutation = useMutation({
    mutationFn: (paymentId: string) => deleteClubMemberPayment(paymentId),
    onSuccess: () => {
      toast.success('Payment deleted')
      void queryClient.invalidateQueries({ queryKey: ['club-member-payments', memberId] })
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not delete payment')),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment history</DialogTitle>
          <DialogDescription>
            {member && `${member.firstName} ${member.lastName} - #${member.membershipNumber}`}. Record-keeping
            only - no payment is actually processed here.
          </DialogDescription>
        </DialogHeader>

        <form
          noValidate
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="grid grid-cols-4 items-end gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input id="payment-amount" type="number" step="0.01" min="0" {...register('amount')} />
            {errors.amount && <p className="text-sm text-status-attention">{errors.amount.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-method">Method</Label>
            <Select
              defaultValue="CASH"
              onValueChange={(v) => setValue('method', v as FormValues['method'], { shouldValidate: true })}
            >
              <SelectTrigger id="payment-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-paidAt">Date</Label>
            <Input id="payment-paidAt" type="date" {...register('paidAt')} />
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Recording...' : 'Record'}
          </Button>
          <div className="col-span-4 flex flex-col gap-1.5">
            <Label htmlFor="payment-note">Note (optional)</Label>
            <Input id="payment-note" {...register('note')} />
          </div>
        </form>

        {isLoading && <p className="text-sm text-navy/60">Loading...</p>}

        {!isLoading && payments && payments.length === 0 && <EmptyState title="No payments recorded yet" />}

        {!isLoading && payments && payments.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Note</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-navy/60">{formatDate(payment.paidAt)}</TableCell>
                  <TableCell className="font-medium text-navy">{formatCurrency(payment.amount)}</TableCell>
                  <TableCell className="text-navy/60">{payment.method}</TableCell>
                  <TableCell className="text-navy/60">{payment.note ?? '-'}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteMutation.mutate(payment.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
