import { apiRequest } from './api'

export type Availability = {
  barbeiroId: string
  diaSemana: number
  horaFim: string
  horaInicio: string
  id: string
}

export type AvailabilityInput = Pick<
  Availability,
  'diaSemana' | 'horaFim' | 'horaInicio'
>

export type ScheduleBlock = {
  barbeiroId: string
  criadoEm: string
  fim: string
  id: string
  inicio: string
  motivo: string | null
}

export type ScheduleBlockInput = {
  fim: string
  inicio: string
  motivo?: string
}

function withAuthorization(token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return { ...options, headers }
}

export const availabilityService = {
  listAvailability(professionalId: string, signal?: AbortSignal) {
    return apiRequest<Availability[]>(
      `/disponibilidades/barbeiros/${professionalId}`,
      { signal },
    )
  },

  createAvailability(
    professionalId: string,
    input: AvailabilityInput,
    token: string,
  ) {
    return apiRequest<Availability>(
      `/disponibilidades/barbeiros/${professionalId}`,
      withAuthorization(token, {
        body: JSON.stringify(input),
        method: 'POST',
      }),
    )
  },

  updateAvailability(id: string, input: AvailabilityInput, token: string) {
    return apiRequest<Availability>(
      `/disponibilidades/${id}`,
      withAuthorization(token, {
        body: JSON.stringify(input),
        method: 'PUT',
      }),
    )
  },

  removeAvailability(id: string, token: string) {
    return apiRequest<void>(
      `/disponibilidades/${id}`,
      withAuthorization(token, { method: 'DELETE' }),
    )
  },

  listBlocks(professionalId: string, token: string, signal?: AbortSignal) {
    return apiRequest<ScheduleBlock[]>(
      `/bloqueios/barbeiros/${professionalId}`,
      withAuthorization(token, { signal }),
    )
  },

  createBlock(
    professionalId: string,
    input: ScheduleBlockInput,
    token: string,
  ) {
    return apiRequest<ScheduleBlock>(
      `/bloqueios/barbeiros/${professionalId}`,
      withAuthorization(token, {
        body: JSON.stringify(input),
        method: 'POST',
      }),
    )
  },

  removeBlock(id: string, token: string) {
    return apiRequest<void>(
      `/bloqueios/${id}`,
      withAuthorization(token, { method: 'DELETE' }),
    )
  },
}
