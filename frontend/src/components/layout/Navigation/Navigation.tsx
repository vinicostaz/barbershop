import { useState } from 'react'
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
  const [isOpen, setIsOpen] = useState(false)

  function closeMenu() {
    setIsOpen(false)
  }

  return (
    <div className={styles.wrapper}>
      <button
        className={styles.menuButton}
        type="button"
        aria-controls="navegacao-principal"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Fechar menu' : 'Abrir menu'}
        onClick={() => setIsOpen((currentState) => !currentState)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>

      <nav
        className={`${styles.navigation} ${isOpen ? styles.open : ''}`}
        id="navegacao-principal"
        aria-label="Navegação principal"
      >
        {items.map(({ href, label, variant = 'default' }) => {
          const linkClasses = [
            styles.link,
            variant === 'active' ? styles.active : undefined,
            variant === 'highlight' ? styles.highlight : undefined,
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <a className={linkClasses} href={href} key={href} onClick={closeMenu}>
              {label}
            </a>
          )
        })}
      </nav>
    </div>
  )
}
