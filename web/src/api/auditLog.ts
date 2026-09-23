import { apiClient } from './client'
import type { AuditLogEntry, Paginated } from './types'

export async function listAuditLog(page = 1, pageSize = 20): Promise<Paginated<AuditLogEntry>> {
  const res = await apiClient.get<Paginated<AuditLogEntry>>('/audit-logs', { params: { page, pageSize } })
  return res.data
}
