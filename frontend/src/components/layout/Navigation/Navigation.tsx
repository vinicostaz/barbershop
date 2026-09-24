import styles from './Navigation.module.css'

export type NavigationItem = {
  href: string
  label: string
  variant?: 'default' | 'active' | 'highlight'
}

type NavigationProps = {
  items?: NavigationItem[]
}

const defaultItems: NavigationItem[] = [
  { href: '#inicio', label: 'Início', variant: 'active' },
  { href: '#servicos', label: 'Serviços' },
  { href: '#profissionais', label: 'Profissionais' },
  { href: '#agendamentos', label: 'Agendamentos', variant: 'highlight' },
]

export function Navigation({ items = defaultItems }: NavigationProps) {
  return (
    <nav className={styles.navigation} aria-label="Navegação principal">
      {items.map(({ href, label, variant = 'default' }) => {
        const linkClasses = [
          styles.link,
          variant === 'active' ? styles.active : undefined,
          variant === 'highlight' ? styles.highlight : undefined,
        ]
          .filter(Boolean)
          .join(' ')

        return (
          <a className={linkClasses} href={href} key={href}>
            {label}
          </a>
        )
      })}
    </nav>
  )
}
