import { Badge } from '../../components/ui/Badge/Badge'
import { ActionLink } from '../../components/ui/ActionLink/ActionLink'
import { Container } from '../../components/ui/Container/Container'
import styles from './HeroSection.module.css'

export function HeroSection() {
  return (
    <section className={styles.section} aria-labelledby="titulo-principal">
      <Container className={styles.content}>
        <div className={styles.copy}>
          <Badge>Agendamento simples e organizado</Badge>
          <h1 className={styles.title} id="titulo-principal">
            Seu estilo começa com o tempo bem cuidado.
          </h1>
          <p className={styles.description}>
            Escolha o serviço, encontre seu profissional e reserve o melhor
            horário em poucos minutos.
          </p>

          <div className={styles.actions} aria-label="Ações principais">
            <ActionLink href="#agendamentos">Agendar atendimento</ActionLink>
            <ActionLink href="#servicos" variant="ghost">
              Conhecer serviços
            </ActionLink>
          </div>

          <ul className={styles.benefits} aria-label="Benefícios">
            <li>Horários em tempo real</li>
            <li>Profissionais especializados</li>
          </ul>
        </div>

        <div className={styles.visual}>
          <figure className={styles.imageFrame}>
            <img
              src="/images/barbershop-interior.png"
              alt="Interior elegante de uma barbearia com móveis em madeira escura"
            />
          </figure>

          <aside className={styles.preview} aria-label="Resumo de agendamento">
            <p className={styles.previewLabel}>Seu próximo horário</p>
            <h2 className={styles.previewTitle}>Agende sem complicação</h2>
            <ol className={styles.bookingSteps}>
              <li>Escolha o serviço</li>
              <li>Selecione o profissional</li>
              <li>Confirme o horário</li>
            </ol>
          </aside>
        </div>
      </Container>
    </section>
  )
}
