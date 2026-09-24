import { describe, expect, it } from 'vitest'
import { resolveAvatarUrl } from '@/lib/format'

describe('resolveAvatarUrl', () => {
  it('returns undefined for null/undefined', () => {
    expect(resolveAvatarUrl(null)).toBeUndefined()
    expect(resolveAvatarUrl(undefined)).toBeUndefined()
  })

  it('prefixes a stored avatar path with the asset origin', () => {
    expect(resolveAvatarUrl('/uploads/avatars/abc.png')).toBe('http://localhost:3000/uploads/avatars/abc.png')
  })

  it('passes an already-absolute URL through unchanged', () => {
    const url = 'https://pub-example.r2.dev/avatars/abc.png'
    expect(resolveAvatarUrl(url)).toBe(url)
  })
})
