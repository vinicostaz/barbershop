import { useState } from 'react'
import { NavLink } from 'react-router'
import { useAuth } from '../../../auth/useAuth'
import styles from './Navigation.module.css'

export type NavigationItem = {
  label: string
  to: string
  variant?: 'default' | 'highlight'
}

type NavigationProps = {
  items?: NavigationItem[]
}

const defaultItems: NavigationItem[] = [
  { label: 'Início', to: '/' },
  { label: 'Serviços', to: '/servicos' },
  { label: 'Profissionais', to: '/profissionais' },
  { label: 'Agendamentos', to: '/agendamentos', variant: 'highlight' },
]

export function Navigation({ items = defaultItems }: NavigationProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { logout, session } = useAuth()

  function closeMenu() {
    setIsOpen(false)
  }

  function handleLogout() {
    logout()
    closeMenu()
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
        {items.map(({ label, to, variant = 'default' }) => (
          <NavLink
            className={({ isActive }) =>
              [
                styles.link,
                isActive ? styles.active : undefined,
                variant === 'highlight' ? styles.highlight : undefined,
              ]
                .filter(Boolean)
                .join(' ')
            }
            end={to === '/'}
            key={to}
            onClick={closeMenu}
            to={to}
          >
            {label}
          </NavLink>
        ))}

        {session ? (
          <div className={styles.session}>
            <span className={styles.userName} title={session.usuario.nome}>
              Olá, {session.usuario.nome.split(' ')[0]}
            </span>
            <button className={styles.logout} onClick={handleLogout} type="button">
              Sair
            </button>
          </div>
        ) : (
          <NavLink
            className={({ isActive }) =>
              [styles.link, isActive ? styles.active : undefined]
                .filter(Boolean)
                .join(' ')
            }
            onClick={closeMenu}
            to="/login"
          >
            Entrar
          </NavLink>
        )}
      </nav>
    </div>
  )
}
