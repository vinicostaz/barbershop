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

function FieldLabel({ label, required }: Pick<FieldMetadata, 'label'> & { required?: boolean }) {
  return (
    <span className={styles.label}>
      {label}
      {required && (
        <span aria-hidden="true" className={styles.requiredIndicator}>
          {' '}*
        </span>
      )}
    </span>
  )
}

export function TextField({
  error,
  hint,
  id,
  label,
  required,
  ...props
}: TextFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <FieldLabel label={label} required={required} />
      <input
        aria-invalid={Boolean(error)}
        className={styles.control}
        id={id}
        required={required}
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
  required,
  ...props
}: TextareaFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <FieldLabel label={label} required={required} />
      <textarea
        aria-invalid={Boolean(error)}
        className={`${styles.control} ${styles.textarea}`}
        id={id}
        required={required}
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
  required,
  ...props
}: SelectFieldProps) {
  return (
    <label className={styles.field} htmlFor={id}>
      <FieldLabel label={label} required={required} />
      <select
        aria-invalid={Boolean(error)}
        className={styles.control}
        id={id}
        required={required}
        {...props}
      >
        {children}
      </select>
      <FieldText error={error} hint={hint} />
    </label>
  )
}
