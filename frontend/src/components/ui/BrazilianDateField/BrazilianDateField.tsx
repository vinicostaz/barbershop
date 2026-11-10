import { useRef } from 'react'
import {
  formatBrazilianDate,
  maskBrazilianDate,
  parseBrazilianDate,
} from './brazilianDate'
import styles from './BrazilianDateField.module.css'

type BrazilianDateFieldProps = {
  id: string
  label: string
  min: string
  onChange: (value: string) => void
  value: string
}

export function BrazilianDateField({
  id,
  label,
  min,
  onChange,
  value,
}: BrazilianDateFieldProps) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const pickerValue = parseBrazilianDate(value) ?? ''

  function openPicker() {
    const picker = pickerRef.current
    if (!picker) return

    const pickerWithOptionalShow = picker as HTMLInputElement & {
      showPicker?: () => void
    }
    if (typeof pickerWithOptionalShow.showPicker === 'function') {
      pickerWithOptionalShow.showPicker()
      return
    }

    picker.click()
  }

  return (
    <label className={styles.field} htmlFor={id}>
      <span>
        {label}
        <span aria-hidden="true" className={styles.requiredIndicator}>
          {' '}*
        </span>
      </span>
      <span className={styles.control}>
        <input
          autoComplete="off"
          id={id}
          inputMode="numeric"
          maxLength={10}
          onChange={(event) => onChange(maskBrazilianDate(event.target.value))}
          placeholder="DD/MM/AAAA"
          required
          type="text"
          value={value}
        />
        <button
          aria-label={`Abrir calendário para ${label.toLocaleLowerCase('pt-BR')}`}
          onClick={openPicker}
          type="button"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24">
            <path d="M7 2v3M17 2v3M3.5 9h17M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
          </svg>
        </button>
        <input
          aria-hidden="true"
          className={styles.nativePicker}
          lang="pt-BR"
          min={min}
          onChange={(event) =>
            onChange(
              event.target.value
                ? formatBrazilianDate(event.target.value)
                : '',
            )
          }
          ref={pickerRef}
          tabIndex={-1}
          type="date"
          value={pickerValue}
        />
      </span>
    </label>
  )
}
