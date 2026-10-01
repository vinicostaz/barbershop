import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { AppointmentOption } from '../../components/appointments/AppointmentOption/AppointmentOption'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Container } from '../../components/ui/Container/Container'
import { professionals } from '../../data/professionals'
import { services } from '../../data/services'
import styles from './AppointmentsPage.module.css'

const steps = ['Serviço', 'Profissional', 'Data', 'Horário', 'Revisão']
const availableTimes = ['09:00', '10:30', '13:30', '15:00', '16:30', '18:00']

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  currency: 'BRL',
  style: 'currency',
})

const weekdayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
})

type AvailableDate = {
  id: string
  label: string
  weekday: string
}

function createAvailableDates(): AvailableDate[] {
  const dates: AvailableDate[] = []
  const cursor = new Date()

  while (dates.length < 5) {
    cursor.setDate(cursor.getDate() + 1)

    if (cursor.getDay() === 0) continue

    const year = cursor.getFullYear()
    const month = String(cursor.getMonth() + 1).padStart(2, '0')
    const day = String(cursor.getDate()).padStart(2, '0')

    dates.push({
      id: `${year}-${month}-${day}`,
      label: dateFormatter.format(cursor).replace('.', ''),
      weekday: weekdayFormatter.format(cursor).replace('.', ''),
    })
  }

  return dates
}

function isValidOption(value: string | null, options: { id: string }[]) {
  return value && options.some((option) => option.id === value) ? value : ''
}

export function AppointmentsPage() {
  const [searchParams] = useSearchParams()
  const availableDates = useMemo(() => createAvailableDates(), [])
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedServiceId, setSelectedServiceId] = useState(() =>
    isValidOption(searchParams.get('servico'), services),
  )
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(() =>
    isValidOption(searchParams.get('profissional'), professionals),
  )
  const [selectedDateId, setSelectedDateId] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [confirmed, setConfirmed] = useState(false)

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

  function handleNext() {
    if (!canContinue) return

    if (currentStep === steps.length - 1) {
      setConfirmed(true)
      return
    }

    setCurrentStep((step) => step + 1)
  }

  function handleReset() {
    setCurrentStep(0)
    setSelectedServiceId('')
    setSelectedProfessionalId('')
    setSelectedDateId('')
    setSelectedTime('')
    setConfirmed(false)
  }

  return (
    <>
      <section className={styles.hero} aria-labelledby="titulo-agendamento">
        <Container className={styles.heroContent}>
          <div>
            <Badge>Agendamento</Badge>
            <h1 id="titulo-agendamento">Reserve seu momento com tranquilidade.</h1>
          </div>
          <p>
            Escolha o serviço, encontre seu profissional e organize o melhor
            horário em poucos passos.
          </p>
        </Container>
      </section>

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

                {currentStep === 0 && (
                  <div className={styles.optionsGrid}>
                    {services.map((service) => (
                      <AppointmentOption
                        description={service.descricao}
                        key={service.id}
                        label={service.nome}
                        meta={`${service.duracaoMin} min · ${currencyFormatter.format(service.preco)}`}
                        onSelect={() => setSelectedServiceId(service.id)}
                        selected={selectedServiceId === service.id}
                        visual={`${service.duracaoMin}m`}
                      />
                    ))}
                  </div>
                )}

                {currentStep === 1 && (
                  <div className={styles.optionsGrid}>
                    {professionals.map((professional) => (
                      <AppointmentOption
                        description={professional.specialties.join(' · ')}
                        key={professional.id}
                        label={professional.name}
                        meta="Barbeiro especialista"
                        onSelect={() => setSelectedProfessionalId(professional.id)}
                        selected={selectedProfessionalId === professional.id}
                        visual={professional.initials}
                      />
                    ))}
                  </div>
                )}

                {currentStep === 2 && (
                  <div className={styles.compactGrid}>
                    {availableDates.map((date) => (
                      <AppointmentOption
                        key={date.id}
                        label={date.label}
                        meta="Disponível"
                        onSelect={() => setSelectedDateId(date.id)}
                        selected={selectedDateId === date.id}
                        visual={date.weekday}
                      />
                    ))}
                  </div>
                )}

                {currentStep === 3 && (
                  <div className={styles.timeGrid}>
                    {availableTimes.map((time) => (
                      <button
                        aria-pressed={selectedTime === time}
                        className={selectedTime === time ? styles.selectedTime : ''}
                        key={time}
                        onClick={() => setSelectedTime(time)}
                        type="button"
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                )}

                {currentStep === 4 && (
                  <dl className={styles.review}>
                    <div>
                      <dt>Serviço</dt>
                      <dd>{selectedService?.nome}</dd>
                    </div>
                    <div>
                      <dt>Profissional</dt>
                      <dd>{selectedProfessional?.name}</dd>
                    </div>
                    <div>
                      <dt>Data</dt>
                      <dd>{selectedDate ? `${selectedDate.weekday}, ${selectedDate.label}` : ''}</dd>
                    </div>
                    <div>
                      <dt>Horário</dt>
                      <dd>{selectedTime}</dd>
                    </div>
                    <div>
                      <dt>Duração</dt>
                      <dd>{selectedService?.duracaoMin} minutos</dd>
                    </div>
                    <div>
                      <dt>Valor</dt>
                      <dd>{selectedService ? currencyFormatter.format(selectedService.preco) : ''}</dd>
                    </div>
                  </dl>
                )}

                <div className={styles.actions}>
                  <Button
                    disabled={currentStep === 0}
                    onClick={() => setCurrentStep((step) => Math.max(0, step - 1))}
                    variant="ghost"
                  >
                    Voltar
                  </Button>
                  <Button disabled={!canContinue} onClick={handleNext}>
                    {currentStep === steps.length - 1
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
                  Preparamos o resumo do seu atendimento. Você poderá acompanhar
                  todos os detalhes na sua área de agendamentos.
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
              <div>
                <dt>Serviço</dt>
                <dd>{selectedService?.nome ?? 'A escolher'}</dd>
              </div>
              <div>
                <dt>Profissional</dt>
                <dd>{selectedProfessional?.name ?? 'A escolher'}</dd>
              </div>
              <div>
                <dt>Data</dt>
                <dd>{selectedDate?.label ?? 'A escolher'}</dd>
              </div>
              <div>
                <dt>Horário</dt>
                <dd>{selectedTime || 'A escolher'}</dd>
              </div>
            </dl>
            <div className={styles.total}>
              <span>Valor do serviço</span>
              <strong>
                {selectedService
                  ? currencyFormatter.format(selectedService.preco)
                  : '—'}
              </strong>
            </div>
          </aside>
        </Container>
      </section>
    </>
  )
}
