const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3333').replace(
  /\/$/,
  '',
)

type ErrorPayload = {
  error?: string
}

export const UNAUTHORIZED_EVENT = 'barbershop:unauthorized'

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = new Headers(options.headers)

  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response

  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new ApiError(
      'Não foi possível conectar ao servidor. Tente novamente em instantes.',
      0,
    )
  }

  const isJson = response.headers
    .get('content-type')
    ?.includes('application/json')
  const data: unknown = isJson ? await response.json() : null

  if (!response.ok) {
    const payload = data as ErrorPayload | null
    if (response.status === 401) {
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw new ApiError(
      payload?.error ?? 'Não foi possível concluir a solicitação.',
      response.status,
    )
  }

  return data as T
}
