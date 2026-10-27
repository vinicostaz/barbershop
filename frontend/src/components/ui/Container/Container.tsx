import type { PropsWithChildren } from 'react'
import styles from './Container.module.css'

type ContainerProps = PropsWithChildren<{
  className?: string
}>

export function Container({ children, className }: ContainerProps) {
  const containerClasses = [styles.container, className].filter(Boolean).join(' ')

  return <div className={containerClasses}>{children}</div>
}
