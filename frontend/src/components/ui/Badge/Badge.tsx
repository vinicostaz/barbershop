import type { PropsWithChildren } from 'react'
import styles from './Badge.module.css'

type BadgeProps = PropsWithChildren<{
  tone?: 'blue' | 'brown' | 'neutral'
}>

export function Badge({ children, tone = 'blue' }: BadgeProps) {
  return <span className={`${styles.badge} ${styles[tone]}`}>{children}</span>
}
