import { apiClient } from './client'
import type { PlatformStats } from './types'

export async function getPlatformStats(): Promise<PlatformStats> {
  const res = await apiClient.get<PlatformStats>('/platform-stats')
  return res.data
}
