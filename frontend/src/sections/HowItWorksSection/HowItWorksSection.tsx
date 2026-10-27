import { Badge } from '../../components/ui/Badge/Badge'
import { Container } from '../../components/ui/Container/Container'
import { InformationCard } from '../../components/ui/InformationCard/InformationCard'
import styles from './HowItWorksSection.module.css'

const informationItems = [
  {
    description: 'Compare as opções e escolha o cuidado que combina com você.',
    id: 'servicos',
    step: '01',
    title: 'Consulte os serviços',
  },
  {
    description: 'Conheça as especialidades e encontre seu profissional ideal.',
    id: 'profissionais',
    step: '02',
    title: 'Escolha o profissional',
  },
  {
    description: 'Confirme a data e acompanhe todas as informações em um só lugar.',
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
        <div className={styles.headingLayout}>
          <div className={styles.headingCopy}>
            <Badge tone="brown">Simples do início ao fim</Badge>
            <h2 className={styles.title} id="titulo-como-funciona">
              Cuidado nos detalhes, praticidade no agendamento.
            </h2>
            <p className={styles.introduction}>
              Uma experiência pensada para você dedicar menos tempo à organização e
              mais tempo ao resultado.
            </p>
          </div>

          <figure className={styles.media}>
            <img
              src="/images/barber-tools.png"
              alt="Ferramentas profissionais de barbearia organizadas sobre madeira escura"
            />
            <figcaption>Precisão profissional em cada atendimento.</figcaption>
          </figure>
        </div>

        <div className={styles.grid}>
          {informationItems.map((item) => (
            <InformationCard {...item} key={item.id} />
          ))}
        </div>
      </Container>
    </section>
  )
}
