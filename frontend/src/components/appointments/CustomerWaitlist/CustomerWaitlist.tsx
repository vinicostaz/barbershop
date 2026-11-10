import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { ApiError } from '../../../services/api'
import { catalogService, type Professional, type Service } from '../../../services/catalog'
import {
  waitlistService,
  type EligibleWaitlistTime,
  type Notification,
  type WaitlistEntry,
  type WaitlistStatus,
} from '../../../services/waitlist'
import { Button } from '../../ui/Button/Button'
import { BrazilianDateField } from '../../ui/BrazilianDateField/BrazilianDateField'
import {
  formatBrazilianDate,
  parseBrazilianDate,
} from '../../ui/BrazilianDateField/brazilianDate'
import { Container } from '../../ui/Container/Container'
import { SelectField } from '../../ui/FormField/FormField'
import styles from './CustomerWaitlist.module.css'

type CustomerWaitlistProps = {
  onAppointmentConfirmed: (appointmentId: string) => void
  onUnreadCountChange?: (count: number) => void
  token: string
}

const slotDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeZone: 'UTC',
})
const slotTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})
const notificationDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const statusLabels: Record<WaitlistStatus, string> = {
  AGUARDANDO: 'Aguardando',
  CONFIRMADO: 'Confirmado',
  DESISTIU: 'Desistência registrada',
  EXPIRADO: 'Prazo expirado',
  NOTIFICADO: 'Horário liberado',
}

function localDateId(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function formatSlotDate(value: string) {
  return slotDateFormatter.format(new Date(value))
}

function formatSlotTime(value: string) {
  return slotTimeFormatter.format(new Date(value))
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

function QueueCard({
  actionId,
  entry,
  onConfirm,
  onLeave,
}: {
  actionId: string
  entry: WaitlistEntry
  onConfirm: (entry: WaitlistEntry) => void
  onLeave: (entry: WaitlistEntry) => void
}) {
  const isActive = entry.status === 'AGUARDANDO' || entry.status === 'NOTIFICADO'

  return (
    <article
      className={`${styles.queueCard} ${entry.podeConfirmar ? styles.releasedCard : ''}`}
    >
      <div className={styles.queueCardHeader}>
        <span className={`${styles.status} ${styles[`status${entry.status}`]}`}>
          {statusLabels[entry.status]}
        </span>
        {entry.posicao !== null && (
          <strong>{entry.posicao}ª posição</strong>
        )}
      </div>

      <h3>{entry.servico.nome}</h3>
      <p className={styles.slotDate}>
        {formatSlotDate(entry.horaInicio)}, às {formatSlotTime(entry.horaInicio)}
      </p>

      <dl className={styles.queueDetails}>
        <div>
          <dt>Profissional</dt>
          <dd>{entry.barbeiro.nome}</dd>
        </div>
        {entry.pessoasNaFrente !== null && (
          <div>
            <dt>Na sua frente</dt>
            <dd>
              {entry.pessoasNaFrente === 0
                ? 'Ninguém'
                : `${entry.pessoasNaFrente} ${entry.pessoasNaFrente === 1 ? 'pessoa' : 'pessoas'}`}
            </dd>
          </div>
        )}
      </dl>

      {entry.podeConfirmar && entry.expiraEm && (
        <div className={styles.releaseNotice} role="status">
          <strong>Este horário é seu por tempo limitado.</strong>
          <span>
            Confirme até {notificationDateFormatter.format(new Date(entry.expiraEm))}.
          </span>
        </div>
      )}

      {isActive && (
        <div className={styles.cardActions}>
          {entry.podeConfirmar && (
            <Button
              disabled={actionId === entry.id}
              onClick={() => onConfirm(entry)}
              size="small"
            >
              {actionId === entry.id ? 'Confirmando...' : 'Confirmar horário'}
            </Button>
          )}
          <Button
            disabled={actionId === entry.id}
            onClick={() => onLeave(entry)}
            size="small"
            variant="ghost"
          >
            Sair da fila
          </Button>
        </div>
      )}
    </article>
  )
}

export function CustomerWaitlist({
  onAppointmentConfirmed,
  onUnreadCountChange,
  token,
}: CustomerWaitlistProps) {
  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('')
  const [selectedDate, setSelectedDate] = useState(
    formatBrazilianDate(localDateId()),
  )
  const [eligibleTimes, setEligibleTimes] = useState<EligibleWaitlistTime[]>([])
  const [selectedTime, setSelectedTime] = useState('')
  const [error, setError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [actionId, setActionId] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.lida).length,
    [notifications],
  )
  const activeEntries = useMemo(
    () =>
      entries.filter(
        (entry) => entry.status === 'AGUARDANDO' || entry.status === 'NOTIFICADO',
      ),
    [entries],
  )
  const previousEntries = useMemo(
    () =>
      entries.filter(
        (entry) => entry.status !== 'AGUARDANDO' && entry.status !== 'NOTIFICADO',
      ),
    [entries],
  )

  useEffect(() => {
    onUnreadCountChange?.(unreadCount)
  }, [onUnreadCountChange, unreadCount])

  useEffect(() => {
    const controller = new AbortController()

    async function loadWorkspace() {
      setError('')
      setIsLoading(true)

      try {
        const [queueResult, notificationResult, serviceResult, professionalResult] =
          await Promise.all([
            waitlistService.listEntries(token, controller.signal),
            waitlistService.listNotifications(token, controller.signal),
            catalogService.listServices(controller.signal),
            catalogService.listProfessionals(controller.signal),
          ])

        setEntries(queueResult)
        setNotifications(notificationResult)
        setServices(serviceResult)
        setProfessionals(professionalResult)
      } catch (requestError) {
        if (controller.signal.aborted) return
        setError(
          getErrorMessage(
            requestError,
            'Não foi possível carregar a fila de espera.',
          ),
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadWorkspace()
    return () => controller.abort()
  }, [reloadKey, token])

  function resetSearchResults() {
    setEligibleTimes([])
    setSelectedTime('')
    setHasSearched(false)
    setSearchError('')
    setSuccessMessage('')
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const selectedDateId = parseBrazilianDate(selectedDate)
    if (!selectedDateId) {
      setSearchError('Informe a data no formato brasileiro: DD/MM/AAAA.')
      return
    }

    setSearchError('')
    setSuccessMessage('')
    setIsSearching(true)
    setSelectedTime('')

    try {
      const times = await waitlistService.listEligibleTimes(
        selectedProfessionalId,
        selectedServiceId,
        selectedDateId,
        token,
      )
      setEligibleTimes(times)
      setHasSearched(true)
    } catch (requestError) {
      setEligibleTimes([])
      setHasSearched(true)
      setSearchError(
        getErrorMessage(
          requestError,
          'Não foi possível consultar os horários ocupados.',
        ),
      )
    } finally {
      setIsSearching(false)
    }
  }

  async function handleJoin() {
    const selectedDateId = parseBrazilianDate(selectedDate)
    if (!selectedTime || !selectedDateId) return

    setSearchError('')
    setSuccessMessage('')
    setIsJoining(true)

    try {
      await waitlistService.join(
        {
          barbeiroId: selectedProfessionalId,
          data: selectedDateId,
          horaInicio: selectedTime,
          servicoId: selectedServiceId,
        },
        token,
      )
      setSuccessMessage('Você entrou na fila. Acompanhe sua posição acima.')
      setEligibleTimes((times) =>
        times.filter((time) => time.horaInicio !== selectedTime),
      )
      setSelectedTime('')
      setReloadKey((key) => key + 1)
    } catch (requestError) {
      setSearchError(
        getErrorMessage(requestError, 'Não foi possível entrar na fila.'),
      )
    } finally {
      setIsJoining(false)
    }
  }

  async function handleConfirm(entry: WaitlistEntry) {
    setError('')
    setActionId(entry.id)

    try {
      const appointment = await waitlistService.confirm(entry.id, token)
      onAppointmentConfirmed(appointment.id)
    } catch (requestError) {
      setError(
        requestError instanceof ApiError && requestError.status === 410
          ? 'O prazo para confirmar terminou. A fila já foi atualizada.'
          : getErrorMessage(
              requestError,
              'Não foi possível confirmar o horário liberado.',
            ),
      )
      setReloadKey((key) => key + 1)
    } finally {
      setActionId('')
    }
  }

  async function handleLeave(entry: WaitlistEntry) {
    setError('')
    setActionId(entry.id)

    try {
      await waitlistService.leave(entry.id, token)
      setSuccessMessage('Sua saída da fila foi registrada.')
      setReloadKey((key) => key + 1)
    } catch (requestError) {
      setError(
        getErrorMessage(requestError, 'Não foi possível sair da fila.'),
      )
    } finally {
      setActionId('')
    }
  }

  async function handleRead(notification: Notification) {
    if (notification.lida) return

    try {
      await waitlistService.markNotificationRead(notification.id, token)
      setNotifications((current) =>
        current.map((item) =>
          item.id === notification.id ? { ...item, lida: true } : item,
        ),
      )
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'Não foi possível marcar a notificação como lida.',
        ),
      )
    }
  }

  if (isLoading) {
    return (
      <section className={styles.workspace}>
        <Container>
          <div className={styles.dataState} role="status">
            Carregando fila de espera e avisos...
          </div>
        </Container>
      </section>
    )
  }

  if (error && entries.length === 0 && notifications.length === 0) {
    return (
      <section className={styles.workspace}>
        <Container>
          <div className={styles.dataState} role="alert">
            <p>{error}</p>
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Tentar novamente
            </Button>
          </div>
        </Container>
      </section>
    )
  }

  return (
    <section className={styles.workspace} aria-labelledby="titulo-fila-espera">
      <Container>
        <header className={styles.header}>
          <div>
            <span>Fila de espera</span>
            <h2 id="titulo-fila-espera">Acompanhe oportunidades de horário</h2>
            <p>
              Entre na fila de um horário ocupado e confirme quando uma vaga for liberada.
            </p>
          </div>
          <Button
            onClick={() => setReloadKey((key) => key + 1)}
            variant="ghost"
          >
            Atualizar
          </Button>
        </header>

        {error && (
          <div className={styles.inlineError} role="alert">
            {error}
          </div>
        )}
        {successMessage && (
          <div className={styles.successMessage} role="status">
            {successMessage}
          </div>
        )}

        <div className={styles.overviewGrid}>
          <section className={styles.panel} aria-labelledby="titulo-minhas-filas">
            <div className={styles.panelHeader}>
              <div>
                <span>Seus horários</span>
                <h3 id="titulo-minhas-filas">Filas ativas</h3>
              </div>
              <strong>{activeEntries.length}</strong>
            </div>

            {activeEntries.length === 0 ? (
              <div className={styles.emptyState}>
                Você ainda não está aguardando nenhum horário.
              </div>
            ) : (
              <div className={styles.queueList}>
                {activeEntries.map((entry) => (
                  <QueueCard
                    actionId={actionId}
                    entry={entry}
                    key={entry.id}
                    onConfirm={(item) => void handleConfirm(item)}
                    onLeave={(item) => void handleLeave(item)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="titulo-avisos">
            <div className={styles.panelHeader}>
              <div>
                <span>Atualizações</span>
                <h3 id="titulo-avisos">Avisos</h3>
              </div>
              {unreadCount > 0 && (
                <strong aria-label={`${unreadCount} avisos não lidos`}>
                  {unreadCount}
                </strong>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className={styles.emptyState}>
                Nenhum aviso por enquanto. Quando um horário abrir, ele aparecerá aqui.
              </div>
            ) : (
              <div className={styles.notificationList}>
                {notifications.map((notification) => (
                  <article
                    className={`${styles.notification} ${notification.lida ? '' : styles.unreadNotification}`}
                    key={notification.id}
                  >
                    <div>
                      <span>{notification.lida ? 'Lido' : 'Novo aviso'}</span>
                      <time dateTime={notification.criadoEm}>
                        {notificationDateFormatter.format(
                          new Date(notification.criadoEm),
                        )}
                      </time>
                    </div>
                    <p>{notification.mensagem}</p>
                    {!notification.lida && (
                      <button
                        className={styles.readButton}
                        onClick={() => void handleRead(notification)}
                        type="button"
                      >
                        Marcar como lido
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className={styles.joinPanel} aria-labelledby="titulo-entrar-fila">
          <div className={styles.joinIntroduction}>
            <span>Novo acompanhamento</span>
            <h3 id="titulo-entrar-fila">Entrar em uma fila</h3>
            <p>
              Consulte uma data para ver horários ocupados que aceitam fila de espera.
            </p>
          </div>

          <form className={styles.searchForm} onSubmit={handleSearch}>
            <SelectField
              id="fila-servico"
              label="Serviço"
              onChange={(event) => {
                setSelectedServiceId(event.target.value)
                resetSearchResults()
              }}
              required
              value={selectedServiceId}
            >
              <option value="">Selecione</option>
              {services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.nome}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="fila-profissional"
              label="Profissional"
              onChange={(event) => {
                setSelectedProfessionalId(event.target.value)
                resetSearchResults()
              }}
              required
              value={selectedProfessionalId}
            >
              <option value="">Selecione</option>
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.name}
                </option>
              ))}
            </SelectField>
            <BrazilianDateField
              id="fila-data"
              label="Data"
              min={localDateId()}
              onChange={(value) => {
                setSelectedDate(value)
                resetSearchResults()
              }}
              value={selectedDate}
            />
            <Button
              className={styles.searchButton}
              disabled={
                isSearching ||
                !selectedServiceId ||
                !selectedProfessionalId ||
                !parseBrazilianDate(selectedDate)
              }
              type="submit"
            >
              {isSearching ? 'Consultando...' : 'Consultar horários'}
            </Button>
          </form>

          {searchError && (
            <div className={styles.inlineError} role="alert">
              {searchError}
            </div>
          )}

          {hasSearched && !searchError && eligibleTimes.length === 0 && (
            <div className={styles.searchEmpty} role="status">
              Não há horários ocupados elegíveis para fila nessa data.
            </div>
          )}

          {eligibleTimes.length > 0 && (
            <div className={styles.timesArea}>
              <div>
                <strong>Escolha o horário desejado</strong>
                <span>Você será avisado se ele ficar disponível.</span>
              </div>
              <div className={styles.timeGrid}>
                {eligibleTimes.map((time) => (
                  <button
                    aria-pressed={selectedTime === time.horaInicio}
                    className={selectedTime === time.horaInicio ? styles.selectedTime : ''}
                    key={time.horaInicio}
                    onClick={() => setSelectedTime(time.horaInicio)}
                    type="button"
                  >
                    <strong>{time.horaInicio}</strong>
                    <span>até {time.horaFim}</span>
                  </button>
                ))}
              </div>
              <Button
                disabled={!selectedTime || isJoining}
                onClick={() => void handleJoin()}
              >
                {isJoining ? 'Entrando na fila...' : 'Entrar na fila'}
              </Button>
            </div>
          )}
        </section>

        {previousEntries.length > 0 && (
          <details className={styles.history}>
            <summary>Ver histórico da fila ({previousEntries.length})</summary>
            <div className={styles.historyGrid}>
              {previousEntries.map((entry) => (
                <QueueCard
                  actionId={actionId}
                  entry={entry}
                  key={entry.id}
                  onConfirm={(item) => void handleConfirm(item)}
                  onLeave={(item) => void handleLeave(item)}
                />
              ))}
            </div>
          </details>
        )}
      </Container>
    </section>
  )
}
