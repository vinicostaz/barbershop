import styles from './Brand.module.css'

type BrandProps = {
  href?: string
  variant?: 'default' | 'footer'
}

export function Brand({ href = '#inicio', variant = 'default' }: BrandProps) {
  const brandClasses = [
    styles.brand,
    variant === 'footer' ? styles.footer : undefined,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <a className={brandClasses} href={href} aria-label="BarberShop - início">
      <img
        className={styles.logo}
        src="/images/barbershop-logo.png"
        alt=""
        aria-hidden="true"
      />
      <span>BarberShop</span>
    </a>
  )
}
