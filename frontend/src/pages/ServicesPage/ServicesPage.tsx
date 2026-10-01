import { ActionLink } from '../../components/ui/ActionLink/ActionLink'
import { Badge } from '../../components/ui/Badge/Badge'
import { Container } from '../../components/ui/Container/Container'
import { ServiceCard } from '../../components/ui/ServiceCard/ServiceCard'
import styles from './ServicesPage.module.css'

const services = [
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

export function ServicesPage() {
  return (
    <>
      <section className={styles.hero} aria-labelledby="titulo-servicos">
        <Container className={styles.heroContent}>
          <div className={styles.heroCopy}>
            <Badge>Serviços</Badge>
            <h1 className={styles.title} id="titulo-servicos">
              Cuidado profissional para cada detalhe do seu estilo.
            </h1>
            <p className={styles.description}>
              Compare as opções, conheça o tempo de cada atendimento e escolha
              o serviço ideal para o seu próximo horário.
            </p>

            <ul className={styles.highlights} aria-label="Diferenciais dos serviços">
              <li>Atendimento personalizado</li>
              <li>Horários organizados</li>
            </ul>
          </div>

          <figure className={styles.heroImage}>
            <img
              src="/images/barbershop-services.png"
              alt="Cliente exibindo o resultado final de um corte feito na barbearia"
            />
            <figcaption>
              Seu estilo finalizado com técnica, cuidado e precisão.
            </figcaption>
          </figure>
        </Container>
      </section>

      <section className={styles.catalog} aria-labelledby="titulo-catalogo">
        <Container>
          <header className={styles.catalogHeader}>
            <div>
              <span className={styles.eyebrow}>Nossos serviços</span>
              <h2 id="titulo-catalogo">Escolha o seu cuidado</h2>
            </div>
            <p>
              Encontre o atendimento ideal para o seu momento e reserve seu
              horário com praticidade.
            </p>
          </header>

          <div className={styles.grid}>
            {services.map((service, index) => (
              <ServiceCard
                description={service.descricao}
                duration={service.duracaoMin}
                id={service.id}
                index={index + 1}
                key={service.id}
                name={service.nome}
                price={service.preco}
              />
            ))}
          </div>

          <aside className={styles.callout}>
            <div>
              <span className={styles.eyebrow}>Precisa de ajuda?</span>
              <h2>Escolha o serviço agora e ajuste os detalhes no agendamento.</h2>
            </div>
            <ActionLink to="/agendamentos" variant="secondary">
              Ver agendamentos
            </ActionLink>
          </aside>
        </Container>
      </section>
    </>
  )
}
