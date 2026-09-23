import { apiClient } from './client'
import type { CheckIn, Consent, ConsentType, Paginated } from './types'

export async function listConsents(
  athleteId: string,
  page = 1,
  pageSize = 20,
): Promise<Paginated<Consent>> {
  const res = await apiClient.get<Paginated<Consent>>(`/athletes/${athleteId}/consents`, {
    params: { page, pageSize },
  })
  return res.data
}

export async function grantConsent(
  athleteId: string,
  input: { consentType: ConsentType; policyVersion: string },
): Promise<Consent> {
  const res = await apiClient.post<Consent>(`/athletes/${athleteId}/consents`, input)
  return res.data
}

export async function withdrawConsent(consentId: string): Promise<Consent> {
  const res = await apiClient.patch<Consent>(`/consents/${consentId}/withdraw`)
  return res.data
}

export async function getCheckIns(
  athleteId: string,
  page = 1,
  pageSize = 20,
): Promise<Paginated<CheckIn>> {
  const res = await apiClient.get<Paginated<CheckIn>>(`/athletes/${athleteId}/check-ins`, {
    params: { page, pageSize },
  })
  return res.data
}

export interface SubmitCheckInInput {
  date: string
  sleepQuality?: number
  energy?: number
  soreness?: number
  stress?: number
  motivation?: number
  pain?: string
}

export async function submitCheckIn(athleteId: string, input: SubmitCheckInInput): Promise<CheckIn> {
  const res = await apiClient.put<CheckIn>(`/athletes/${athleteId}/check-ins`, input)
  return res.data
}
