import { apiClient } from './client'
import type { Message, Paginated } from './types'

export async function getThread(
  counterpartUserId: string,
  page = 1,
  pageSize = 20,
): Promise<Paginated<Message>> {
  const res = await apiClient.get<Paginated<Message>>(`/users/${counterpartUserId}/messages`, {
    params: { page, pageSize },
  })
  return res.data
}

export async function sendMessage(counterpartUserId: string, content: string): Promise<Message> {
  const res = await apiClient.post<Message>(`/users/${counterpartUserId}/messages`, { content })
  return res.data
}

export async function markRead(messageId: string): Promise<Message> {
  const res = await apiClient.patch<Message>(`/messages/${messageId}/read`)
  return res.data
}
