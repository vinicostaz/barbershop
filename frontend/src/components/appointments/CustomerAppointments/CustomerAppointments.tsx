import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Button } from '../../ui/Button/Button'
import { Container } from '../../ui/Container/Container'
import {
  appointmentsService,
  type Appointment,
} from '../../../services/appointments'
import { ApiError } from '../../../services/api'
import { catalogService } from '../../../services/catalog'
import styles from './CustomerAppointments.module.css'

type CustomerAppointmentsProps = {
  highlightedAppointmentId?: string
  notice?: string
  onCreateAppointment: () => void
  onScheduleStateResolved?: (hasUpcomingAppointments: boolean) => void
  reloadKey: number
  token: string
}

type AvailableDate = {
  id: string
  label: string
  weekday: string
}

type ViewMode = 'history' | 'upcoming'

const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeZone: 'UTC',
})

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'short',
})

const statusLabels: Record<Appointment['status'], string> = {
  CANCELADO: 'Cancelado',
  CONCLUIDO: 'Concluído',
  CONFIRMADO: 'Confirmado',
}

function createAvailableDate(id: string): AvailableDate {
  const [year, month, day] = id.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)

  return {
    id,
    label: shortDateFormatter.format(date).replace('.', ''),
    weekday: weekdayFormatter.format(date).replace('.', ''),
  }
}

function getAppointmentWallClockTimestamp(value: string) {
  const date = new Date(value)

  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ).getTime()
}

function isUpcomingAppointment(appointment: Appointment) {
  return (
    appointment.status === 'CONFIRMADO' &&
    getAppointmentWallClockTimestamp(appointment.horaInicio) >= Date.now()
  )
}

function RescheduleForm({
  appointment,
  onCancel,
  onSuccess,
  token,
}: {
  appointment: Appointment
  onCancel: () => void
  onSuccess: () => void
  token: string
}) {
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([])
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [selectedDateId, setSelectedDateId] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [datesError, setDatesError] = useState('')
  const [timesError, setTimesError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isDatesLoading, setIsDatesLoading] = useState(true)
  const [isTimesLoading, setIsTimesLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timesReloadKey, setTimesReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadDates() {
      if (!appointment.barbeiro) {
        setDatesError('O profissional deste agendamento não foi encontrado.')
        setIsDatesLoading(false)
        return
      }

      setDatesError('')
      setIsDatesLoading(true)

      try {
        const dates = await catalogService.listAvailableDates(
          appointment.barbeiro.id,
          appointment.servico.id,
          controller.signal,
        )
        setAvailableDates(dates.map(createAvailableDate))
      } catch (requestError) {
        if (controller.signal.aborted) return
        setDatesError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar novas datas.',
        )
      } finally {
        if (!controller.signal.aborted) setIsDatesLoading(false)
      }
    }

    void loadDates()
    return () => controller.abort()
  }, [appointment.barbeiro, appointment.servico.id])

  useEffect(() => {
    if (!appointment.barbeiro || !selectedDateId) return

    const controller = new AbortController()

    async function loadTimes() {
      if (!appointment.barbeiro) return

      setTimesError('')
      setIsTimesLoading(true)

      try {
        setAvailableTimes(
          await catalogService.listAvailableTimes(
            appointment.barbeiro.id,
            selectedDateId,
            appointment.servico.id,
            controller.signal,
          ),
        )
      } catch (requestError) {
        if (controller.signal.aborted) return
        setTimesError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar os horários livres.',
        )
      } finally {
        if (!controller.signal.aborted) setIsTimesLoading(false)
      }
    }

    void loadTimes()
    return () => controller.abort()
  }, [
    appointment.barbeiro,
    appointment.servico.id,
    selectedDateId,
    timesReloadKey,
  ])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedDateId || !selectedTime || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError('')

    try {
      await appointmentsService.reschedule(
        appointment.id,
        { data: selectedDateId, horaInicio: selectedTime },
        token,
      )
      onSuccess()
    } catch (requestError) {
      setSubmitError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível reagendar o atendimento.',
      )

      if (requestError instanceof ApiError && requestError.status === 409) {
        setSelectedTime('')
        setTimesReloadKey((key) => key + 1)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      className={styles.rescheduleForm}
      onSubmit={(event) => void handleSubmit(event)}
    >
      <header>
        <span>Reagendar atendimento</span>
        <h4>Escolha a nova data e o novo horário</h4>
        <p>O serviço e o profissional serão mantidos.</p>
      </header>

      {isDatesLoading && (
        <p className={styles.actionState} role="status">
          Consultando novas datas...
        </p>
      )}

      {!isDatesLoading && datesError && (
        <p className={styles.actionError} role="alert">
          {datesError}
        </p>
      )}

      {!isDatesLoading && !datesError && availableDates.length === 0 && (
        <p className={styles.actionState}>
          Não há novas datas disponíveis para este atendimento.
        </p>
      )}

      {!isDatesLoading && !datesError && availableDates.length > 0 && (
        <fieldset>
          <legend>Nova data</legend>
          <div className={styles.dateOptions}>
            {availableDates.map((date) => (
              <button
                aria-pressed={selectedDateId === date.id}
                className={selectedDateId === date.id ? styles.selectedOption : ''}
                key={date.id}
                onClick={() => {
                  setSelectedDateId(date.id)
                  setSelectedTime('')
                  setAvailableTimes([])
                  setTimesError('')
                  setSubmitError('')
                }}
                type="button"
              >
                <span>{date.weekday}</span>
                <strong>{date.label}</strong>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {selectedDateId && (
        <fieldset>
          <legend>Novo horário</legend>

          {isTimesLoading && (
            <p className={styles.actionState} role="status">
              Consultando horários...
            </p>
          )}

          {!isTimesLoading && timesError && (
            <p className={styles.actionError} role="alert">
              {timesError}
            </p>
          )}

          {!isTimesLoading && !timesError && availableTimes.length === 0 && (
            <p className={styles.actionState}>
              Nenhum horário está disponível nesta data.
            </p>
          )}

          {!isTimesLoading && !timesError && availableTimes.length > 0 && (
            <div className={styles.timeOptions}>
              {availableTimes.map((time) => (
                <button
                  aria-pressed={selectedTime === time}
                  className={selectedTime === time ? styles.selectedOption : ''}
                  key={time}
                  onClick={() => {
                    setSelectedTime(time)
                    setSubmitError('')
                  }}
                  type="button"
                >
                  {time}
                </button>
              ))}
            </div>
          )}
        </fieldset>
      )}

      {submitError && (
        <p className={styles.actionError} role="alert">
          {submitError}
        </p>
      )}

      <div className={styles.formActions}>
        <Button disabled={isSubmitting} onClick={onCancel} size="small" variant="ghost">
          Fechar
        </Button>
        <Button
          disabled={!selectedDateId || !selectedTime || isSubmitting}
          size="small"
          type="submit"
        >
          {isSubmitting ? 'Reagendando...' : 'Confirmar novo horário'}
        </Button>
      </div>
    </form>
  )
}

export function CustomerAppointments({
  highlightedAppointmentId,
  notice,
  onCreateAppointment,
  onScheduleStateResolved,
  reloadKey,
  token,
}: CustomerAppointmentsProps) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [viewMode, setViewMode] = useState<ViewMode>('upcoming')
  const [cancelConfirmationId, setCancelConfirmationId] = useState('')
  const [rescheduleId, setRescheduleId] = useState('')
  const [busyAppointmentId, setBusyAppointmentId] = useState('')
  const [feedback, setFeedback] = useState(notice ?? '')
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [internalReloadKey, setInternalReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadAppointments() {
      setLoadError('')
      setIsLoading(true)

      try {
        const loadedAppointments = await appointmentsService.list(
          token,
          controller.signal,
        )
        setAppointments(loadedAppointments)
        onScheduleStateResolved?.(
          loadedAppointments.some(isUpcomingAppointment),
        )
      } catch (requestError) {
        if (controller.signal.aborted) return
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar seus agendamentos.',
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAppointments()
    return () => controller.abort()
  }, [internalReloadKey, onScheduleStateResolved, reloadKey, token])

  const { history, upcoming } = useMemo(() => {
    const upcomingItems = appointments
      .filter(isUpcomingAppointment)
      .sort(
        (first, second) =>
          getAppointmentWallClockTimestamp(first.horaInicio) -
          getAppointmentWallClockTimestamp(second.horaInicio),
      )
    const historyItems = appointments
      .filter((appointment) => !isUpcomingAppointment(appointment))
      .sort(
        (first, second) =>
          getAppointmentWallClockTimestamp(second.horaInicio) -
          getAppointmentWallClockTimestamp(first.horaInicio),
      )

    return { history: historyItems, upcoming: upcomingItems }
  }, [appointments])

  const visibleAppointments = viewMode === 'upcoming' ? upcoming : history

  function refreshAppointments(message: string) {
    setCancelConfirmationId('')
    setRescheduleId('')
    setActionError('')
    setFeedback(message)
    setInternalReloadKey((key) => key + 1)
  }

  async function handleCancel(id: string) {
    if (busyAppointmentId) return

    setBusyAppointmentId(id)
    setActionError('')
    setFeedback('')

    try {
      await appointmentsService.cancel(id, token)
      refreshAppointments('Agendamento cancelado com sucesso.')
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível cancelar o agendamento.',
      )
    } finally {
      setBusyAppointmentId('')
    }
  }

  return (
    <section
      className={styles.management}
      id="meus-agendamentos"
      aria-labelledby="titulo-meus-agendamentos"
    >
      <Container>
        <h2 className={styles.srOnly} id="titulo-meus-agendamentos">
          Meus agendamentos
        </h2>

        {feedback && (
          <p className={styles.feedback} role="status">
            {feedback}
          </p>
        )}

        <div className={styles.tabs} aria-label="Visualização dos agendamentos">
          <button
            aria-pressed={viewMode === 'upcoming'}
            className={viewMode === 'upcoming' ? styles.activeTab : ''}
            onClick={() => {
              setViewMode('upcoming')
              setActionError('')
              setCancelConfirmationId('')
              setRescheduleId('')
            }}
            type="button"
          >
            Próximos <span>{upcoming.length}</span>
          </button>
          <button
            aria-pressed={viewMode === 'history'}
            className={viewMode === 'history' ? styles.activeTab : ''}
            onClick={() => {
              setViewMode('history')
              setActionError('')
              setCancelConfirmationId('')
              setRescheduleId('')
            }}
            type="button"
          >
            Histórico <span>{history.length}</span>
          </button>
        </div>

        {isLoading && (
          <div className={styles.dataState} role="status">
            Carregando seus agendamentos...
          </div>
        )}

        {!isLoading && loadError && (
          <div className={styles.dataState} role="alert">
            <p>{loadError}</p>
            <Button onClick={() => setInternalReloadKey((key) => key + 1)}>
              Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && !loadError && visibleAppointments.length === 0 && (
          <div className={styles.dataState} role="status">
            <p>
              {viewMode === 'upcoming'
                ? 'Você não possui agendamentos futuros.'
                : 'Seu histórico de agendamentos está vazio.'}
            </p>
            {viewMode === 'upcoming' && (
              <button
                className={styles.newBookingLink}
                onClick={onCreateAppointment}
                type="button"
              >
                Escolher um horário
              </button>
            )}
          </div>
        )}

        {!isLoading && !loadError && visibleAppointments.length > 0 && (
          <div className={styles.grid}>
            {visibleAppointments.map((appointment) => {
              const isCancelling = cancelConfirmationId === appointment.id
              const isRescheduling = rescheduleId === appointment.id
              const isBusy = busyAppointmentId === appointment.id

              return (
                <article
                  className={`${styles.card} ${
                    appointment.id === highlightedAppointmentId
                      ? styles.highlightedCard
                      : ''
                  }`}
                  key={appointment.id}
                >
                  <div className={styles.cardTopline}>
                    <span
                      className={`${styles.status} ${styles[appointment.status.toLowerCase()]}`}
                    >
                      {statusLabels[appointment.status]}
                    </span>
                    <strong>
                      {timeFormatter.format(new Date(appointment.horaInicio))}
                    </strong>
                  </div>

                  <h3>{appointment.servico.nome}</h3>
                  <p className={styles.appointmentDate}>
                    {fullDateFormatter.format(new Date(appointment.horaInicio))}
                  </p>

                  <dl>
                    <div>
                      <dt>Profissional</dt>
                      <dd>{appointment.barbeiro?.nome ?? 'Não informado'}</dd>
                    </div>
                    <div>
                      <dt>Duração</dt>
                      <dd>{appointment.servico.duracaoMin} minutos</dd>
                    </div>
                  </dl>

                  {viewMode === 'upcoming' && (
                    <div className={styles.cardActions}>
                      {!isCancelling && (
                        <>
                          <Button
                            disabled={Boolean(busyAppointmentId)}
                            onClick={() => {
                              setRescheduleId(
                                isRescheduling ? '' : appointment.id,
                              )
                              setCancelConfirmationId('')
                              setActionError('')
                              setFeedback('')
                            }}
                            size="small"
                            variant="ghost"
                          >
                            {isRescheduling ? 'Fechar reagendamento' : 'Reagendar'}
                          </Button>
                          <Button
                            className={styles.cancelButton}
                            disabled={Boolean(busyAppointmentId)}
                            onClick={() => {
                              setCancelConfirmationId(appointment.id)
                              setRescheduleId('')
                              setActionError('')
                              setFeedback('')
                            }}
                            size="small"
                            variant="ghost"
                          >
                            Cancelar
                          </Button>
                        </>
                      )}

                      {isCancelling && (
                        <div className={styles.cancelConfirmation}>
                          <p>Tem certeza de que deseja cancelar este horário?</p>
                          {actionError && (
                            <p className={styles.actionError} role="alert">
                              {actionError}
                            </p>
                          )}
                          <div>
                            <Button
                              disabled={isBusy}
                              onClick={() => {
                                setCancelConfirmationId('')
                                setActionError('')
                              }}
                              size="small"
                              variant="ghost"
                            >
                              Manter horário
                            </Button>
                            <Button
                              className={styles.confirmCancelButton}
                              disabled={isBusy}
                              onClick={() => void handleCancel(appointment.id)}
                              size="small"
                              variant="secondary"
                            >
                              {isBusy ? 'Cancelando...' : 'Confirmar cancelamento'}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {isRescheduling && (
                    <RescheduleForm
                      appointment={appointment}
                      onCancel={() => {
                        setRescheduleId('')
                        setActionError('')
                      }}
                      onSuccess={() =>
                        refreshAppointments('Agendamento reagendado com sucesso.')
                      }
                      token={token}
                    />
                  )}
                </article>
              )
            })}
          </div>
        )}
      </Container>
    </section>
  )
}
