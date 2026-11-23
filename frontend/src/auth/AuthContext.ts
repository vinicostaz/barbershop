import { createContext } from 'react'
import type {
  AuthSession,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UserProfile,
} from '../services/auth'

export type AuthContextValue = {
  isAuthenticated: boolean
  login: (input: LoginInput) => Promise<AuthSession>
  logout: () => void
  register: (input: RegisterInput) => Promise<AuthSession>
  session: AuthSession | null
  updateProfile: (input: UpdateProfileInput) => Promise<UserProfile>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
