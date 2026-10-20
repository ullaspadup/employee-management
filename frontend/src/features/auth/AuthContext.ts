import { createContext } from 'react'
import type { LoginRequest, User } from '../../types/auth'

export const AUTH_TOKEN_STORAGE_KEY = 'employee-management.access-token'

export interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  isLoading: boolean
  sessionExpired: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: (reason?: 'session-expired') => void
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined)