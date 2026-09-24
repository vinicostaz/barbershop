import { Brand } from '../../ui/Brand/Brand'
import { Container } from '../../ui/Container/Container'
import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <Container className={styles.content}>
        <div>
          <Brand variant="footer" />
          <p className={styles.description}>
            Gestão e agendamento de atendimentos para barbearias.
          </p>
        </div>

        <p className={styles.note}>Projeto Final Integrador</p>
      </Container>
    </footer>
  )
}
