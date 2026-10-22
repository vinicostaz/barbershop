import { apiRequest } from './api'

export type AdminService = {
  descricao: string | null
  duracaoMin: number
  id: string
  nome: string
  preco: number
}

export type Specialty = {
  id: string
  nome: string
}

type ApiProfessionalSpecialty = {
  especialidade: Specialty
  especialidadeId: string
}

type ApiProfessional = {
  ativo: boolean
  email: string
  especialidades?: ApiProfessionalSpecialty[]
  id: string
  nome: string
  telefone: string | null
}

export type AdminProfessional = Omit<ApiProfessional, 'especialidades'> & {
  especialidades: Specialty[]
}

export type ServiceInput = {
  descricao?: string
  duracaoMin: number
  nome: string
  preco: number
}

export type ProfessionalInput = {
  email: string
  especialidadeIds: string[]
  nome: string
  senha: string
  telefone?: string
}

function withAuthorization(token: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  headers.set('Authorization', `Bearer ${token}`)

  return { ...options, headers }
}

function normalizeService(service: Omit<AdminService, 'preco'> & { preco: number | string }) {
  return { ...service, preco: Number(service.preco) }
}

function normalizeProfessional(professional: ApiProfessional): AdminProfessional {
  return {
    ...professional,
    especialidades: (professional.especialidades ?? []).map(
      ({ especialidade }) => especialidade,
    ),
  }
}

export const adminService = {
  async listServices(signal?: AbortSignal) {
    const services = await apiRequest<
      Array<Omit<AdminService, 'preco'> & { preco: number | string }>
    >('/servicos', { signal })
    return services.map(normalizeService)
  },

  async createService(input: ServiceInput, token: string) {
    const service = await apiRequest<
      Omit<AdminService, 'preco'> & { preco: number | string }
    >(
      '/servicos',
      withAuthorization(token, {
        body: JSON.stringify(input),
        method: 'POST',
      }),
    )
    return normalizeService(service)
  },

  async updateService(id: string, input: ServiceInput, token: string) {
    const service = await apiRequest<
      Omit<AdminService, 'preco'> & { preco: number | string }
    >(
      `/servicos/${id}`,
      withAuthorization(token, {
        body: JSON.stringify(input),
        method: 'PUT',
      }),
    )
    return normalizeService(service)
  },

  removeService(id: string, token: string) {
    return apiRequest<void>(
      `/servicos/${id}`,
      withAuthorization(token, { method: 'DELETE' }),
    )
  },

  listSpecialties(signal?: AbortSignal) {
    return apiRequest<Specialty[]>('/especialidades', { signal })
  },

  createSpecialty(nome: string, token: string) {
    return apiRequest<Specialty>(
      '/especialidades',
      withAuthorization(token, {
        body: JSON.stringify({ nome }),
        method: 'POST',
      }),
    )
  },

  updateSpecialty(id: string, nome: string, token: string) {
    return apiRequest<Specialty>(
      `/especialidades/${id}`,
      withAuthorization(token, {
        body: JSON.stringify({ nome }),
        method: 'PUT',
      }),
    )
  },

  removeSpecialty(id: string, token: string) {
    return apiRequest<void>(
      `/especialidades/${id}`,
      withAuthorization(token, { method: 'DELETE' }),
    )
  },

  async listProfessionals(token: string, signal?: AbortSignal) {
    const professionals = await apiRequest<ApiProfessional[]>(
      '/barbeiros/todos',
      withAuthorization(token, { signal }),
    )
    return professionals.map(normalizeProfessional)
  },

  async createProfessional(input: ProfessionalInput, token: string) {
    const professional = await apiRequest<ApiProfessional>(
      '/barbeiros',
      withAuthorization(token, {
        body: JSON.stringify({
          email: input.email,
          nome: input.nome,
          senha: input.senha,
          telefone: input.telefone,
        }),
        method: 'POST',
      }),
    )

    if (input.especialidadeIds.length === 0) {
      return normalizeProfessional(professional)
    }

    return this.updateProfessionalSpecialties(
      professional.id,
      input.especialidadeIds,
      token,
    )
  },

  async updateProfessional(
    id: string,
    input: Pick<ProfessionalInput, 'especialidadeIds' | 'nome' | 'telefone'>,
    token: string,
  ) {
    await apiRequest<ApiProfessional>(
      `/barbeiros/${id}`,
      withAuthorization(token, {
        body: JSON.stringify({ nome: input.nome, telefone: input.telefone }),
        method: 'PUT',
      }),
    )

    return this.updateProfessionalSpecialties(
      id,
      input.especialidadeIds,
      token,
    )
  },

  async updateProfessionalSpecialties(
    id: string,
    especialidadeIds: string[],
    token: string,
  ) {
    const professional = await apiRequest<ApiProfessional>(
      `/barbeiros/${id}/especialidades`,
      withAuthorization(token, {
        body: JSON.stringify({ especialidadeIds }),
        method: 'PUT',
      }),
    )
    return normalizeProfessional(professional)
  },

  async setProfessionalActive(id: string, ativo: boolean, token: string) {
    const professional = await apiRequest<ApiProfessional>(
      `/barbeiros/${id}/ativo`,
      withAuthorization(token, {
        body: JSON.stringify({ ativo }),
        method: 'PATCH',
      }),
    )
    return normalizeProfessional(professional)
  },
}
