import { apiClient } from './client'
import type { AuthContext } from './types'

export interface LoginInput {
  email: string
  password: string
  mfaCode?: string
}

export interface RegisterInput {
  email: string
  password: string
  name: string
  organisationName: string
}

export interface AcceptInviteInput {
  token: string
  password: string
}

export async function login(input: LoginInput): Promise<{ accessToken: string }> {
  const res = await apiClient.post<{ accessToken: string }>('/auth/login', input)
  return res.data
}

export async function register(input: RegisterInput): Promise<{ accessToken: string }> {
  const res = await apiClient.post<{ accessToken: string }>('/auth/register', input)
  return res.data
}

export async function acceptInvite(input: AcceptInviteInput): Promise<{ accessToken: string }> {
  const res = await apiClient.post<{ accessToken: string }>('/auth/accept-invite', input)
  return res.data
}

export async function refresh(): Promise<{ accessToken: string | null }> {
  const res = await apiClient.post<{ accessToken: string | null }>('/auth/refresh')
  return res.data
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout')
}

export async function fetchMe(): Promise<AuthContext> {
  const res = await apiClient.get<AuthContext>('/auth/me')
  return res.data
}
