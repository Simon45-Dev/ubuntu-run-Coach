import { apiClient } from './client'

export interface PushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
  userAgent?: string
}

export async function subscribeToPush(input: PushSubscriptionInput): Promise<void> {
  await apiClient.post('/push-subscriptions', input)
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  await apiClient.delete('/push-subscriptions', { params: { endpoint } })
}
