import { use } from 'react'
import { AuthContext } from './AuthContext'

export function useAuth() {
  const context = use(AuthContext)

  if (!context) {
    throw new Error('useAuth deve ser utilizado dentro de AuthProvider.')
  }

  return context
}
