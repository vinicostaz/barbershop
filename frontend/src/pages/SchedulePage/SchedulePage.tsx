import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Container } from '../../components/ui/Container/Container'
import {
  appointmentsService,
  type Appointment,
} from '../../services/appointments'
import styles from './SchedulePage.module.css'

type ViewMode = 'month' | 'week'

const shortDayFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  weekday: 'short',
})

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
})

const selectedDayFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  weekday: 'long',
  year: 'numeric',
})

const monthWeekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const statusLabels: Record<Appointment['status'], string> = {
  CANCELADO: 'Cancelado',
  CONCLUIDO: 'Concluído',
  CONFIRMADO: 'Confirmado',
  REAGENDADO: 'Reagendado',
}

function startOfToday() {
  const today = new Date()
  return new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12)
}

function addDays(date: Date, amount: number) {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + amount)
  return nextDate
}

function startOfWeek(date: Date) {
  const weekDay = date.getDay()
  const distanceFromMonday = weekDay === 0 ? -6 : 1 - weekDay
  return addDays(date, distanceFromMonday)
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1, 12)
}

function daysInMonth(date: Date) {
  const amount = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()

  return Array.from(
    { length: amount },
    (_, index) => new Date(date.getFullYear(), date.getMonth(), index + 1, 12),
  )
}

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function appointmentDateKey(appointment: Appointment) {
  return appointment.horaInicio.slice(0, 10)
}

function appointmentTime(value: string) {
  const date = new Date(value)
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function ScheduleCard({
  appointment,
  showProfessional,
}: {
  appointment: Appointment
  showProfessional: boolean
}) {
  return (
    <article className={styles.appointmentCard}>
      <div className={styles.cardTime}>
        <strong>{appointmentTime(appointment.horaInicio)}</strong>
        <span>até {appointmentTime(appointment.horaFim)}</span>
      </div>

      <div className={styles.cardContent}>
        <div className={styles.cardTopline}>
          <h4>{appointment.servico.nome}</h4>
          <span
            className={`${styles.status} ${styles[appointment.status.toLowerCase()]}`}
          >
            {statusLabels[appointment.status]}
          </span>
        </div>

        <dl>
          <div>
            <dt>Cliente</dt>
            <dd>{appointment.cliente?.nome ?? 'Cliente não informado'}</dd>
          </div>
          <div>
            <dt>Duração</dt>
            <dd>{appointment.servico.duracaoMin} minutos</dd>
          </div>
          {showProfessional && (
            <div>
              <dt>Profissional</dt>
              <dd>{appointment.barbeiro?.nome ?? 'Não informado'}</dd>
            </div>
          )}
        </dl>
      </div>
    </article>
  )
}

export function SchedulePage() {
  const location = useLocation()
  const { session } = useAuth()
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('month')
  const [selectedDate, setSelectedDate] = useState(startOfToday)
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('all')
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const isAdministrator = session?.usuario.role === 'ADMINISTRADOR'
  const token = session?.token

  useEffect(() => {
    if (!token) return

    const authToken = token
    const controller = new AbortController()

    async function loadAppointments() {
      setIsLoading(true)
      setLoadError('')

      try {
        setAppointments(
          await appointmentsService.list(authToken, controller.signal),
        )
      } catch (requestError) {
        if (controller.signal.aborted) return
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar a agenda.',
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAppointments()
    return () => controller.abort()
  }, [reloadKey, token])

  const professionals = useMemo(() => {
    const uniqueProfessionals = new Map<string, string>()

    appointments.forEach((appointment) => {
      if (appointment.barbeiro) {
        uniqueProfessionals.set(
          appointment.barbeiro.id,
          appointment.barbeiro.nome,
        )
      }
    })

    return [...uniqueProfessionals.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((first, second) => first.name.localeCompare(second.name, 'pt-BR'))
  }, [appointments])

  const weekStart = startOfWeek(selectedDate)
  const visibleDays = useMemo(
    () =>
      viewMode === 'month'
        ? daysInMonth(selectedDate)
        : Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)),
    [selectedDate, viewMode, weekStart],
  )

  const filteredAppointments = useMemo(() => {
    const visibleDateKeys = new Set(visibleDays.map(toDateKey))

    return appointments
      .filter((appointment) => visibleDateKeys.has(appointmentDateKey(appointment)))
      .filter(
        (appointment) =>
          selectedProfessionalId === 'all' ||
          appointment.barbeiro?.id === selectedProfessionalId,
      )
      .sort(
        (first, second) =>
          new Date(first.horaInicio).getTime() -
          new Date(second.horaInicio).getTime(),
      )
  }, [appointments, selectedProfessionalId, visibleDays])

  const statusSummary = useMemo(
    () => ({
      canceled: filteredAppointments.filter(
        (appointment) => appointment.status === 'CANCELADO',
      ).length,
      completed: filteredAppointments.filter(
        (appointment) => appointment.status === 'CONCLUIDO',
      ).length,
      confirmed: filteredAppointments.filter(
        (appointment) => appointment.status === 'CONFIRMADO',
      ).length,
      rescheduled: filteredAppointments.filter(
        (appointment) => appointment.status === 'REAGENDADO',
      ).length,
    }),
    [filteredAppointments],
  )

  const selectedDateKey = toDateKey(selectedDate)
  const selectedDayAppointments = filteredAppointments.filter(
    (appointment) => appointmentDateKey(appointment) === selectedDateKey,
  )

  const monthStartOffset =
    viewMode === 'month' ? (visibleDays[0].getDay() + 6) % 7 : 0

  const periodLabel =
    viewMode === 'month'
      ? capitalize(monthFormatter.format(selectedDate))
      : `${shortDayFormatter.format(visibleDays[0])} — ${shortDayFormatter.format(visibleDays[6])}`

  function navigatePeriod(direction: -1 | 1) {
    if (viewMode === 'month') {
      setSelectedDate((currentDate) => addMonths(currentDate, direction))
      return
    }

    setSelectedDate((currentDate) => addDays(currentDate, direction * 7))
  }

  function selectViewMode(nextMode: ViewMode) {
    setViewMode(nextMode)
  }

  function goToToday() {
    const today = startOfToday()
    setSelectedDate(today)
  }

  return (
    <section className={styles.page} aria-labelledby="schedule-title">
      <Container>
        {isAdministrator && location.state?.fromAdmin === true && (
          <Link className={styles.backToAdmin} to="/admin">
            <span aria-hidden="true">←</span> Voltar para administração
          </Link>
        )}

        <header className={styles.hero}>
          <div>
            <Badge tone="brown">
              {isAdministrator ? 'Agenda administrativa' : 'Área profissional'}
            </Badge>
            <h1 id="schedule-title">
              {isAdministrator ? 'Agenda da equipe' : 'Minha agenda'}
            </h1>
            <p>
              {isAdministrator
                ? 'Acompanhe os atendimentos de todos os profissionais em um só lugar.'
                : 'Consulte seus próximos atendimentos e organize sua rotina de trabalho.'}
            </p>
          </div>

          <div className={styles.periodSummary} aria-label="Resumo do período">
            <span>{capitalize(monthFormatter.format(selectedDate))}</span>
            <strong>{filteredAppointments.length}</strong>
            <p>
              {filteredAppointments.length === 1
                ? 'atendimento no período'
                : 'atendimentos no período'}
            </p>
          </div>
        </header>

        <div className={styles.toolbar}>
          <div className={styles.viewSwitch} aria-label="Formato da agenda">
            <button
              aria-pressed={viewMode === 'month'}
              className={viewMode === 'month' ? styles.activeView : ''}
              onClick={() => selectViewMode('month')}
              type="button"
            >
              Mês
            </button>
            <button
              aria-pressed={viewMode === 'week'}
              className={viewMode === 'week' ? styles.activeView : ''}
              onClick={() => selectViewMode('week')}
              type="button"
            >
              Semana
            </button>
          </div>

          <div className={styles.periodNavigation}>
            <button
              aria-label={viewMode === 'month' ? 'Mês anterior' : 'Semana anterior'}
              onClick={() => navigatePeriod(-1)}
              type="button"
            >
              ←
            </button>
            <button onClick={goToToday} type="button">
              Hoje
            </button>
            <button
              aria-label={viewMode === 'month' ? 'Próximo mês' : 'Próxima semana'}
              onClick={() => navigatePeriod(1)}
              type="button"
            >
              →
            </button>
          </div>

          {isAdministrator && (
            <label className={styles.professionalFilter}>
              <span>Profissional</span>
              <select
                onChange={(event) => setSelectedProfessionalId(event.target.value)}
                value={selectedProfessionalId}
              >
                <option value="all">Todos os profissionais</option>
                {professionals.map((professional) => (
                  <option key={professional.id} value={professional.id}>
                    {professional.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className={styles.periodHeading}>
          <div>
            <span>{viewMode === 'month' ? 'Visão mensal' : 'Visão semanal'}</span>
            <h2>{periodLabel}</h2>
          </div>

          <ul className={styles.statusSummary} aria-label="Atendimentos por status">
            <li>
              <strong>{statusSummary.confirmed}</strong>
              Confirmados
            </li>
            <li>
              <strong>{statusSummary.completed}</strong>
              Concluídos
            </li>
            <li>
              <strong>{statusSummary.canceled}</strong>
              Cancelados
            </li>
            <li>
              <strong>{statusSummary.rescheduled}</strong>
              Reagendados
            </li>
          </ul>
        </div>

        {isLoading && (
          <div className={styles.dataState} role="status">
            <span className={styles.loader} aria-hidden="true" />
            <p>Carregando agenda...</p>
          </div>
        )}

        {!isLoading && loadError && (
          <div className={styles.dataState} role="alert">
            <strong>Não foi possível carregar a agenda</strong>
            <p>{loadError}</p>
            <Button onClick={() => setReloadKey((key) => key + 1)} size="small">
              Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && !loadError && (
          <div
            className={`${styles.scheduleWorkspace} ${viewMode === 'week' ? styles.weekWorkspace : ''}`}
          >
            {viewMode === 'month' ? (
              <section className={styles.monthCalendar} aria-label={periodLabel}>
                <div className={styles.calendarWeekdays} aria-hidden="true">
                  {monthWeekdays.map((weekday) => (
                    <span key={weekday}>{weekday}</span>
                  ))}
                </div>

                <div className={styles.calendarGrid}>
                  {Array.from({ length: monthStartOffset }, (_, index) => (
                    <span
                      aria-hidden="true"
                      className={styles.calendarBlank}
                      key={`blank-${index}`}
                    />
                  ))}

                  {visibleDays.map((day) => {
                    const dayKey = toDateKey(day)
                    const dayAppointments = filteredAppointments.filter(
                      (appointment) => appointmentDateKey(appointment) === dayKey,
                    )
                    const isSelected = selectedDateKey === dayKey
                    const isToday = dayKey === toDateKey(startOfToday())
                    const appointmentLabel =
                      dayAppointments.length === 1
                        ? '1 atendimento'
                        : `${dayAppointments.length} atendimentos`

                    return (
                      <button
                        aria-label={`${day.getDate()} de ${monthFormatter.format(day)}, ${appointmentLabel}`}
                        aria-pressed={isSelected}
                        className={`${styles.calendarDay} ${dayAppointments.length > 0 ? styles.occupiedCalendarDay : ''} ${isToday ? styles.todayCalendarDay : ''}`}
                        key={dayKey}
                        onClick={() => setSelectedDate(day)}
                        type="button"
                      >
                        <span>{day.getDate()}</span>
                        {dayAppointments.length > 0 && (
                          <strong>{dayAppointments.length}</strong>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className={styles.calendarLegend}>
                  <i aria-hidden="true" /> Dia com atendimento
                </div>
              </section>
            ) : (
              <div className={styles.weekSelector} aria-label="Dias da semana">
                {visibleDays.map((day) => {
                  const dayKey = toDateKey(day)
                  const dayAppointments = filteredAppointments.filter(
                    (appointment) => appointmentDateKey(appointment) === dayKey,
                  )
                  const isSelected = selectedDateKey === dayKey
                  const isToday = dayKey === toDateKey(startOfToday())

                  return (
                    <button
                      aria-pressed={isSelected}
                      className={styles.weekDayButton}
                      key={dayKey}
                      onClick={() => setSelectedDate(day)}
                      type="button"
                    >
                      <span>{capitalize(weekdayFormatter.format(day)).slice(0, 3)}</span>
                      <strong>{String(day.getDate()).padStart(2, '0')}</strong>
                      <small>
                        {dayAppointments.length === 1
                          ? '1 atendimento'
                          : `${dayAppointments.length} atendimentos`}
                      </small>
                      {isToday && <em>Hoje</em>}
                    </button>
                  )
                })}
              </div>
            )}

            <section
              aria-labelledby="selected-day-title"
              className={styles.selectedDayPanel}
            >
              <header className={styles.selectedDayHeader}>
                <div>
                  <span>Agenda do dia</span>
                  <h3 id="selected-day-title">
                    {capitalize(selectedDayFormatter.format(selectedDate))}
                  </h3>
                </div>
                <strong>
                  {selectedDayAppointments.length}{' '}
                  {selectedDayAppointments.length === 1
                    ? 'atendimento'
                    : 'atendimentos'}
                </strong>
              </header>

              <div className={styles.selectedDayAppointments}>
                {selectedDayAppointments.length > 0 ? (
                  selectedDayAppointments.map((appointment) => (
                    <ScheduleCard
                      appointment={appointment}
                      key={appointment.id}
                      showProfessional={isAdministrator}
                    />
                  ))
                ) : (
                  <div className={styles.emptyDay}>
                    <span aria-hidden="true">—</span>
                    <p>Nenhum atendimento marcado para este dia.</p>
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </Container>
    </section>
  )
}
