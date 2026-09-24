import { ActionLink } from '../../components/ui/ActionLink/ActionLink'
import { Container } from '../../components/ui/Container/Container'
import styles from './HeroSection.module.css'

export function HeroSection() {
  return (
    <section className={styles.section} aria-labelledby="titulo-principal">
      <Container className={styles.content}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>Gestão e agendamento para barbearias</p>
          <h1 className={styles.title} id="titulo-principal">
            Seu próximo atendimento começa com um horário bem organizado.
          </h1>
          <p className={styles.description}>
            Consulte serviços, encontre profissionais e acompanhe seus agendamentos
            em um só lugar.
          </p>

          <div className={styles.actions} aria-label="Ações principais">
            <ActionLink href="#servicos">Ver serviços</ActionLink>
            <ActionLink href="#como-funciona" variant="secondary">
              Como funciona
            </ActionLink>
          </div>
        </div>

        <aside className={styles.preview} aria-label="Resumo de agendamento">
          <p className={styles.previewLabel}>Próximo passo</p>
          <h2 className={styles.previewTitle}>
            Encontre o melhor horário para você
          </h2>
          <ol className={styles.bookingSteps}>
            <li>Escolha o serviço</li>
            <li>Selecione o profissional</li>
            <li>Confirme o horário</li>
          </ol>
        </aside>
      </Container>
    </section>
  )
}
