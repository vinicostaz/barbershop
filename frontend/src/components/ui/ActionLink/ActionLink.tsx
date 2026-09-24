import type { PropsWithChildren } from 'react'
import styles from './ActionLink.module.css'

type ActionLinkProps = PropsWithChildren<{
  href: string
  variant?: 'primary' | 'secondary'
}>

export function ActionLink({
  children,
  href,
  variant = 'primary',
}: ActionLinkProps) {
  return (
    <a className={`${styles.action} ${styles[variant]}`} href={href}>
      {children}
    </a>
  )
}
