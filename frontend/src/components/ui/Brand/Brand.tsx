import { Link } from 'react-router'
import styles from './Brand.module.css'

type BrandProps = {
  to?: string
  variant?: 'default' | 'footer'
}

export function Brand({ to = '/', variant = 'default' }: BrandProps) {
  const brandClasses = [
    styles.brand,
    variant === 'footer' ? styles.footer : undefined,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Link className={brandClasses} to={to} aria-label="BarberShop - início">
      <img
        className={styles.logo}
        src="/images/barbershop-logo.png"
        alt=""
        aria-hidden="true"
      />
      <span>BarberShop</span>
    </Link>
  )
}
