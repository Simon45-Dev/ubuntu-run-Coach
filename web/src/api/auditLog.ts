import { apiClient } from './client'
import type { AuditLogEntry, Paginated } from './types'

export async function listAuditLog(params: {
  page?: number
  pageSize?: number
  action?: string
  from?: string
  to?: string
}): Promise<Paginated<AuditLogEntry>> {
  const res = await apiClient.get<Paginated<AuditLogEntry>>('/audit-logs', { params })
  return res.data
}
