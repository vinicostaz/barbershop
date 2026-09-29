import type { ButtonHTMLAttributes, PropsWithChildren } from 'react'
import styles from './Button.module.css'

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    size?: 'small' | 'medium'
    variant?: 'primary' | 'secondary' | 'ghost'
  }
>

export function Button({
  children,
  className,
  size = 'medium',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  const buttonClasses = [styles.button, styles[variant], styles[size], className]
    .filter(Boolean)
    .join(' ')

  return (
    <button className={buttonClasses} type={type} {...props}>
      {children}
    </button>
  )
}
