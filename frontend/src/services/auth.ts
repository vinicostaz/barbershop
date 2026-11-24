import { apiRequest } from './api'

export type UserRole = 'CLIENTE' | 'BARBEIRO' | 'ADMINISTRADOR'

export type AuthUser = {
  id: string
  nome: string
  role: UserRole
}

export type AuthSession = {
  token: string
  usuario: AuthUser
}

export type UserProfile = {
  ativo: boolean
  criadoEm: string
  email: string
  id: string
  nome: string
  role: UserRole
  telefone: string | null
}

export type LoginInput = {
  email: string
  senha: string
}

export type RegisterInput = {
  email: string
  nome: string
  senha: string
  telefone?: string
}

export type UpdateProfileInput = {
  email: string
  nome: string
  telefone?: string
}

function withAuthorization(token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return { ...options, headers }
}

export const authService = {
  getProfile(token: string, signal?: AbortSignal) {
    return apiRequest<UserProfile>(
      '/auth/me',
      withAuthorization(token, { signal }),
    )
  },

  login(input: LoginInput) {
    return apiRequest<AuthSession>('/auth/login', {
      body: JSON.stringify(input),
      method: 'POST',
    })
  },

  register(input: RegisterInput) {
    return apiRequest<AuthSession>('/auth/registrar', {
      body: JSON.stringify({ ...input, role: 'CLIENTE' }),
      method: 'POST',
    })
  },

  updateProfile(input: UpdateProfileInput, token: string) {
    return apiRequest<UserProfile>(
      '/auth/me',
      withAuthorization(token, {
        body: JSON.stringify(input),
        method: 'PATCH',
      }),
    )
  },
}
