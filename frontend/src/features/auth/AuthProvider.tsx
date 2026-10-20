import { useEffect, useState, type PropsWithChildren } from 'react'
import { ApiError, apiClient } from '../../lib/api-client'
import type { LoginRequest, TokenResponse, User } from '../../types/auth'
import { AUTH_TOKEN_STORAGE_KEY, AuthContext } from './AuthContext'

function readStoredToken(): string | null {
  return sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [token, setToken] = useState<string | null>(() => readStoredToken())
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(token !== null)
  const [sessionExpired, setSessionExpired] = useState(false)

  useEffect(() => {
    const storedToken = readStoredToken()
    if (!storedToken) {
      return
    }

    const tokenToRestore = storedToken
    const controller = new AbortController()

    async function restoreUser() {
      try {
        const response = await apiClient.get<User>('/api/v1/auth/me', {
          token: tokenToRestore,
          signal: controller.signal,
        })
        if (!controller.signal.aborted) {
          setUser(response.data ?? null)
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return
        }

        if (error instanceof ApiError && error.status === 401) {
          sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
          setToken(null)
        }
        setUser(null)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    void restoreUser()
    return () => controller.abort()
  }, [])

  async function login(credentials: LoginRequest): Promise<void> {
    setIsLoading(true)
    setSessionExpired(false)
    setUser(null)

    try {
      const loginResponse = await apiClient.post<TokenResponse>(
        '/api/v1/auth/login',
        credentials,
      )
      const accessToken = loginResponse.data?.access_token
      if (!accessToken) {
        throw new Error('The login response did not include an access token.')
      }

      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, accessToken)
      setToken(accessToken)

      const userResponse = await apiClient.get<User>('/api/v1/auth/me', {
        token: accessToken,
      })
      if (!userResponse.data) {
        throw new Error('The user profile response was empty.')
      }

      setUser(userResponse.data)
    } catch (error) {
      sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
      setToken(null)
      setUser(null)
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  function logout(reason?: 'session-expired'): void {
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
    setSessionExpired(reason === 'session-expired')
  }

  const value = {
    user,
    token,
    isAuthenticated: token !== null && user !== null,
    isLoading,
    sessionExpired,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}