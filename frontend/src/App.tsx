import './App.css'

function App() {
  return (
    <div className="app-shell" id="inicio">
      <a className="skip-link" href="#conteudo-principal">
        Ir para o conteúdo principal
      </a>

      <header className="site-header">
        <div className="container header-content">
          <a className="brand" href="#inicio" aria-label="BarberShop - início">
            <span className="brand-mark" aria-hidden="true">
              BS
            </span>
            <span>BarberShop</span>
          </a>

          <nav className="main-navigation" aria-label="Navegação principal">
            <a className="nav-link nav-link-active" href="#inicio">
              Início
            </a>
            <a className="nav-link" href="#servicos">
              Serviços
            </a>
            <a className="nav-link" href="#profissionais">
              Profissionais
            </a>
            <a className="nav-link nav-link-highlight" href="#agendamentos">
              Agendamentos
            </a>
          </nav>
        </div>
      </header>

      <main id="conteudo-principal">
        <section className="hero-section" aria-labelledby="titulo-principal">
          <div className="container hero-content">
            <div className="hero-copy">
              <p className="eyebrow">Gestão e agendamento para barbearias</p>
              <h1 id="titulo-principal">
                Seu próximo atendimento começa com um horário bem organizado.
              </h1>
              <p className="hero-description">
                Consulte serviços, encontre profissionais e acompanhe seus
                agendamentos em um só lugar.
              </p>

              <div className="hero-actions" aria-label="Ações principais">
                <a className="primary-action" href="#servicos">
                  Ver serviços
                </a>
                <a className="secondary-action" href="#como-funciona">
                  Como funciona
                </a>
              </div>
            </div>

            <aside className="schedule-preview" aria-label="Resumo de agendamento">
              <p className="preview-label">Próximo passo</p>
              <h2>Encontre o melhor horário para você</h2>
              <ol className="booking-steps">
                <li>Escolha o serviço</li>
                <li>Selecione o profissional</li>
                <li>Confirme o horário</li>
              </ol>
            </aside>
          </div>
        </section>

        <section
          className="information-section"
          id="como-funciona"
          aria-labelledby="titulo-como-funciona"
        >
          <div className="container">
            <p className="section-kicker">Simples do início ao fim</p>
            <h2 id="titulo-como-funciona">Organize seu atendimento em poucos passos</h2>

            <div className="information-grid">
              <article>
                <span aria-hidden="true">01</span>
                <h3 id="servicos">Consulte os serviços</h3>
                <p>Veja as opções disponíveis antes de escolher seu horário.</p>
              </article>

              <article>
                <span aria-hidden="true">02</span>
                <h3 id="profissionais">Escolha o profissional</h3>
                <p>Encontre o barbeiro adequado para o atendimento desejado.</p>
              </article>

              <article>
                <span aria-hidden="true">03</span>
                <h3 id="agendamentos">Acompanhe o agendamento</h3>
                <p>Consulte as informações do atendimento em um único lugar.</p>
              </article>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="container footer-content">
          <div>
            <a className="brand brand-footer" href="#inicio">
              <span className="brand-mark" aria-hidden="true">
                BS
              </span>
              <span>BarberShop</span>
            </a>
            <p>Gestão e agendamento de atendimentos para barbearias.</p>
          </div>

          <p className="footer-note">Projeto Final Integrador</p>
        </div>
      </footer>
    </div>
  )
}

export default App
