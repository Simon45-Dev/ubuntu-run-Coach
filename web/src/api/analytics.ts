import { apiClient } from './client'
import type { AnalyticsSummary } from './types'

export async function getAnalyticsSummary(
  athleteId: string,
  params?: { from?: string; to?: string },
): Promise<AnalyticsSummary> {
  const res = await apiClient.get<AnalyticsSummary>(`/athletes/${athleteId}/analytics`, { params })
  return res.data
}
