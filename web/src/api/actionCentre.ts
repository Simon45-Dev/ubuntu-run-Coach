import { apiClient } from './client'
import type { ActionCentreAlert } from './types'

export async function getActionCentre(coachId: string): Promise<{ alerts: ActionCentreAlert[] }> {
  const res = await apiClient.get<{ alerts: ActionCentreAlert[] }>(
    `/coaches/${coachId}/action-centre`,
  )
  return res.data
}
