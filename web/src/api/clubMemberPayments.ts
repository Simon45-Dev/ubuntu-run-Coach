import { apiClient } from './client'
import type { ClubMemberPayment, PaymentMethod } from './types'

export async function listClubMemberPayments(clubMemberId: string): Promise<ClubMemberPayment[]> {
  const res = await apiClient.get<ClubMemberPayment[]>(`/club-members/${clubMemberId}/payments`)
  return res.data
}

export interface CreateClubMemberPaymentInput {
  amount: number
  method: PaymentMethod
  paidAt: string
  note?: string
}

export async function createClubMemberPayment(
  clubMemberId: string,
  input: CreateClubMemberPaymentInput,
): Promise<ClubMemberPayment> {
  const res = await apiClient.post<ClubMemberPayment>(`/club-members/${clubMemberId}/payments`, input)
  return res.data
}

export async function deleteClubMemberPayment(paymentId: string): Promise<void> {
  await apiClient.delete(`/club-member-payments/${paymentId}`)
}
