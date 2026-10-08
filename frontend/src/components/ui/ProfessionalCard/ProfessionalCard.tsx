import { ActionLink } from '../ActionLink/ActionLink'
import styles from './ProfessionalCard.module.css'

type ProfessionalCardProps = {
  canSchedule: boolean
  description: string
  id: string
  index: number
  initials: string
  name: string
  specialties: string[]
}

export function ProfessionalCard({
  canSchedule,
  description,
  id,
  index,
  initials,
  name,
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
