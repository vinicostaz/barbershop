import { ActionLink } from '../ActionLink/ActionLink'
import styles from './ProfessionalCard.module.css'

type ProfessionalCardProps = {
  canSchedule: boolean
  description: string
  id: string
  index: number
  initials: string
  name: string
  rating: number | null
  reviewCount: number
  specialties: string[]
}

export function ProfessionalCard({
  canSchedule,
  description,
  id,
  index,
  initials,
  name,
  rating,
  reviewCount,
  specialties,
}: ProfessionalCardProps) {
  const titleId = `profissional-${id}`

  return (
    <article className={styles.card} aria-labelledby={titleId}>
      <header className={styles.header}>
        <span className={styles.avatar} aria-hidden="true">
          {initials}
        </span>
        <span className={styles.index} aria-hidden="true">
          {String(index).padStart(2, '0')}
        </span>
      </header>

      <div className={styles.content}>
        <span className={styles.role}>Barbeiro especialista</span>
        <h3 id={titleId}>{name}</h3>
        <div
          aria-label={
            rating === null
              ? 'Profissional ainda sem avaliações'
              : `Nota ${rating.toFixed(1)} de 5, baseada em ${reviewCount} avaliações`
          }
          className={styles.rating}
        >
          <span aria-hidden="true">★</span>
          <strong>{rating === null ? 'Novo' : rating.toFixed(1)}</strong>
          <small>
            {reviewCount === 0
              ? 'Sem avaliações'
              : `${reviewCount} ${reviewCount === 1 ? 'avaliação' : 'avaliações'}`}
          </small>
        </div>
        <p>{description}</p>
      </div>

      <ul className={styles.specialties} aria-label={`Especialidades de ${name}`}>
        {(specialties.length > 0
          ? specialties
          : ['Especialidades em atualização']
        ).map((specialty) => (
          <li key={specialty}>{specialty}</li>
        ))}
      </ul>

      <footer className={styles.footer}>
        {canSchedule ? (
          <>
            <span>Escolha seu especialista</span>
            <ActionLink to={`/agendamentos?profissional=${id}`}>
              Selecionar
            </ActionLink>
          </>
        ) : (
          <span className={styles.restrictedAction}>
            Seleção para agendamento disponível somente para clientes
          </span>
        )}
      </footer>
    </article>
  )
}
