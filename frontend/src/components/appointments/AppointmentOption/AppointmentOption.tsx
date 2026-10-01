import styles from './AppointmentOption.module.css'

type AppointmentOptionProps = {
  description?: string
  label: string
  meta?: string
  onSelect: () => void
  selected: boolean
  visual: string
}

export function AppointmentOption({
  description,
  label,
  meta,
  onSelect,
  selected,
  visual,
}: AppointmentOptionProps) {
  return (
    <button
      aria-pressed={selected}
      className={`${styles.option} ${selected ? styles.selected : ''}`}
      onClick={onSelect}
      type="button"
    >
      <span className={styles.visual} aria-hidden="true">
        {visual}
      </span>
      <span className={styles.content}>
        <strong>{label}</strong>
        {description && <span>{description}</span>}
      </span>
      {meta && <span className={styles.meta}>{meta}</span>}
      <span className={styles.indicator} aria-hidden="true" />
    </button>
  )
}
