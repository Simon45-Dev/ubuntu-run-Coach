import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1'

// Access token lives only in memory - never localStorage/sessionStorage. The
// refresh token is an httpOnly cookie the frontend never reads directly.
let accessToken: string | null = null
let onSessionExpired: (() => void) | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function setOnSessionExpired(handler: (() => void) | null): void {
  onSessionExpired = handler
}

export const apiClient = axios.create({ baseURL, withCredentials: true })

apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.set('Authorization', `Bearer ${accessToken}`)
  }
  return config
})

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean
}

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  refreshPromise ??= axios
    .post<{ accessToken: string | null }>(
      `${baseURL}/auth/refresh`,
      {},
      { withCredentials: true },
    )
    .then((res) => res.data.accessToken)
    .catch(() => null)
    .finally(() => {
      refreshPromise = null
    })
  return refreshPromise
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined
    const isAuthEndpoint =
      config?.url?.includes('/auth/login') || config?.url?.includes('/auth/refresh')

    if (error.response?.status === 401 && config && !config._retried && !isAuthEndpoint) {
      config._retried = true
      const newToken = await refreshAccessToken()
      if (newToken) {
        setAccessToken(newToken)
        config.headers.set('Authorization', `Bearer ${newToken}`)
        return apiClient(config)
      }
      setAccessToken(null)
      onSessionExpired?.()
    }
    return Promise.reject(error)
  },
)
