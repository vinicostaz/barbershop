export type Service = {
  descricao: string
  duracaoMin: number
  id: string
  nome: string
  preco: number
}

export const services: Service[] = [
  {
    id: 'corte-classico',
    nome: 'Corte clássico',
    descricao:
      'Corte personalizado com acabamento preciso, pensado para valorizar o seu estilo.',
    duracaoMin: 45,
    preco: 45,
  },
  {
    id: 'barba-completa',
    nome: 'Barba completa',
    descricao:
      'Modelagem, toalha quente e finalização para uma barba alinhada e confortável.',
    duracaoMin: 35,
    preco: 35,
  },
  {
    id: 'corte-e-barba',
    nome: 'Corte + barba',
    descricao:
      'Experiência completa para renovar o corte e cuidar da barba em um único horário.',
    duracaoMin: 75,
    preco: 70,
  },
  {
    id: 'acabamento',
    nome: 'Acabamento',
    descricao:
      'Ajuste rápido de contornos, costeletas e nuca para manter o visual sempre alinhado.',
    duracaoMin: 20,
    preco: 25,
  },
  {
    id: 'corte-infantil',
    nome: 'Corte infantil',
    descricao:
      'Atendimento cuidadoso e tranquilo para crianças, com corte adaptado ao seu estilo.',
    duracaoMin: 40,
    preco: 40,
  },
  {
    id: 'hidratacao-capilar',
    nome: 'Hidratação capilar',
    descricao:
      'Tratamento para recuperar maciez, brilho e proteção dos fios sem pesar no visual.',
    duracaoMin: 30,
    preco: 30,
  },
]
