import { ActionLink } from '../ActionLink/ActionLink'
import styles from './ServiceCard.module.css'

type ServiceCardProps = {
  canSchedule: boolean
  description: string
  duration: number
  id: string
  index: number
  name: string
  price: number
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  minimumFractionDigits: 2,
  style: 'currency',
})

export function ServiceCard({
  canSchedule,
  description,
  duration,
  id,
  index,
  name,
  price,
}: ServiceCardProps) {
  const titleId = `servico-${id}`

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <div className={styles.topline}>
        <span className={styles.index} aria-hidden="true">
          {String(index).padStart(2, '0')}
        </span>
        <span className={styles.duration}>{duration} min</span>
      </div>

      <div className={styles.content}>
        <h3 id={titleId}>{name}</h3>
        <p>{description}</p>
      </div>

      <footer className={styles.footer}>
        <div>
          <span className={styles.priceLabel}>A partir de</span>
          <strong>{currencyFormatter.format(price)}</strong>
        </div>
        {canSchedule ? (
          <ActionLink to={`/agendamentos?servico=${id}`}>Agendar</ActionLink>
        ) : (
          <span className={styles.restrictedAction}>
            Agendamento disponível para clientes
          </span>
        )}
      </footer>
    </article>
  )
}
