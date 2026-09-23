import { apiClient } from './client'
import type { Notification, Paginated } from './types'

export async function listNotifications(params?: {
  page?: number
  pageSize?: number
  unreadOnly?: boolean
}): Promise<Paginated<Notification>> {
  const res = await apiClient.get<Paginated<Notification>>('/notifications', { params })
  return res.data
}

export async function markNotificationRead(id: string): Promise<Notification> {
  const res = await apiClient.patch<Notification>(`/notifications/${id}/read`)
  return res.data
}
