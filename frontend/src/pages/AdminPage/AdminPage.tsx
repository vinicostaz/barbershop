import { useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/useAuth'
import { ProfessionalsManager } from '../../components/admin/ProfessionalsManager'
import { ServicesManager } from '../../components/admin/ServicesManager'
import { SpecialtiesManager } from '../../components/admin/SpecialtiesManager'
import { Badge } from '../../components/ui/Badge/Badge'
import { Container } from '../../components/ui/Container/Container'
import styles from './AdminPage.module.css'

type ManagementSection = 'professionals' | 'services' | 'specialties'

type AdministrativeModule = {
  description: string
  number: string
  pageSection?: 'agenda' | 'availability'
  section?: ManagementSection
  status?: string
  title: string
  to?: string
}

const administrativeModules: AdministrativeModule[] = [
  {
    description: 'Cadastro, edição, preços, duração e disponibilidade no catálogo.',
    number: '01',
    section: 'services',
    title: 'Serviços',
  },
  {
    description: 'Cadastro de profissionais e organização dos dados da equipe.',
    number: '02',
    section: 'professionals',
    title: 'Profissionais',
  },
  {
    description: 'Organização das especialidades oferecidas pelos profissionais.',
    number: '03',
    section: 'specialties',
    title: 'Especialidades',
  },
  {
    description: 'Consulta dos horários e acompanhamento dos atendimentos.',
    number: '04',
    status: 'Disponível',
    title: 'Agendamentos',
    to: '/profissional',
  },
  {
    description: 'Horários semanais, folgas, pausas e períodos indisponíveis.',
    number: '05',
    pageSection: 'availability',
    status: 'Disponível',
    title: 'Disponibilidade',
    to: '/profissional',
  },
]

export function AdminPage() {
  const { session } = useAuth()
  const [activeSection, setActiveSection] = useState<ManagementSection>('services')

  function selectSection(section: ManagementSection) {
    setActiveSection(section)
  }

  function handleModuleKeyDown(
    event: KeyboardEvent<HTMLElement>,
    section: ManagementSection,
  ) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectSection(section)
    }
  }

  return (
    <section className={styles.page} aria-labelledby="titulo-administrativo">
      <Container>
        <header className={styles.hero}>
          <div className={styles.heroCopy}>
            <Badge tone="brown">Área administrativa</Badge>
            <h1 id="titulo-administrativo">Controle da barbearia em um só lugar.</h1>
            <p>
              Olá, {session?.usuario.nome.split(' ')[0]}. Esta é a estrutura
              inicial para acompanhar e gerenciar a operação da barbearia.
            </p>
          </div>

          <aside className={styles.accessCard} aria-label="Informações de acesso">
            <span className={styles.accessLabel}>Acesso atual</span>
            <strong>Administrador</strong>
            <p>Perfil autorizado para visualizar a estrutura administrativa.</p>
          </aside>
        </header>

        <div className={styles.sectionHeading}>
          <div>
            <span>Gestão da operação</span>
            <h2>Módulos administrativos</h2>
          </div>
          <p>Selecione uma área para consultar e atualizar os dados da barbearia.</p>
        </div>

        <div className={styles.moduleGrid}>
          {administrativeModules.map(
            ({
              description,
              number,
              pageSection = 'agenda',
              section,
              status = 'Gerenciar',
              title,
              to,
            }) => {
              const content = (
                <>
                  <span className={styles.moduleNumber} aria-hidden="true">
                    {number}
                  </span>
                  <span
                    className={`${styles.moduleStatus} ${to || section ? styles.availableStatus : ''}`}
                  >
                    {status}
                  </span>
                  <h3>{title}</h3>
                  <p>{description}</p>
                  <span className={styles.moduleAction}>
                    {to ? 'Abrir agenda' : 'Abrir módulo'}{' '}
                    <span aria-hidden="true">→</span>
                  </span>
                </>
              )

              if (to) {
                return (
                  <Link
                    className={styles.moduleCard}
                    key={title}
                    state={{ fromAdmin: true, section: pageSection }}
                    to={to}
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <article
                  className={`${styles.moduleCard} ${section === activeSection ? styles.activeModule : ''}`}
                  key={title}
                  onClick={() => selectSection(section as ManagementSection)}
                  onKeyDown={(event) =>
                    handleModuleKeyDown(event, section as ManagementSection)
                  }
                  role="button"
                  tabIndex={0}
                >
                  {content}
                </article>
              )
            },
          )}
        </div>

        {session && (
          <section className={styles.management} id="admin-management">
            {activeSection === 'services' && <ServicesManager token={session.token} />}
            {activeSection === 'professionals' && (
              <ProfessionalsManager token={session.token} />
            )}
            {activeSection === 'specialties' && (
              <SpecialtiesManager token={session.token} />
            )}
          </section>
        )}
      </Container>
    </section>
  )
}
