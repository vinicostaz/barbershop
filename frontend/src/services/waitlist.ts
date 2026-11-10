import { apiRequest } from './api'
import type { Appointment } from './appointments'
import type { Service } from './catalog'

type ApiUserSummary = {
  id: string
  nome: string
}

export type WaitlistStatus =
  | 'AGUARDANDO'
  | 'NOTIFICADO'
  | 'CONFIRMADO'
  | 'EXPIRADO'
  | 'DESISTIU'

export type WaitlistEntry = {
  barbeiro: ApiUserSummary
  criadoEm: string
  expiraEm: string | null
  horaFim: string
  horaInicio: string
  id: string
  pessoasNaFrente: number | null
  podeConfirmar: boolean
  posicao: number | null
  servico: Service
  status: WaitlistStatus
}

export type EligibleWaitlistTime = {
  data: string
  horaFim: string
  horaInicio: string
}

export type Notification = {
  agendamentoId: string | null
  criadoEm: string
  filaDeEsperaId: string | null
  id: string
  lida: boolean
  mensagem: string
  tipo:
    | 'HORARIO_LIBERADO'
    | 'PRIORIDADE_EXPIRADA'
    | 'AGENDAMENTO_CANCELADO'
    | 'ATENDIMENTO_CONCLUIDO'
  usuarioId: string
}

export type JoinWaitlistInput = {
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

function normalizeEntry(
  entry: Omit<WaitlistEntry, 'servico'> & {
    servico: Omit<Service, 'preco'> & { preco: number | string }
  },
): WaitlistEntry {
  return {
    ...entry,
    servico: {
      ...entry.servico,
      descricao: entry.servico.descricao || '',
      preco: Number(entry.servico.preco),
    },
  }
}

export const waitlistService = {
  async confirm(id: string, token: string) {
    return apiRequest<Appointment>(
      `/fila-de-espera/${id}/confirmar`,
      withAuthorization(token, { method: 'POST' }),
    )
  },

  async join(input: JoinWaitlistInput, token: string) {
    const entry = await apiRequest<WaitlistEntry>(
      '/fila-de-espera',
      withAuthorization(token, {
        body: JSON.stringify(input),
        method: 'POST',
      }),
    )

    return normalizeEntry(entry)
  },

  async leave(id: string, token: string) {
    await apiRequest<unknown>(
      `/fila-de-espera/${id}`,
      withAuthorization(token, { method: 'DELETE' }),
    )
  },

  async listEntries(token: string, signal?: AbortSignal) {
    const entries = await apiRequest<WaitlistEntry[]>(
      '/fila-de-espera',
      withAuthorization(token, { signal }),
    )

    return entries.map(normalizeEntry)
  },

  listEligibleTimes(
    professionalId: string,
    serviceId: string,
    date: string,
    token: string,
    signal?: AbortSignal,
  ) {
    const query = new URLSearchParams({
      barbeiroId: professionalId,
      data: date,
      servicoId: serviceId,
    })

    return apiRequest<EligibleWaitlistTime[]>(
      `/fila-de-espera/horarios-elegiveis?${query}`,
      withAuthorization(token, { signal }),
    )
  },

  listNotifications(token: string, signal?: AbortSignal) {
    return apiRequest<Notification[]>(
      '/notificacoes',
      withAuthorization(token, { signal }),
    )
  },

  markNotificationRead(id: string, token: string) {
    return apiRequest<Notification>(
      `/notificacoes/${id}/lida`,
      withAuthorization(token, { method: 'PATCH' }),
    )
  },
}
