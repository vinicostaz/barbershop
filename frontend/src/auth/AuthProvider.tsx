import { useState, type PropsWithChildren } from 'react'
import { AuthContext } from './AuthContext'
import {
  authService,
  type AuthSession,
  type LoginInput,
  type RegisterInput,
  type UserRole,
} from '../services/auth'

const SESSION_STORAGE_KEY = 'barbershop:auth-session'
const userRoles: UserRole[] = ['CLIENTE', 'BARBEIRO', 'ADMINISTRADOR']

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== 'object') return false

  const session = value as Partial<AuthSession>
  const user = session.usuario

  return Boolean(
    typeof session.token === 'string' &&
      session.token.length > 0 &&
      user &&
      typeof user.id === 'string' &&
      typeof user.nome === 'string' &&
      typeof user.role === 'string' &&
      userRoles.includes(user.role as UserRole),
  )
}

function loadStoredSession() {
  try {
    const storedSession = window.localStorage.getItem(SESSION_STORAGE_KEY)
    if (!storedSession) return null

    const parsedSession: unknown = JSON.parse(storedSession)
    return isAuthSession(parsedSession) ? parsedSession : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(loadStoredSession)

  function saveSession(nextSession: AuthSession) {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify(nextSession),
    )
    setSession(nextSession)
  }

  async function login(input: LoginInput) {
    saveSession(await authService.login(input))
  }

  async function register(input: RegisterInput) {
    saveSession(await authService.register(input))
  }

  function logout() {
    window.localStorage.removeItem(SESSION_STORAGE_KEY)
    setSession(null)
  }

  const value = {
    isAuthenticated: Boolean(session),
    login,
    logout,
    register,
    session,
  }

  return <AuthContext value={value}>{children}</AuthContext>
}
