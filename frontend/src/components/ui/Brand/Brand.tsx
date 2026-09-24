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
      <span className={styles.mark} aria-hidden="true">
        BS
      </span>
      <span>BarberShop</span>
    </a>
  )
}
