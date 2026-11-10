import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import {
  adminService,
  type DashboardStatus,
  type DashboardSummary,
} from '../../services/admin'
import styles from './AdminDashboard.module.css'

type DashboardView = 'clientes' | 'geral' | 'profissionais' | 'servicos'

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  maximumFractionDigits: 0,
  style: 'currency',
})

const preciseCurrencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  minimumFractionDigits: 2,
  style: 'currency',
})

const monthFormatter = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
})

const shortDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})

const updateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
})

const statusLabels: Record<DashboardStatus, string> = {
  CANCELADO: 'Cancelados',
  CONCLUIDO: 'Concluídos',
  CONFIRMADO: 'Confirmados',
  REAGENDADO: 'Reagendados',
}

const statusOrder: DashboardStatus[] = [
  'CONFIRMADO',
  'CONCLUIDO',
  'REAGENDADO',
  'CANCELADO',
]

const viewOptions: Array<{ label: string; value: DashboardView }> = [
  { label: 'Visão geral', value: 'geral' },
  { label: 'Profissionais', value: 'profissionais' },
  { label: 'Clientes', value: 'clientes' },
  { label: 'Serviços', value: 'servicos' },
]

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function parseMonth(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(year, month - 1, 1, 12)
}

function monthOptions() {
  const current = new Date()

  return Array.from({ length: 18 }, (_, index) => {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1, 12)
    return {
      label: capitalize(monthFormatter.format(date)),
      value: toMonthKey(date),
    }
  })
}

function appointmentTime(value: string) {
  const date = new Date(value)
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(
    date.getUTCMinutes(),
  ).padStart(2, '0')}`
}

function appointmentDay(value: string) {
  const date = new Date(value)
  const localDate = new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    12,
  )
  return shortDateFormatter.format(localDate).replace('.', '')
}

function rating(value: number | null) {
  return value === null ? 'Sem avaliações' : `${value.toFixed(1)} / 5`
}

function DailyChart({ points }: { points: DashboardSummary['serieDiaria'] }) {
  const width = 760
  const height = 260
  const left = 42
  const right = 18
  const top = 24
  const bottom = 38
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom
  const maxAppointments = Math.max(...points.map((point) => point.agendamentos), 1)
  const maxRevenue = Math.max(...points.map((point) => point.faturamento), 1)
  const step = chartWidth / Math.max(points.length, 1)
  const barWidth = Math.max(Math.min(step * 0.48, 18), 4)
  const revenuePoints = points
    .map((point, index) => {
      const x = left + step * index + step / 2
      const y = top + chartHeight - (point.faturamento / maxRevenue) * chartHeight
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className={styles.chartWrapper}>
      <svg
        aria-label="Evolução diária de atendimentos e faturamento"
        className={styles.dailyChart}
        role="img"
        viewBox={`0 0 ${width} ${height}`}
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = top + chartHeight * ratio
          return (
            <line
              className={styles.gridLine}
              key={ratio}
              x1={left}
              x2={width - right}
              y1={y}
              y2={y}
            />
          )
        })}

        {points.map((point, index) => {
          const x = left + step * index + (step - barWidth) / 2
          const barHeight = (point.agendamentos / maxAppointments) * chartHeight
          const showLabel = index === 0 || index === points.length - 1 || (index + 1) % 5 === 0

          return (
            <g key={point.data}>
              <rect
                className={styles.chartBar}
                height={barHeight}
                rx="3"
                width={barWidth}
                x={x}
                y={top + chartHeight - barHeight}
              >
                <title>
                  {point.data.slice(8, 10)}: {point.agendamentos} atendimentos
                </title>
              </rect>
              {showLabel && (
                <text
                  className={styles.chartLabel}
                  textAnchor="middle"
                  x={left + step * index + step / 2}
                  y={height - 12}
                >
                  {point.data.slice(8, 10)}
                </text>
              )}
            </g>
          )
        })}

        <polyline className={styles.revenueLine} points={revenuePoints} />
        {points.map((point, index) => {
          if (point.faturamento === 0) return null
          const x = left + step * index + step / 2
          const y = top + chartHeight - (point.faturamento / maxRevenue) * chartHeight
          return (
            <circle className={styles.revenuePoint} cx={x} cy={y} key={point.data} r="3">
              <title>
                {point.data.slice(8, 10)}: {preciseCurrencyFormatter.format(point.faturamento)}
              </title>
            </circle>
          )
        })}
      </svg>
    </div>
  )
}

function RankingBar({ value, maximum }: { maximum: number; value: number }) {
  const width = maximum === 0 ? 0 : Math.max((value / maximum) * 100, 3)
  return (
    <span className={styles.rankingTrack} aria-hidden="true">
      <i style={{ width: `${width}%` }} />
    </span>
  )
}

export function AdminDashboard({ token }: { token: string }) {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [selectedMonthKey, setSelectedMonthKey] = useState(() => toMonthKey(new Date()))
  const [view, setView] = useState<DashboardView>('geral')
  const availableMonths = useMemo(() => monthOptions(), [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadDashboard() {
      setIsLoading(true)
      setLoadError('')

      try {
        const result = await adminService.dashboard(
          selectedMonthKey,
          token,
          controller.signal,
        )
        setDashboard(result)
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
  }, [reloadKey, selectedMonthKey, token])

  const currentMonth = capitalize(monthFormatter.format(parseMonth(selectedMonthKey)))
  const totalStatus = dashboard
    ? statusOrder.reduce((total, status) => total + dashboard.status[status], 0)
    : 0

  const metrics = dashboard
    ? [
        {
          detail: `${dashboard.resumo.concluidos} atendimentos concluídos`,
          label: 'Faturamento realizado',
          value: preciseCurrencyFormatter.format(dashboard.resumo.faturamento),
        },
        {
          detail: 'por atendimento concluído',
          label: 'Ticket médio',
          value: preciseCurrencyFormatter.format(dashboard.resumo.ticketMedio),
        },
        {
          detail: 'confirmados ou concluídos',
          label: 'Atendimentos no mês',
          value: dashboard.resumo.agendamentos,
        },
        {
          detail: `${dashboard.resumo.cancelamentos} cancelamentos no período`,
          label: 'Taxa de cancelamento',
          value: `${dashboard.resumo.taxaCancelamento}%`,
        },
        {
          detail: `${dashboard.clientes.novos} novos no período`,
          label: 'Clientes atendidos',
          value: dashboard.clientes.unicos,
        },
        {
          detail: `${dashboard.resumo.totalAvaliacoes} avaliações recebidas`,
          label: 'Avaliação média',
          value:
            dashboard.resumo.avaliacaoMedia === null
              ? '—'
              : dashboard.resumo.avaliacaoMedia.toFixed(1),
        },
      ]
    : []

  return (
    <section className={styles.dashboard} aria-labelledby="dashboard-title">
      <header className={styles.dashboardHeader}>
        <div>
          <span>Centro de gestão</span>
          <h2 id="dashboard-title">Saúde do negócio</h2>
          <p>Decisões mais rápidas a partir da agenda, dos clientes e da equipe.</p>
        </div>

        <div className={styles.updateArea}>
          <label className={styles.periodControl}>
            <span>Mês de referência</span>
            <select
              onChange={(event) => setSelectedMonthKey(event.target.value)}
              value={selectedMonthKey}
            >
              {availableMonths.map((month) => (
                <option key={month.value} value={month.value}>
                  {month.label}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={isLoading}
            onClick={() => setReloadKey((key) => key + 1)}
            type="button"
          >
            {isLoading ? 'Atualizando...' : 'Atualizar dados'}
          </button>
          {lastUpdatedAt && (
            <span className={styles.lastUpdated}>
              Atualizado às {updateTimeFormatter.format(lastUpdatedAt)}
            </span>
          )}
        </div>
      </header>

      <nav aria-label="Áreas do dashboard" className={styles.viewTabs}>
        {viewOptions.map((option) => (
          <button
            aria-current={view === option.value ? 'page' : undefined}
            className={view === option.value ? styles.activeTab : undefined}
            key={option.value}
            onClick={() => setView(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </nav>

      {isLoading && !dashboard && (
        <p className={styles.stateMessage} role="status">
          Consolidando os indicadores de {currentMonth}...
        </p>
      )}

      {!isLoading && loadError && !dashboard && (
        <div className={styles.errorMessage} role="alert">
          <strong>Não foi possível carregar o dashboard.</strong>
          <span>{loadError}</span>
          <button onClick={() => setReloadKey((key) => key + 1)} type="button">
            Tentar novamente
          </button>
        </div>
      )}

      {dashboard && (
        <>
          {loadError && (
            <p className={styles.refreshWarning} role="alert">
              Exibindo a última atualização disponível. {loadError}
            </p>
          )}

          <div className={styles.contextLine}>
            <strong>{currentMonth}</strong>
            <span>{dashboard.contexto.profissionaisAtivos} profissionais ativos</span>
            <span>{dashboard.contexto.servicosCadastrados} serviços no catálogo</span>
          </div>

          {view === 'geral' && (
            <>
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

              <div className={styles.overviewGrid}>
                <article className={`${styles.panel} ${styles.trendPanel}`}>
                  <header className={styles.panelHeader}>
                    <div>
                      <span>Movimento do mês</span>
                      <h3>Atendimentos e faturamento por dia</h3>
                    </div>
                    <div className={styles.chartLegend}>
                      <span><i /> Atendimentos</span>
                      <span><i /> Faturamento</span>
                    </div>
                  </header>
                  <DailyChart points={dashboard.serieDiaria} />
                </article>

                <aside className={`${styles.panel} ${styles.statusPanel}`}>
                  <header className={styles.panelHeader}>
                    <div>
                      <span>Fluxo da agenda</span>
                      <h3>Status do período</h3>
                    </div>
                  </header>

                  <div className={styles.statusBar} aria-label="Distribuição por status">
                    {statusOrder.map((status) => (
                      <i
                        className={styles[status.toLowerCase()]}
                        key={status}
                        style={{
                          width: `${totalStatus === 0 ? 0 : (dashboard.status[status] / totalStatus) * 100}%`,
                        }}
                        title={`${statusLabels[status]}: ${dashboard.status[status]}`}
                      />
                    ))}
                  </div>

                  <dl className={styles.statusList}>
                    {statusOrder.map((status) => (
                      <div key={status}>
                        <dt>
                          <i className={styles[status.toLowerCase()]} />
                          {statusLabels[status]}
                        </dt>
                        <dd>{dashboard.status[status]}</dd>
                      </div>
                    ))}
                  </dl>

                  <div className={styles.statusInsight}>
                    <span>Taxa de reagendamento</span>
                    <strong>{dashboard.resumo.taxaReagendamento}%</strong>
                    <small>{dashboard.resumo.reagendamentos} ocorrências no período</small>
                  </div>
                </aside>
              </div>

              <article className={`${styles.panel} ${styles.schedulePanel}`}>
                <header className={styles.panelHeader}>
                  <div>
                    <span>Operação</span>
                    <h3>Próximos atendimentos</h3>
                  </div>
                  <Link to="/profissional">Ver agenda completa</Link>
                </header>

                {dashboard.proximosAgendamentos.length > 0 ? (
                  <ol className={styles.appointmentList}>
                    {dashboard.proximosAgendamentos.map((appointment) => (
                      <li key={appointment.id}>
                        <div className={styles.dateBadge}>
                          <span>{appointmentDay(appointment.horaInicio)}</span>
                          <strong>{appointmentTime(appointment.horaInicio)}</strong>
                        </div>
                        <div className={styles.appointmentCopy}>
                          <strong>{appointment.servico.nome}</strong>
                          <span>{appointment.cliente.nome}</span>
                        </div>
                        <span className={styles.professionalName}>
                          {appointment.barbeiro.nome}
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
            </>
          )}

          {view === 'profissionais' && (
            <article className={styles.panel}>
              <header className={styles.panelHeader}>
                <div>
                  <span>Equipe</span>
                  <h3>Desempenho por profissional</h3>
                  <p>Ranking ordenado pelo faturamento concluído no período.</p>
                </div>
              </header>

              {dashboard.profissionais.length > 0 ? (
                <div className={styles.tableWrapper}>
                  <table className={styles.performanceTable}>
                    <thead>
                      <tr>
                        <th>Profissional</th>
                        <th>Atendimentos</th>
                        <th>Concluídos</th>
                        <th>Cancelamentos</th>
                        <th>Avaliação</th>
                        <th>Faturamento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboard.profissionais.map((professional, index) => (
                        <tr key={professional.id}>
                          <td>
                            <span className={styles.rankNumber}>{index + 1}</span>
                            <strong>{professional.nome}</strong>
                          </td>
                          <td>{professional.agendamentos}</td>
                          <td>{professional.concluidos}</td>
                          <td>{professional.cancelamentos}</td>
                          <td>
                            {rating(professional.avaliacaoMedia)}
                            {professional.totalAvaliacoes > 0 && (
                              <small>{professional.totalAvaliacoes} avaliações</small>
                            )}
                          </td>
                          <td><strong>{preciseCurrencyFormatter.format(professional.faturamento)}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className={styles.emptyState}>Sem movimentação da equipe neste mês.</p>
              )}
            </article>
          )}

          {view === 'clientes' && (
            <>
              <div className={styles.insightGrid}>
                <article className={styles.insightCard}>
                  <span>Clientes atendidos</span>
                  <strong>{dashboard.clientes.unicos}</strong>
                  <small>pessoas únicas no período</small>
                </article>
                <article className={styles.insightCard}>
                  <span>Novos cadastros</span>
                  <strong>{dashboard.clientes.novos}</strong>
                  <small>clientes que chegaram neste mês</small>
                </article>
                <article className={styles.insightCard}>
                  <span>Clientes recorrentes</span>
                  <strong>{dashboard.clientes.recorrentes}</strong>
                  <small>com dois ou mais atendimentos</small>
                </article>
                <article className={`${styles.insightCard} ${styles.highlightCard}`}>
                  <span>Taxa de recorrência</span>
                  <strong>{dashboard.clientes.taxaRecorrencia}%</strong>
                  <small>da base atendida voltou no período</small>
                </article>
              </div>

              <article className={styles.panel}>
                <header className={styles.panelHeader}>
                  <div>
                    <span>Comportamento</span>
                    <h3>Horários de maior procura</h3>
                    <p>Faixas com mais atendimentos confirmados ou concluídos.</p>
                  </div>
                </header>
                {dashboard.horariosPico.length > 0 ? (
                  <ol className={styles.rankingList}>
                    {dashboard.horariosPico.map((hour) => (
                      <li key={hour.hora}>
                        <strong>{hour.hora}</strong>
                        <RankingBar
                          maximum={dashboard.horariosPico[0]?.agendamentos ?? 0}
                          value={hour.agendamentos}
                        />
                        <span>{hour.agendamentos} atendimentos</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className={styles.emptyState}>Ainda não há horários para analisar.</p>
                )}
              </article>
            </>
          )}

          {view === 'servicos' && (
            <article className={styles.panel}>
              <header className={styles.panelHeader}>
                <div>
                  <span>Portfólio</span>
                  <h3>Serviços mais procurados</h3>
                  <p>Volume agendado e receita já realizada por serviço.</p>
                </div>
              </header>

              {dashboard.servicos.length > 0 ? (
                <ol className={styles.serviceRanking}>
                  {dashboard.servicos.map((service, index) => (
                    <li key={service.id}>
                      <span className={styles.rankNumber}>{index + 1}</span>
                      <div>
                        <strong>{service.nome}</strong>
                        <RankingBar
                          maximum={dashboard.servicos[0]?.agendamentos ?? 0}
                          value={service.agendamentos}
                        />
                      </div>
                      <span>{service.agendamentos} agendamentos</span>
                      <strong>{currencyFormatter.format(service.faturamento)}</strong>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className={styles.emptyState}>Nenhum serviço movimentado neste mês.</p>
              )}
            </article>
          )}
        </>
      )}
    </section>
  )
}
