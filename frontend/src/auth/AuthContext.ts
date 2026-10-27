import { createContext } from 'react'
import type {
  AuthSession,
  LoginInput,
  RegisterInput,
} from '../services/auth'

export type AuthContextValue = {
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<AuthSession>
  logout: () => void
  register: (input: RegisterInput) => Promise<AuthSession>
  session: AuthSession | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
