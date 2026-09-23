import { apiClient } from './client'
import type { Paginated, PublicUser, Role, UserStatus } from './types'

export async function getCurrentUser(): Promise<PublicUser> {
  const res = await apiClient.get<PublicUser>('/users/me')
  return res.data
}

export async function listUsers(params?: {
  page?: number
  pageSize?: number
  search?: string
  role?: Role
}): Promise<Paginated<PublicUser>> {
  const res = await apiClient.get<Paginated<PublicUser>>('/users', { params })
  return res.data
}

export async function updateUserStatus(id: string, status: UserStatus): Promise<PublicUser> {
  const res = await apiClient.patch<PublicUser>(`/users/${id}/status`, { status })
  return res.data
}

export async function deleteUser(id: string): Promise<void> {
  await apiClient.delete(`/users/${id}`)
}
