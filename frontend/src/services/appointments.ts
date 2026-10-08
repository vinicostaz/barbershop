import { apiRequest } from './api'
import type { Service } from './catalog'

type ApiUserSummary = {
  id: string
  nome: string
}

type ApiAppointment = {
  barbeiro?: ApiUserSummary
  cliente?: ApiUserSummary
  data: string
  horaFim: string
  horaInicio: string
  id: string
  servico: Omit<Service, 'preco'> & { preco: number | string }
  status: 'CANCELADO' | 'CONCLUIDO' | 'CONFIRMADO'
}

export type Appointment = {
  barbeiro?: ApiUserSummary
  cliente?: ApiUserSummary
  data: string
  horaFim: string
  horaInicio: string
  id: string
  servico: Service
  status: ApiAppointment['status']
}

export type CreateAppointmentInput = {
  barbeiroId: string
  data: string
  horaInicio: string
  servicoId: string
}

function withAuthorization(token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return { ...options, headers }
}

function normalizeAppointment(appointment: ApiAppointment): Appointment {
  return {
    ...appointment,
    servico: {
      ...appointment.servico,
      descricao: appointment.servico.descricao || '',
      preco: Number(appointment.servico.preco),
    },
  }
}

export const appointmentsService = {
  async create(input: CreateAppointmentInput, token: string) {
    const appointment = await apiRequest<ApiAppointment>(
      '/agendamentos',
      withAuthorization(token, {
        body: JSON.stringify(input),
        method: 'POST',
      }),
    )

    return normalizeAppointment(appointment)
  },

  async list(token: string, signal?: AbortSignal) {
    const appointments = await apiRequest<ApiAppointment[]>(
      '/agendamentos',
      withAuthorization(token, { signal }),
    )

    return appointments.map(normalizeAppointment)
  },
}
