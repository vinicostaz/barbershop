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
  return (
    <article className={styles.card}>
      <span className={styles.step} aria-hidden="true">
        {step}
      </span>
      <h3 className={styles.title} id={id}>
        {title}
      </h3>
      <p className={styles.description}>{description}</p>
    </article>
  )
}
