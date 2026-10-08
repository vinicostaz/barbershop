import { createContext } from 'react'
import type {
  AuthSession,
  LoginInput,
  RegisterInput,
} from '../services/auth'

export type AuthContextValue = {
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<void>
  logout: () => void
  register: (input: RegisterInput) => Promise<void>
  session: AuthSession | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
