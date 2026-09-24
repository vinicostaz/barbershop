import { Container } from '../../components/ui/Container/Container'
import { InformationCard } from '../../components/ui/InformationCard/InformationCard'
import styles from './HowItWorksSection.module.css'

const informationItems = [
  {
    description: 'Veja as opções disponíveis antes de escolher seu horário.',
    id: 'servicos',
    step: '01',
    title: 'Consulte os serviços',
  },
  {
    description: 'Encontre o barbeiro adequado para o atendimento desejado.',
    id: 'profissionais',
    step: '02',
    title: 'Escolha o profissional',
  },
  {
    description: 'Consulte as informações do atendimento em um único lugar.',
    id: 'agendamentos',
    step: '03',
    title: 'Acompanhe o agendamento',
  },
]

export function HowItWorksSection() {
  return (
    <section
      className={styles.section}
      id="como-funciona"
      aria-labelledby="titulo-como-funciona"
    >
      <Container>
        <p className={styles.kicker}>Simples do início ao fim</p>
        <h2 className={styles.title} id="titulo-como-funciona">
          Organize seu atendimento em poucos passos
        </h2>

        <div className={styles.grid}>
          {informationItems.map((item) => (
            <InformationCard {...item} key={item.id} />
          ))}
        </div>
      </Container>
    </section>
  )
}
