import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import styles from './FormField.module.css'

type FieldMetadata = {
  error?: string
  hint?: string
  label: string
}

type TextFieldProps = FieldMetadata & InputHTMLAttributes<HTMLInputElement>
type TextareaFieldProps = FieldMetadata &
  TextareaHTMLAttributes<HTMLTextAreaElement>
type SelectFieldProps = FieldMetadata & SelectHTMLAttributes<HTMLSelectElement>

function FieldText({ error, hint }: Pick<FieldMetadata, 'error' | 'hint'>) {
  if (!error && !hint) return null

  return <span className={error ? styles.error : styles.hint}>{error ?? hint}</span>
}

export function TextField({ error, hint, id, label, ...props }: TextFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <input
        aria-invalid={Boolean(error)}
        className={styles.control}
        id={id}
        {...props}
      />
      <FieldText error={error} hint={hint} />
    </label>
  )
}

export function TextareaField({
  error,
  hint,
  id,
  label,
  ...props
}: TextareaFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <textarea
        aria-invalid={Boolean(error)}
        className={`${styles.control} ${styles.textarea}`}
        id={id}
        {...props}
      />
      <FieldText error={error} hint={hint} />
    </label>
  )
}

export function SelectField({
  children,
  error,
  hint,
  id,
  label,
  ...props
}: SelectFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.label}>{label}</span>
      <select
        aria-invalid={Boolean(error)}
        className={styles.control}
        id={id}
        {...props}
      >
        {children}
      </select>
      <FieldText error={error} hint={hint} />
    </label>
  )
}
