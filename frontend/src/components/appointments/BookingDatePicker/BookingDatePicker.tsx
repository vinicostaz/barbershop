import { useMemo, useState } from 'react'
import styles from './BookingDatePicker.module.css'

type CalendarView = 'month' | 'week'

type Props = {
  availableDateIds: string[]
  onSelect: (dateId: string) => void
  selectedDateId: string
}

const weekdayLabels = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

const shortMonthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'short',
})

const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'full',
})

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date: Date, amount: number) {
  const next = new Date(date)
  next.setDate(next.getDate() + amount)
  return next
}

function startOfWeek(date: Date) {
  return addDays(date, -date.getDay())
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 12)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12)
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function firstAvailableInRange(
  availableDateIds: string[],
  start: Date,
  numberOfDays: number,
) {
  const available = new Set(availableDateIds)

  for (let index = 0; index < numberOfDays; index += 1) {
    const dateId = toDateKey(addDays(start, index))
    if (available.has(dateId)) return dateId
  }

  return ''
}

export function BookingDatePicker({
  availableDateIds,
  onSelect,
  selectedDateId,
}: Props) {
  const initialDate = parseDateKey(selectedDateId || availableDateIds[0])
  const [view, setView] = useState<CalendarView>('week')
  const [weekStart, setWeekStart] = useState(() => startOfWeek(initialDate))
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(initialDate),
  )

  const availableDates = useMemo(
    () => new Set(availableDateIds),
    [availableDateIds],
  )

  const lastAvailableDate = parseDateKey(
    availableDateIds[availableDateIds.length - 1],
  )
  const earliestWeek = startOfWeek(new Date())
  const latestWeek = startOfWeek(lastAvailableDate)
  const earliestMonth = startOfMonth(new Date())
  const latestMonth = startOfMonth(lastAvailableDate)

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [weekStart],
  )

  const daysInVisibleMonth = new Date(
    visibleMonth.getFullYear(),
    visibleMonth.getMonth() + 1,
    0,
  ).getDate()

  const monthDays = useMemo(
    () =>
      Array.from({ length: daysInVisibleMonth }, (_, index) =>
        new Date(
          visibleMonth.getFullYear(),
          visibleMonth.getMonth(),
          index + 1,
          12,
        ),
      ),
    [daysInVisibleMonth, visibleMonth],
  )

  function selectDate(dateId: string) {
    if (!availableDates.has(dateId)) return
    onSelect(dateId)
  }

  function changeWeek(direction: -1 | 1) {
    const nextWeek = addDays(weekStart, direction * 7)
    setWeekStart(nextWeek)
    onSelect(firstAvailableInRange(availableDateIds, nextWeek, 7))
  }

  function changeMonth(direction: -1 | 1) {
    const nextMonth = addMonths(visibleMonth, direction)
    setVisibleMonth(nextMonth)
    onSelect(
      firstAvailableInRange(
        availableDateIds,
        nextMonth,
        new Date(nextMonth.getFullYear(), nextMonth.getMonth() + 1, 0).getDate(),
      ),
    )
  }

  function switchView(nextView: CalendarView) {
    setView(nextView)
    const anchor = parseDateKey(selectedDateId || availableDateIds[0])
    setWeekStart(startOfWeek(anchor))
    setVisibleMonth(startOfMonth(anchor))
  }

  const canGoToPreviousWeek = weekStart.getTime() > earliestWeek.getTime()
  const canGoToNextWeek = weekStart.getTime() < latestWeek.getTime()
  const canGoToPreviousMonth =
    visibleMonth.getTime() > earliestMonth.getTime()
  const canGoToNextMonth = visibleMonth.getTime() < latestMonth.getTime()

  return (
    <div className={styles.picker}>
      <div className={styles.toolbar}>
        <div className={styles.viewSwitch} aria-label="Visualização das datas">
          <button
            aria-pressed={view === 'week'}
            className={view === 'week' ? styles.activeView : ''}
            onClick={() => switchView('week')}
            type="button"
          >
            Semana
          </button>
          <button
            aria-pressed={view === 'month'}
            className={view === 'month' ? styles.activeView : ''}
            onClick={() => switchView('month')}
            type="button"
          >
            Mês
          </button>
        </div>

        <p>
          {selectedDateId
            ? capitalize(fullDateFormatter.format(parseDateKey(selectedDateId)))
            : 'Selecione uma data disponível'}
        </p>
      </div>

      {view === 'week' ? (
        <div className={styles.calendarPanel}>
          <div className={styles.periodNavigation}>
            <button
              aria-label="Semana anterior"
              disabled={!canGoToPreviousWeek}
              onClick={() => changeWeek(-1)}
              type="button"
            >
              ←
            </button>
            <strong>
              {weekDays[0].getDate()} de{' '}
              {shortMonthFormatter.format(weekDays[0]).replace('.', '')} —{' '}
              {weekDays[6].getDate()} de{' '}
              {shortMonthFormatter.format(weekDays[6]).replace('.', '')}
            </strong>
            <button
              aria-label="Próxima semana"
              disabled={!canGoToNextWeek}
              onClick={() => changeWeek(1)}
              type="button"
            >
              →
            </button>
          </div>

          <div className={styles.weekGrid}>
            {weekDays.map((date, index) => {
              const dateId = toDateKey(date)
              const isAvailable = availableDates.has(dateId)
              const isSelected = selectedDateId === dateId

              return (
                <button
                  aria-label={`${weekdayLabels[index]}, ${date.toLocaleDateString('pt-BR')}${isAvailable ? ', disponível' : ', indisponível'}`}
                  aria-pressed={isSelected}
                  className={isSelected ? styles.selectedDay : ''}
                  disabled={!isAvailable}
                  key={dateId}
                  onClick={() => selectDate(dateId)}
                  type="button"
                >
                  <span>{weekdayLabels[index]}</span>
                  <strong>{String(date.getDate()).padStart(2, '0')}</strong>
                  <small>{isAvailable ? 'Disponível' : 'Indisponível'}</small>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        <div className={styles.calendarPanel}>
          <div className={styles.periodNavigation}>
            <button
              aria-label="Mês anterior"
              disabled={!canGoToPreviousMonth}
              onClick={() => changeMonth(-1)}
              type="button"
            >
              ←
            </button>
            <strong>{capitalize(monthFormatter.format(visibleMonth))}</strong>
            <button
              aria-label="Próximo mês"
              disabled={!canGoToNextMonth}
              onClick={() => changeMonth(1)}
              type="button"
            >
              →
            </button>
          </div>

          <div className={styles.monthGrid}>
            {weekdayLabels.map((weekday) => (
              <span className={styles.weekdayLabel} key={weekday}>
                {weekday}
              </span>
            ))}
            {Array.from({ length: visibleMonth.getDay() }, (_, index) => (
              <span aria-hidden="true" key={`empty-${index}`} />
            ))}
            {monthDays.map((date) => {
              const dateId = toDateKey(date)
              const isAvailable = availableDates.has(dateId)
              const isSelected = selectedDateId === dateId

              return (
                <button
                  aria-label={`${date.toLocaleDateString('pt-BR')}${isAvailable ? ', disponível' : ', indisponível'}`}
                  aria-pressed={isSelected}
                  className={isSelected ? styles.selectedDay : ''}
                  disabled={!isAvailable}
                  key={dateId}
                  onClick={() => selectDate(dateId)}
                  type="button"
                >
                  {date.getDate()}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <p className={styles.hint}>
        Dias em cinza não possuem horários livres para este serviço.
      </p>
    </div>
  )
}
