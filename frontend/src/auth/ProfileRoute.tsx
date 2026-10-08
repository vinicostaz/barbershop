import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { UserRole } from '../services/auth'
import { getRoleHomePath } from './roleRoutes'
import { useAuth } from './useAuth'

type ProfileRouteProps = PropsWithChildren<{
  allowedRoles: UserRole[]
}>

export function ProfileRoute({ allowedRoles, children }: ProfileRouteProps) {
  const location = useLocation()
  const { session } = useAuth()

  if (!session) {
    return (
      <Navigate
        replace
        state={{ requestedPath: location.pathname }}
        to="/login"
      />
    )
  }

  if (!allowedRoles.includes(session.usuario.role)) {
    return <Navigate replace to={getRoleHomePath(session.usuario.role)} />
  }

  return children
}
