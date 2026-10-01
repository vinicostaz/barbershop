import { ActionLink } from '../../components/ui/ActionLink/ActionLink'
import { Badge } from '../../components/ui/Badge/Badge'
import { Container } from '../../components/ui/Container/Container'
import { ServiceCard } from '../../components/ui/ServiceCard/ServiceCard'
import { services } from '../../data/services'
import styles from './ServicesPage.module.css'

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
