import { ActionLink } from '../../ui/ActionLink/ActionLink'
import { Badge } from '../../ui/Badge/Badge'
import { Container } from '../../ui/Container/Container'
import styles from './RoutePage.module.css'

type RoutePageProps = {
  description: string
  eyebrow: string
  title: string
}

export function RoutePage({ description, eyebrow, title }: RoutePageProps) {
  return (
    <section className={styles.section} aria-labelledby="titulo-da-pagina">
      <Container className={styles.content}>
        <Badge>{eyebrow}</Badge>
        <h1 className={styles.title} id="titulo-da-pagina">
          {title}
        </h1>
        <p className={styles.description}>{description}</p>

        <div className={styles.notice}>
          <span className={styles.noticeLabel}>Estrutura inicial</span>
          <h2>Esta página está pronta para receber suas funcionalidades.</h2>
          <p>
            Nesta etapa configuramos a navegação e a URL. O conteúdo completo
            será desenvolvido nas próximas tarefas do backlog.
          </p>
          <ActionLink to="/" variant="ghost">
            Voltar para o início
          </ActionLink>
        </div>
      </Container>
    </section>
  )
}
