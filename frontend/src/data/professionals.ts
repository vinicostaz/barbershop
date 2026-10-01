export type Professional = {
  description: string
  id: string
  initials: string
  name: string
  specialties: string[]
}

export const professionals: Professional[] = [
  {
    id: 'lucas-martins',
    initials: 'LM',
    name: 'Lucas Martins',
    description:
      'Combina técnica e precisão para criar cortes versáteis, alinhados à rotina e ao estilo de cada cliente.',
    specialties: ['Corte clássico', 'Degradê', 'Acabamento'],
  },
  {
    id: 'rafael-nunes',
    initials: 'RN',
    name: 'Rafael Nunes',
    description:
      'Especialista no cuidado com a barba, valoriza os contornos e proporções para um resultado natural e elegante.',
    specialties: ['Barba', 'Visagismo', 'Toalha quente'],
  },
  {
    id: 'diego-alves',
    initials: 'DA',
    name: 'Diego Alves',
    description:
      'Transforma referências contemporâneas em cortes personalizados, com atenção aos detalhes e à finalização.',
    specialties: ['Cortes modernos', 'Corte infantil', 'Finalização'],
  },
  {
    id: 'andre-costa',
    initials: 'AC',
    name: 'André Costa',
    description:
      'Entrega uma experiência completa para quem busca renovar o visual e manter cabelo e barba sempre bem cuidados.',
    specialties: ['Corte e barba', 'Navalha', 'Cuidados capilares'],
  },
]
