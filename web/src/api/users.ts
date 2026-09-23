import { apiClient } from './client'
import type { PublicUser } from './types'

export async function getCurrentUser(): Promise<PublicUser> {
  const res = await apiClient.get<PublicUser>('/users/me')
  return res.data
}
