import type { PropsWithChildren } from 'react'
import { Link } from 'react-router'
import styles from './ActionLink.module.css'

type ActionLinkProps = PropsWithChildren<{
  to: string
  variant?: 'primary' | 'secondary' | 'ghost'
}>

export function ActionLink({
  children,
  to,
  variant = 'primary',
}: ActionLinkProps) {
  return (
    <Link className={`${styles.action} ${styles[variant]}`} to={to}>
      {children}
    </Link>
  )
}
