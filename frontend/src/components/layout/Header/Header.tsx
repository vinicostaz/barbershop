import { Brand } from '../../ui/Brand/Brand'
import { Container } from '../../ui/Container/Container'
import { Navigation } from '../Navigation/Navigation'
import styles from './Header.module.css'

export function Header() {
  return (
    <header className={styles.header}>
      <Container className={styles.content}>
        <Brand />
        <Navigation />
      </Container>
    </header>
  )
}
