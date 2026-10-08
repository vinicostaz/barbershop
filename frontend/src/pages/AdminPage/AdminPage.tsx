import { useAuth } from '../../auth/useAuth'
import { Badge } from '../../components/ui/Badge/Badge'
import { Container } from '../../components/ui/Container/Container'
import styles from './AdminPage.module.css'

const administrativeModules = [
  {
    description: 'Cadastro, edição, preços, duração e disponibilidade no catálogo.',
    number: '01',
    title: 'Serviços',
  },
  {
    description: 'Cadastro de profissionais e organização dos dados da equipe.',
    number: '02',
    title: 'Profissionais',
  },
  {
    description: 'Organização das especialidades oferecidas pelos profissionais.',
    number: '03',
    title: 'Especialidades',
  },
  {
    description: 'Consulta dos horários e acompanhamento dos atendimentos.',
    number: '04',
    title: 'Agendamentos',
  },
]

export function AdminPage() {
  const { session } = useAuth()

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
            <span>Estrutura inicial</span>
            <h2>Módulos administrativos</h2>
          </div>
          <p>As funções de gerenciamento serão integradas nas próximas tarefas.</p>
        </div>

        <div className={styles.moduleGrid}>
          {administrativeModules.map(({ description, number, title }) => (
            <article className={styles.moduleCard} key={title}>
              <span className={styles.moduleNumber} aria-hidden="true">
                {number}
              </span>
              <span className={styles.moduleStatus}>Próxima etapa</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </Container>
    </section>
  )
}
