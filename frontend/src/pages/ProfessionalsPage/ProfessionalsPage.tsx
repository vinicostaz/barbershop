import { ActionLink } from '../../components/ui/ActionLink/ActionLink'
import { Badge } from '../../components/ui/Badge/Badge'
import { Container } from '../../components/ui/Container/Container'
import { ProfessionalCard } from '../../components/ui/ProfessionalCard/ProfessionalCard'
import styles from './ProfessionalsPage.module.css'

const professionals = [
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

export function ProfessionalsPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="titulo-profissionais">
        <Container className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <Badge>Profissionais</Badge>
            <h1 className={styles.title} id="titulo-profissionais">
              Técnica apurada, cuidado que entende o seu estilo.
            </h1>
            <p className={styles.description}>
              Conheça nossa equipe, descubra diferentes especialidades e escolha
              quem vai cuidar do seu próximo visual.
            </p>

            <ul className={styles.highlights} aria-label="Diferenciais da equipe">
              <li>Atendimento atento</li>
              <li>Especialidades diversas</li>
            </ul>
          </div>

          <aside className={styles.teamPanel} aria-label="Resumo da equipe">
            <span className={styles.panelEyebrow}>Equipe BarberShop</span>
            <h2>Especialistas em diferentes estilos.</h2>
            <p>
              Cada profissional traz sua própria experiência para entregar um
              atendimento cuidadoso do início à finalização.
            </p>

            <div className={styles.avatarRow} aria-hidden="true">
              {professionals.map((professional) => (
                <span key={professional.id}>{professional.initials}</span>
              ))}
            </div>

            <dl className={styles.teamStats}>
              <div>
                <dt>Profissionais</dt>
                <dd>{String(professionals.length).padStart(2, '0')}</dd>
              </div>
              <div>
                <dt>Foco</dt>
                <dd>Seu estilo</dd>
              </div>
            </dl>
          </aside>
        </Container>
      </section>

      <section className={styles.directory} aria-labelledby="titulo-equipe">
        <Container>
          <header className={styles.directoryHeader}>
            <div>
              <span className={styles.eyebrow}>Conheça a equipe</span>
              <h2 id="titulo-equipe">
                Encontre o profissional que combina com você.
              </h2>
            </div>
            <p>
              Compare especialidades e escolha o atendimento mais alinhado ao
              resultado que você procura.
            </p>
          </header>

          <div className={styles.grid}>
            {professionals.map((professional, index) => (
              <ProfessionalCard
                description={professional.description}
                id={professional.id}
                index={index + 1}
                initials={professional.initials}
                key={professional.id}
                name={professional.name}
                specialties={professional.specialties}
              />
            ))}
          </div>

          <aside className={styles.callout}>
            <div>
              <span className={styles.eyebrow}>Pronto para escolher?</span>
              <h2>Seu próximo atendimento pode começar agora.</h2>
            </div>
            <ActionLink to="/agendamentos" variant="secondary">
              Ir para agendamentos
            </ActionLink>
          </aside>
        </Container>
      </section>
    </>
  )
}
