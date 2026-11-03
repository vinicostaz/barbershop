import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  adminService,
  type AdminProfessional,
  type AdminService,
} from '../../services/admin'
import {
  appointmentsService,
  type Appointment,
} from '../../services/appointments'
import styles from './AdminDashboard.module.css'

type DashboardData = {
  appointments: Appointment[]
  professionals: AdminProfessional[]
  services: AdminService[]
}

const emptyDashboard: DashboardData = {
  appointments: [],
  professionals: [],
  services: [],
}

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

function currentMonthKey() {
  return toMonthKey(new Date())
}

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})

const updateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  maximumFractionDigits: 0,
  style: 'currency',
})

const statusLabels: Record<Appointment['status'], string> = {
  CANCELADO: 'Cancelados',
  CONCLUIDO: 'Concluídos',
  CONFIRMADO: 'Confirmados',
  REAGENDADO: 'Reagendados',
}

const statusOrder: Appointment['status'][] = [
  'CONFIRMADO',
  'CONCLUIDO',
  'REAGENDADO',
  'CANCELADO',
]

function toDateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMonthKey(date: Date) {
  return toDateKey(date).slice(0, 7)
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number)
  return new Date(year, month - 1, day, 12)
}

function wallClockTimestamp(value: string) {
  const date = new Date(value)

  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours(),
    date.getUTCMinutes(),
  ).getTime()
}

function appointmentTime(value: string) {
  const date = new Date(value)
  const hour = String(date.getUTCHours()).padStart(2, '0')
  const minute = String(date.getUTCMinutes()).padStart(2, '0')
  return `${hour}:${minute}`
}

function appointmentDay(value: string, todayKey: string) {
  const dateKey = value.slice(0, 10)
  if (dateKey === todayKey) return 'Hoje'

  return shortDateFormatter.format(parseDateKey(dateKey)).replace('.', '')
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function AdminDashboard({ token }: { token: string }) {
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey)

  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      setIsLoading(true)
      setLoadError('')

      try {
        const [appointments, professionals, services] = await Promise.all([
          appointmentsService.list(token, controller.signal),
          adminService.listProfessionals(token, controller.signal),
          adminService.listServices(controller.signal),
        ])

        setDashboard({ appointments, professionals, services })
        setLastUpdatedAt(new Date())
      } catch (requestError) {
        if (controller.signal.aborted) return
        setLoadError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar o resumo administrativo.',
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadDashboard()
    return () => controller.abort()
  }, [reloadKey, token])

  const summary = useMemo(() => {
    const now = new Date()
    const nowTimestamp = now.getTime()
    const todayKey = toDateKey(now)
    const currentMonthAppointments = dashboard.appointments.filter(
      (appointment) => appointment.horaInicio.slice(0, 7) === selectedMonthKey,
    )
    const upcomingAppointments = dashboard.appointments
      .filter(
        (appointment) =>
          appointment.status === 'CONFIRMADO' &&
          wallClockTimestamp(appointment.horaInicio) >= nowTimestamp,
      )
      .sort(
        (first, second) =>
          wallClockTimestamp(first.horaInicio) -
          wallClockTimestamp(second.horaInicio),
      )

    const statusCounts = currentMonthAppointments.reduce(
      (counts, appointment) => ({
        ...counts,
        [appointment.status]: counts[appointment.status] + 1,
      }),
      {
        CANCELADO: 0,
        CONCLUIDO: 0,
        CONFIRMADO: 0,
        REAGENDADO: 0,
      } satisfies Record<Appointment['status'], number>,
    )

    const validMonthAppointments = currentMonthAppointments.filter(
      (appointment) =>
        appointment.status === 'CONFIRMADO' ||
        appointment.status === 'CONCLUIDO',
    )
    const serviceCounts = validMonthAppointments.reduce(
      (counts, appointment) => {
        const current = counts.get(appointment.servico.nome) ?? 0
        counts.set(appointment.servico.nome, current + 1)
        return counts
      }, new Map<string, number>())
    const mostRequestedService = [...serviceCounts.entries()].sort(
      (first, second) => second[1] - first[1],
    )[0]

    return {
      activeProfessionals: dashboard.professionals.filter(
        (professional) => professional.ativo,
      ).length,
      currentMonth: capitalize(
        monthFormatter.format(parseDateKey(`${selectedMonthKey}-01`)),
      ),
      appointmentsThisMonth: currentMonthAppointments.filter(
        (appointment) =>
          appointment.status === 'CONFIRMADO' ||
          appointment.status === 'CONCLUIDO',
      ).length,
      completedThisMonth: statusCounts.CONCLUIDO,
      completedRevenue: currentMonthAppointments
        .filter((appointment) => appointment.status === 'CONCLUIDO')
        .reduce((total, appointment) => total + appointment.servico.preco, 0),
      mostRequestedService: mostRequestedService
        ? {
            amount: mostRequestedService[1],
            name: mostRequestedService[0],
          }
        : null,
      nextAppointments: upcomingAppointments.slice(0, 4),
      statusCounts,
      todayAppointments: dashboard.appointments.filter(
        (appointment) =>
          appointment.horaInicio.slice(0, 10) === todayKey &&
          ['CONFIRMADO', 'CONCLUIDO'].includes(appointment.status),
      ).length,
      todayKey,
      upcomingAppointments: upcomingAppointments.length,
    }
  }, [dashboard, selectedMonthKey])

  const monthOptions = useMemo(() => {
    const availableMonths = new Set(
      dashboard.appointments.map((appointment) =>
        appointment.horaInicio.slice(0, 7),
      ),
    )
    availableMonths.add(currentMonthKey())

    return [...availableMonths]
      .sort((first, second) => second.localeCompare(first))
      .map((monthKey) => ({
        label: capitalize(
          monthFormatter.format(parseDateKey(`${monthKey}-01`)),
        ),
        value: monthKey,
      }))
  }, [dashboard.appointments])

  const metrics = [
    {
      detail: 'confirmados ou concluídos',
      label: 'Atendimentos hoje',
      value: summary.todayAppointments,
    },
    {
      detail: 'na agenda futura',
      label: 'Próximos confirmados',
      value: summary.upcomingAppointments,
    },
    {
      detail: `confirmados ou concluídos em ${summary.currentMonth}`,
      label: 'Atendimentos no mês',
      value: summary.appointmentsThisMonth,
    },
    {
      detail: 'em atendimentos concluídos',
      label: 'Faturamento realizado',
      value: currencyFormatter.format(summary.completedRevenue),
    },
    {
      detail: `de ${dashboard.professionals.length} cadastrados`,
      label: 'Profissionais ativos',
      value: summary.activeProfessionals,
    },
    {
      detail: 'disponíveis no catálogo',
      label: 'Serviços cadastrados',
      value: dashboard.services.length,
    },
  ]

  return (
    <section className={styles.dashboard} aria-labelledby="dashboard-title">
      <header className={styles.dashboardHeader}>
        <div>
          <span>Visão geral</span>
          <h2 id="dashboard-title">Resumo da operação</h2>
          <p>
            Acompanhe os números principais e os próximos compromissos da equipe.
          </p>
        </div>

        <div className={styles.updateArea}>
          <label className={styles.periodControl}>
            <span>Mês de referência</span>
            <select
              onChange={(event) => setSelectedMonthKey(event.target.value)}
              value={selectedMonthKey}
            >
              {monthOptions.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
          {lastUpdatedAt && (
            <span className={styles.lastUpdated}>
              Atualizado às {updateTimeFormatter.format(lastUpdatedAt)}
            </span>
          )}
          <button
            disabled={isLoading}
            onClick={() => setReloadKey((key) => key + 1)}
            type="button"
          >
            {isLoading ? 'Atualizando...' : 'Atualizar dados'}
          </button>
        </div>
      </header>

      {isLoading && !lastUpdatedAt && (
        <p className={styles.stateMessage} role="status">
          Carregando indicadores administrativos...
        </p>
      )}

      {!isLoading && loadError && (
        <div className={styles.errorMessage} role="alert">
          <strong>Não foi possível carregar o dashboard.</strong>
          <span>{loadError}</span>
          <button onClick={() => setReloadKey((key) => key + 1)} type="button">
            Tentar novamente
          </button>
        </div>
      )}

      {lastUpdatedAt && (
        <>
          {loadError && (
            <p className={styles.refreshWarning} role="alert">
              Os dados abaixo são da última atualização. {loadError}
            </p>
          )}

          <div className={styles.metricGrid} aria-label="Indicadores principais">
            {metrics.map((metric, index) => (
              <article className={styles.metricCard} key={metric.label}>
                <span className={styles.metricIndex} aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <p>{metric.label}</p>
                <strong>{metric.value}</strong>
                <small>{metric.detail}</small>
              </article>
            ))}
          </div>

          <div className={styles.detailGrid}>
            <article className={styles.panel}>
              <header className={styles.panelHeader}>
                <div>
                  <span>Agenda</span>
                  <h3>Próximos atendimentos</h3>
                </div>
                <Link to="/profissional">Ver agenda completa</Link>
              </header>

              {summary.nextAppointments.length > 0 ? (
                <ol className={styles.appointmentList}>
                  {summary.nextAppointments.map((appointment) => (
                    <li key={appointment.id}>
                      <div className={styles.dateBadge}>
                        <span>
                          {appointmentDay(
                            appointment.horaInicio,
                            summary.todayKey,
                          )}
                        </span>
                        <strong>{appointmentTime(appointment.horaInicio)}</strong>
                      </div>
                      <div className={styles.appointmentCopy}>
                        <strong>{appointment.servico.nome}</strong>
                        <span>
                          {appointment.cliente?.nome ?? 'Cliente não informado'}
                        </span>
                      </div>
                      <span className={styles.professionalName}>
                        {appointment.barbeiro?.nome ?? 'Profissional não informado'}
                      </span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.emptyState}>
                  Nenhum atendimento futuro confirmado no momento.
                </p>
              )}
            </article>

            <aside className={`${styles.panel} ${styles.monthPanel}`}>
              <header className={styles.panelHeader}>
                <div>
                  <span>Balanço mensal</span>
                  <h3>{summary.currentMonth}</h3>
                </div>
              </header>

              <dl className={styles.statusList}>
                {statusOrder.map((status) => (
                  <div key={status}>
                    <dt>
                      <i className={styles[status.toLowerCase()]} />
                      {statusLabels[status]}
                    </dt>
                    <dd>{summary.statusCounts[status]}</dd>
                  </div>
                ))}
              </dl>

              <div className={styles.monthInsight}>
                <span>Serviço mais solicitado no mês</span>
                <strong>
                  {summary.mostRequestedService?.name ?? 'Sem dados suficientes'}
                </strong>
                {summary.mostRequestedService && (
                  <small>
                    {summary.mostRequestedService.amount}{' '}
                    {summary.mostRequestedService.amount === 1
                      ? 'agendamento'
                      : 'agendamentos'}
                  </small>
                )}
              </div>

              <Link
                className={styles.availabilityLink}
                state={{ fromAdmin: true, section: 'availability' }}
                to="/profissional"
              >
                Gerenciar disponibilidade <span aria-hidden="true">→</span>
              </Link>
            </aside>
          </div>
        </>
      )}
    </section>
  )
}
