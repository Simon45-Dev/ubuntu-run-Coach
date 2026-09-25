import { apiClient } from './client'
import type { Organisation, OrganisationType, Paginated } from './types'

export async function listOrganisations(page = 1, pageSize = 20): Promise<Paginated<Organisation>> {
  const res = await apiClient.get<Paginated<Organisation>>('/organisations', { params: { page, pageSize } })
  return res.data
}

export async function getOrganisation(id: string): Promise<Organisation> {
  const res = await apiClient.get<Organisation>(`/organisations/${id}`)
  return res.data
}

export interface CreateOrganisationInput {
  name: string
  type?: OrganisationType
}

export async function createOrganisation(input: CreateOrganisationInput): Promise<Organisation> {
  const res = await apiClient.post<Organisation>('/organisations', input)
  return res.data
}

export interface UpdateOrganisationInput {
  name?: string
  type?: OrganisationType
}

export async function updateOrganisation(id: string, input: UpdateOrganisationInput): Promise<Organisation> {
  const res = await apiClient.patch<Organisation>(`/organisations/${id}`, input)
  return res.data
}

export async function uploadOrganisationLogo(id: string, file: File): Promise<Organisation> {
  const formData = new FormData()
  formData.append('file', file)
  const res = await apiClient.post<Organisation>(`/organisations/${id}/logo`, formData)
  return res.data
}

export async function deleteOrganisationLogo(id: string): Promise<Organisation> {
  const res = await apiClient.delete<Organisation>(`/organisations/${id}/logo`)
  return res.data
}
