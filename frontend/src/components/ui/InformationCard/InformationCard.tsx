import styles from './InformationCard.module.css'

type InformationCardProps = {
  description: string
  id: string
  step: string
  title: string
}

export function InformationCard({
  description,
  id,
  step,
  title,
}: InformationCardProps) {
  const titleId = `${id}-titulo`

  return (
    <article className={styles.card} id={id} aria-labelledby={titleId}>
      <span className={styles.step} aria-hidden="true">
        {step}
      </span>
      <h3 className={styles.title} id={titleId}>
        {title}
      </h3>
      <p className={styles.description}>{description}</p>
    </article>
  )
}
