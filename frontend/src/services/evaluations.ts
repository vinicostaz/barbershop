import { apiRequest } from './api'

export type Evaluation = {
  agendamentoId: string
  comentario: string | null
  criadoEm: string
  id: string
  nota: number
}

export type CreateEvaluationInput = {
  agendamentoId: string
  comentario?: string
  nota: number
}

function withAuthorization(token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return { ...options, headers }
}

export const evaluationsService = {
  create(input: CreateEvaluationInput, token: string) {
    return apiRequest<Evaluation>(
      '/avaliacoes',
      withAuthorization(token, {
        body: JSON.stringify(input),
        method: 'POST',
      }),
    )
  },
}
