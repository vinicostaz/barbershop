import type { UserRole } from '../services/auth'

const roleHomePaths: Record<UserRole, string> = {
  ADMINISTRADOR: '/admin',
  BARBEIRO: '/profissional',
  CLIENTE: '/agendamentos',
}

export function getRoleHomePath(role: UserRole) {
  return roleHomePaths[role]
}
