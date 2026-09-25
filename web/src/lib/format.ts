import { format, parseISO } from 'date-fns'
import { assetBaseUrl } from '@/api/client'

export function formatDate(value: string | Date, pattern = 'd MMM yyyy'): string {
  const date = typeof value === 'string' ? parseISO(value) : value
  return format(date, pattern)
}

export function formatDuration(seconds?: number | null): string {
  if (seconds === undefined || seconds === null) return '-'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatDistance(km?: number | string | null): string {
  if (km === undefined || km === null) return '-'
  const n = typeof km === 'string' ? Number(km) : km
  return `${n.toFixed(2)} km`
}

const currencyFormatter = new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' })

export function formatCurrency(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount
  return currencyFormatter.format(n)
}

export function resolveAvatarUrl(avatarUrl: string | null | undefined): string | undefined {
  if (!avatarUrl) return undefined
  // Already absolute (e.g. a Cloudflare R2 public URL) - use as-is, don't
  // prefix with the API origin. Only today's local-disk /uploads/... paths
  // are relative and need that prefix.
  return /^https?:\/\//.test(avatarUrl) ? avatarUrl : `${assetBaseUrl}${avatarUrl}`
}
