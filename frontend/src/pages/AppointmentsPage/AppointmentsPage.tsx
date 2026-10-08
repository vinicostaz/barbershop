import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { AppointmentOption } from '../../components/appointments/AppointmentOption/AppointmentOption'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Container } from '../../components/ui/Container/Container'
import { ApiError } from '../../services/api'
import {
  appointmentsService,
  type Appointment,
} from '../../services/appointments'
import {
  catalogService,
  type Professional,
  type Service,
} from '../../services/catalog'
import styles from './AppointmentsPage.module.css'

const steps = ['Serviço', 'Profissional', 'Data', 'Horário', 'Revisão']

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})
const fullDateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
  timeZone: 'UTC',
})
const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
})

type AvailableDate = {
  id: string
  label: string
  weekday: string
}

function createAvailableDate(id: string): AvailableDate {
  const [year, month, day] = id.split('-').map(Number)
  const date = new Date(year, month - 1, day, 12)

  return {
    id,
    label: dateFormatter.format(date).replace('.', ''),
    weekday: weekdayFormatter.format(date).replace('.', ''),
  }
}

function AppointmentsAgenda({ token }: { token: string }) {
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadAppointments() {
      setError('')
      setIsLoading(true)

      try {
        setAppointments(
          await appointmentsService.list(token, controller.signal),
        )
      } catch (requestError) {
        if (controller.signal.aborted) return
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar os agendamentos.',
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadAppointments()
    return () => controller.abort()
  }, [reloadKey, token])

  return (
    <section className={styles.booking} aria-labelledby="titulo-agenda">
      <Container>
        <header className={styles.agendaHeader}>
          <span>Agenda integrada</span>
          <h2 id="titulo-agenda">Atendimentos cadastrados</h2>
          <p>Os dados abaixo são carregados diretamente da API.</p>
        </header>

        {isLoading && (
          <div className={styles.dataState} role="status">
            Carregando agendamentos...
          </div>
        )}

        {!isLoading && error && (
          <div className={styles.dataState} role="alert">
            <p>{error}</p>
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && !error && appointments.length === 0 && (
          <div className={styles.dataState} role="status">
            Nenhum agendamento foi encontrado.
          </div>
        )}

        {!isLoading && !error && appointments.length > 0 && (
          <div className={styles.agendaGrid}>
            {appointments.map((appointment) => (
              <article className={styles.appointmentCard} key={appointment.id}>
                <div className={styles.appointmentTopline}>
                  <span>{appointment.status}</span>
                  <strong>{timeFormatter.format(new Date(appointment.horaInicio))}</strong>
                </div>
                <h3>{appointment.servico.nome}</h3>
                <p>{fullDateFormatter.format(new Date(appointment.horaInicio))}</p>
                <dl>
                  {appointment.cliente && (
                    <div>
                      <dt>Cliente</dt>
                      <dd>{appointment.cliente.nome}</dd>
                    </div>
                  )}
                  {appointment.barbeiro && (
                    <div>
                      <dt>Profissional</dt>
                      <dd>{appointment.barbeiro.nome}</dd>
                    </div>
                  )}
                </dl>
              </article>
            ))}
          </div>
        )}
      </Container>
    </section>
  )
}

function CustomerBooking({ token }: { token: string }) {
  const [searchParams] = useSearchParams()
  const [services, setServices] = useState<Service[]>([])
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [availableDates, setAvailableDates] = useState<AvailableDate[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [selectedProfessionalId, setSelectedProfessionalId] = useState('')
  const [selectedDateId, setSelectedDateId] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [availableTimes, setAvailableTimes] = useState<string[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [availabilityError, setAvailabilityError] = useState('')
  const [timesError, setTimesError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [isCatalogLoading, setIsCatalogLoading] = useState(true)
  const [isAvailabilityLoading, setIsAvailabilityLoading] = useState(false)
  const [isTimesLoading, setIsTimesLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [timesReloadKey, setTimesReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadCatalog() {
      setCatalogError('')
      setIsCatalogLoading(true)

      try {
        const [servicesResult, professionalsResult] = await Promise.all([
          catalogService.listServices(controller.signal),
          catalogService.listProfessionals(controller.signal),
        ])
        setServices(servicesResult)
        setProfessionals(professionalsResult)

        const requestedService = searchParams.get('servico')
        const requestedProfessional = searchParams.get('profissional')

        if (servicesResult.some((service) => service.id === requestedService)) {
          setSelectedServiceId(requestedService ?? '')
        }
        if (
          professionalsResult.some(
            (professional) => professional.id === requestedProfessional,
          )
        ) {
          setSelectedProfessionalId(requestedProfessional ?? '')
        }
      } catch (requestError) {
        if (controller.signal.aborted) return
        setCatalogError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível carregar os dados do agendamento.',
        )
      } finally {
        if (!controller.signal.aborted) setIsCatalogLoading(false)
      }
    }

    void loadCatalog()
    return () => controller.abort()
  }, [reloadKey, searchParams])

  useEffect(() => {
    if (!selectedProfessionalId || !selectedServiceId) {
      return
    }

    const controller = new AbortController()

    async function loadAvailability() {
      setAvailabilityError('')
      setIsAvailabilityLoading(true)

      try {
        const dates = await catalogService.listAvailableDates(
          selectedProfessionalId,
          selectedServiceId,
          controller.signal,
        )
        setAvailableDates(dates.map(createAvailableDate))
      } catch (requestError) {
        if (controller.signal.aborted) return
        setAvailabilityError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível consultar a disponibilidade.',
        )
      } finally {
        if (!controller.signal.aborted) setIsAvailabilityLoading(false)
      }
    }

    void loadAvailability()
    return () => controller.abort()
  }, [selectedProfessionalId, selectedServiceId])

  useEffect(() => {
    if (!selectedProfessionalId || !selectedDateId || !selectedServiceId) {
      return
    }

    const controller = new AbortController()

    async function loadAvailableTimes() {
      setTimesError('')
      setIsTimesLoading(true)

      try {
        setAvailableTimes(
          await catalogService.listAvailableTimes(
            selectedProfessionalId,
            selectedDateId,
            selectedServiceId,
            controller.signal,
          ),
        )
      } catch (requestError) {
        if (controller.signal.aborted) return
        setTimesError(
          requestError instanceof Error
            ? requestError.message
            : 'Não foi possível consultar os horários livres.',
        )
      } finally {
        if (!controller.signal.aborted) setIsTimesLoading(false)
      }
    }

    void loadAvailableTimes()
    return () => controller.abort()
  }, [
    selectedDateId,
    selectedProfessionalId,
    selectedServiceId,
    timesReloadKey,
  ])

  const selectedService = services.find(
    (service) => service.id === selectedServiceId,
  )
  const selectedProfessional = professionals.find(
    (professional) => professional.id === selectedProfessionalId,
  )
  const selectedDate = availableDates.find((date) => date.id === selectedDateId)

  const canContinue = [
    Boolean(selectedService),
    Boolean(selectedProfessional),
    Boolean(selectedDate),
    Boolean(selectedTime),
    true,
  ][currentStep]

  function selectService(id: string) {
    setSelectedServiceId(id)
    setAvailableDates([])
    setSelectedDateId('')
    setSelectedTime('')
    setAvailableTimes([])
    setTimesError('')
    setSubmitError('')
  }

  function selectProfessional(id: string) {
    setSelectedProfessionalId(id)
    setAvailableDates([])
    setSelectedDateId('')
    setSelectedTime('')
    setAvailableTimes([])
    setTimesError('')
    setSubmitError('')
  }

  async function handleNext() {
    if (!canContinue || isSubmitting) return

    if (currentStep < steps.length - 1) {
      setCurrentStep((step) => step + 1)
      return
    }

    if (!selectedService || !selectedProfessional || !selectedDate || !selectedTime) {
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      await appointmentsService.create(
        {
          barbeiroId: selectedProfessional.id,
          data: selectedDate.id,
          horaInicio: selectedTime,
          servicoId: selectedService.id,
        },
        token,
      )
      setConfirmed(true)
    } catch (requestError) {
      setSubmitError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível confirmar o agendamento.',
      )

      if (requestError instanceof ApiError && requestError.status === 409) {
        setSelectedTime('')
        setCurrentStep(3)
        setTimesReloadKey((key) => key + 1)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleReset() {
    setCurrentStep(0)
    setSelectedServiceId('')
    setSelectedProfessionalId('')
    setAvailableDates([])
    setSelectedDateId('')
    setSelectedTime('')
    setAvailableTimes([])
    setTimesError('')
    setSubmitError('')
    setConfirmed(false)
  }

  if (isCatalogLoading) {
    return (
      <section className={styles.booking}>
        <Container>
          <div className={styles.dataState} role="status">
            Carregando opções de agendamento...
          </div>
        </Container>
      </section>
    )
  }

  if (catalogError) {
    return (
      <section className={styles.booking}>
        <Container>
          <div className={styles.dataState} role="alert">
            <p>{catalogError}</p>
            <Button onClick={() => setReloadKey((key) => key + 1)}>
              Tentar novamente
            </Button>
          </div>
        </Container>
      </section>
    )
  }

  return (
    <section className={styles.booking} aria-label="Fluxo de agendamento">
      <Container className={styles.bookingLayout}>
        <div className={styles.workflow}>
          {!confirmed ? (
            <>
              <nav className={styles.progress} aria-label="Etapas do agendamento">
                <ol>
                  {steps.map((step, index) => (
                    <li
                      className={index === currentStep ? styles.currentStep : ''}
                      key={step}
                    >
                      <button
                        aria-current={index === currentStep ? 'step' : undefined}
                        disabled={index > currentStep}
                        onClick={() => setCurrentStep(index)}
                        type="button"
                      >
                        <span>{String(index + 1).padStart(2, '0')}</span>
                        {step}
                      </button>
                    </li>
                  ))}
                </ol>
              </nav>

              <div className={styles.stepHeader}>
                <span>Etapa {currentStep + 1} de {steps.length}</span>
                <h2>{steps[currentStep]}</h2>
                <p>
                  {currentStep === 0 && 'Qual cuidado você deseja reservar?'}
                  {currentStep === 1 && 'Com quem você prefere realizar o atendimento?'}
                  {currentStep === 2 && 'Escolha o melhor dia para você.'}
                  {currentStep === 3 && 'Selecione um dos horários disponíveis.'}
                  {currentStep === 4 && 'Confira suas escolhas antes de confirmar.'}
                </p>
              </div>

              {submitError && (
                <p className={styles.inlineError} role="alert">
                  {submitError}
                </p>
              )}

              {currentStep === 0 && services.length === 0 && (
                <div className={styles.emptyStep}>Nenhum serviço está disponível.</div>
              )}

              {currentStep === 0 && services.length > 0 && (
                <div className={styles.optionsGrid}>
                  {services.map((service) => (
                    <AppointmentOption
                      description={service.descricao}
                      key={service.id}
                      label={service.nome}
                      meta={`${service.duracaoMin} min · ${currencyFormatter.format(service.preco)}`}
                      onSelect={() => selectService(service.id)}
                      selected={selectedServiceId === service.id}
                      visual={`${service.duracaoMin}m`}
                    />
                  ))}
                </div>
              )}

              {currentStep === 1 && professionals.length === 0 && (
                <div className={styles.emptyStep}>Nenhum profissional está disponível.</div>
              )}

              {currentStep === 1 && professionals.length > 0 && (
                <div className={styles.optionsGrid}>
                  {professionals.map((professional) => (
                    <AppointmentOption
                      description={
                        professional.specialties.join(' · ') ||
                        'Especialidades em atualização'
                      }
                      key={professional.id}
                      label={professional.name}
                      meta="Barbeiro especialista"
                      onSelect={() => selectProfessional(professional.id)}
                      selected={selectedProfessionalId === professional.id}
                      visual={professional.initials}
                    />
                  ))}
                </div>
              )}

              {currentStep === 2 && isAvailabilityLoading && (
                <div className={styles.emptyStep} role="status">
                  Consultando disponibilidade...
                </div>
              )}

              {currentStep === 2 && !isAvailabilityLoading && availabilityError && (
                <div className={styles.emptyStep} role="alert">
                  {availabilityError}
                </div>
              )}

              {currentStep === 2 &&
                !isAvailabilityLoading &&
                !availabilityError &&
                availableDates.length === 0 && (
                  <div className={styles.emptyStep}>
                    Não há dias com horários livres para este serviço nos
                    próximos 90 dias.
                  </div>
                )}

              {currentStep === 2 &&
                !isAvailabilityLoading &&
                !availabilityError &&
                availableDates.length > 0 && (
                <div className={styles.compactGrid}>
                  {availableDates.map((date) => (
                    <AppointmentOption
                      key={date.id}
                      label={date.label}
                      meta="Disponível"
                      onSelect={() => {
                        setSelectedDateId(date.id)
                        setSelectedTime('')
                        setAvailableTimes([])
                        setTimesError('')
                        setSubmitError('')
                      }}
                      selected={selectedDateId === date.id}
                      visual={date.weekday}
                    />
                  ))}
                </div>
              )}

              {currentStep === 3 && isTimesLoading && (
                <div className={styles.emptyStep} role="status">
                  Consultando horários livres...
                </div>
              )}

              {currentStep === 3 && !isTimesLoading && timesError && (
                <div className={styles.emptyStep} role="alert">
                  {timesError}
                </div>
              )}

              {currentStep === 3 &&
                !isTimesLoading &&
                !timesError &&
                availableTimes.length === 0 && (
                <div className={styles.emptyStep}>
                  Não há horários livres que comportem este serviço nessa data.
                </div>
              )}

              {currentStep === 3 &&
                !isTimesLoading &&
                !timesError &&
                availableTimes.length > 0 && (
                <div className={styles.timeGrid}>
                  {availableTimes.map((time) => (
                    <button
                      aria-pressed={selectedTime === time}
                      className={selectedTime === time ? styles.selectedTime : ''}
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

              {currentStep === 4 && (
                <dl className={styles.review}>
                  <div><dt>Serviço</dt><dd>{selectedService?.nome}</dd></div>
                  <div><dt>Profissional</dt><dd>{selectedProfessional?.name}</dd></div>
                  <div><dt>Data</dt><dd>{selectedDate ? `${selectedDate.weekday}, ${selectedDate.label}` : ''}</dd></div>
                  <div><dt>Horário</dt><dd>{selectedTime}</dd></div>
                  <div><dt>Duração</dt><dd>{selectedService?.duracaoMin} minutos</dd></div>
                  <div><dt>Valor</dt><dd>{selectedService ? currencyFormatter.format(selectedService.preco) : ''}</dd></div>
                </dl>
              )}

              <div className={styles.actions}>
                <Button
                  disabled={currentStep === 0 || isSubmitting}
                  onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
                  variant="ghost"
                >
                  Voltar
                </Button>
                <Button
                  disabled={!canContinue || isSubmitting}
                  onClick={() => void handleNext()}
                >
                  {isSubmitting
                    ? 'Confirmando...'
                    : currentStep === steps.length - 1
                      ? 'Confirmar agendamento'
                      : 'Continuar'}
                </Button>
              </div>
            </>
          ) : (
            <div className={styles.confirmation} role="status">
              <span className={styles.confirmationIcon} aria-hidden="true">✓</span>
              <Badge tone="brown">Tudo certo</Badge>
              <h2>Seu horário está reservado.</h2>
              <p>
                O agendamento foi confirmado pela API e já está salvo no sistema.
              </p>
              <Button onClick={handleReset} variant="ghost">
                Fazer novo agendamento
              </Button>
            </div>
          )}
        </div>

        <aside className={styles.summary} aria-labelledby="titulo-resumo">
          <span className={styles.summaryEyebrow}>Seu atendimento</span>
          <h2 id="titulo-resumo">Resumo</h2>
          <dl>
            <div><dt>Serviço</dt><dd>{selectedService?.nome ?? 'A escolher'}</dd></div>
            <div><dt>Profissional</dt><dd>{selectedProfessional?.name ?? 'A escolher'}</dd></div>
            <div><dt>Data</dt><dd>{selectedDate?.label ?? 'A escolher'}</dd></div>
            <div><dt>Horário</dt><dd>{selectedTime || 'A escolher'}</dd></div>
          </dl>
          <div className={styles.total}>
            <span>Valor do serviço</span>
            <strong>
              {selectedService ? currencyFormatter.format(selectedService.preco) : '—'}
            </strong>
          </div>
        </aside>
      </Container>
    </section>
  )
}

export function AppointmentsPage() {
  const { session } = useAuth()
  const isCustomer = session?.usuario.role === 'CLIENTE'

  return (
    <>
      <section className={styles.hero} aria-labelledby="titulo-agendamento">
        <Container className={styles.heroContent}>
          <div>
            <Badge>Agendamentos</Badge>
            <h1 id="titulo-agendamento">
              {isCustomer
                ? 'Reserve seu momento com tranquilidade.'
                : 'Acompanhe os atendimentos em um só lugar.'}
            </h1>
          </div>
          <p>
            {isCustomer
              ? 'Escolha o serviço, encontre seu profissional e organize o melhor horário em poucos passos.'
              : 'Consulte os agendamentos vinculados ao seu nível de acesso.'}
          </p>
        </Container>
      </section>

      {session &&
        (isCustomer ? (
          <CustomerBooking token={session.token} />
        ) : (
          <AppointmentsAgenda token={session.token} />
        ))}
    </>
  )
}
