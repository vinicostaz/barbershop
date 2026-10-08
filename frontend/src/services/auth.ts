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

export const authService = {
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
}
