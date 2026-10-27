import { apiRequest } from './api'

type ApiService = {
  descricao: string | null
  duracaoMin: number
  id: string
  nome: string
  preco: number | string
}

type ApiSpecialty = {
  especialidade?: {
    nome?: string
  }
}

type ApiProfessional = {
  especialidades?: ApiSpecialty[]
  id: string
  nome: string
}

export type Service = {
  descricao: string
  duracaoMin: number
  id: string
  nome: string
  preco: number
}

export type Professional = {
  description: string
  id: string
  initials: string
  name: string
  specialties: string[]
}

function createInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

function normalizeService(service: ApiService): Service {
  const price = Number(service.preco)

  return {
    ...service,
    descricao:
      service.descricao?.trim() ||
      'Atendimento realizado com cuidado, técnica e atenção aos detalhes.',
    preco: Number.isFinite(price) ? price : 0,
  }
}

function normalizeProfessional(professional: ApiProfessional): Professional {
  const specialties = (professional.especialidades ?? [])
    .map((item) => item.especialidade?.nome?.trim())
    .filter((specialty): specialty is string => Boolean(specialty))

  return {
    description:
      specialties.length > 0
        ? 'Profissional preparado para oferecer um atendimento alinhado ao seu estilo.'
        : 'Profissional da equipe disponível para cuidar do seu próximo atendimento.',
    id: professional.id,
    initials: createInitials(professional.nome),
    name: professional.nome,
    specialties,
  }
}

export const catalogService = {
  async listProfessionals(signal?: AbortSignal) {
    const professionals = await apiRequest<ApiProfessional[]>('/barbeiros', {
      signal,
    })

    return professionals.map(normalizeProfessional)
  },

  async listServices(signal?: AbortSignal) {
    const services = await apiRequest<ApiService[]>('/servicos', { signal })

    return services.map(normalizeService)
  },

  listAvailableDates(
    professionalId: string,
    serviceId: string,
    signal?: AbortSignal,
  ) {
    const query = new URLSearchParams({ limite: '5', servicoId: serviceId })

    return apiRequest<string[]>(
      `/disponibilidades/barbeiros/${professionalId}/datas?${query}`,
      { signal },
    )
  },

  listAvailableTimes(
    professionalId: string,
    date: string,
    serviceId: string,
    signal?: AbortSignal,
  ) {
    const query = new URLSearchParams({ data: date, servicoId: serviceId })

    return apiRequest<string[]>(
      `/disponibilidades/barbeiros/${professionalId}/horarios?${query}`,
      { signal },
    )
  },
}
