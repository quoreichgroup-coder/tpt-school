import * as SecureStore from 'expo-secure-store'

const ACCESS_KEY = 'qschool.accessToken'
const REFRESH_KEY = 'qschool.refreshToken'
type RefreshResult = { token: string | null; temporaryFailure: boolean }
let refreshRequest: Promise<RefreshResult> | null = null

async function refreshAccessToken(apiUrl: string) {
  if (refreshRequest) return refreshRequest
  refreshRequest = (async () => {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
    if (!refreshToken) return { token: null, temporaryFailure: false }
    let response: Response
    try {
      response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
    } catch {
      // Keep credentials when the refresh endpoint is temporarily unreachable.
      return { token: null, temporaryFailure: true }
    }

    if (response.status === 400 || response.status === 401) {
      await Promise.all([
        SecureStore.deleteItemAsync(ACCESS_KEY),
        SecureStore.deleteItemAsync(REFRESH_KEY),
      ])
      return { token: null, temporaryFailure: false }
    }

    if (!response.ok) return { token: null, temporaryFailure: true }

    try {
      const result: { accessToken?: unknown; refreshToken?: unknown } = await response.json()
      if (typeof result.accessToken !== 'string' || typeof result.refreshToken !== 'string') return { token: null, temporaryFailure: true }

      // Persist the rotated refresh token first so a later request can recover
      // if writing the access token fails.
      await SecureStore.setItemAsync(REFRESH_KEY, result.refreshToken)
      await SecureStore.setItemAsync(ACCESS_KEY, result.accessToken)
      return { token: result.accessToken, temporaryFailure: false }
    } catch {
      return { token: null, temporaryFailure: true }
    }
  })().finally(() => { refreshRequest = null })
  return refreshRequest
}

export async function apiFetch(apiUrl: string, path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers)
  const accessToken = await SecureStore.getItemAsync(ACCESS_KEY)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  const response = await fetch(`${apiUrl}${path}`, { ...init, headers })
  if (response.status !== 401) return response

  const renewal = await refreshAccessToken(apiUrl)
  if (renewal.temporaryFailure) throw new Error('Le renouvellement de session est temporairement indisponible.')
  if (!renewal.token) return response
  headers.set('Authorization', `Bearer ${renewal.token}`)
  return fetch(`${apiUrl}${path}`, { ...init, headers })
}

export async function storeMobileCredentials(accessToken: string, refreshToken: string) {
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, refreshToken),
  ])
}

export async function clearMobileCredentials() {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ])
}

export async function revokeMobileCredentials(apiUrl: string) {
  const refreshToken = await SecureStore.getItemAsync(REFRESH_KEY)
  if (refreshToken) {
    await fetch(`${apiUrl}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {})
  }
  await clearMobileCredentials()
}
