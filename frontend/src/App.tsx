import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import styles from './App.module.css'
import { Footer } from './components/layout/Footer/Footer'
import { Header } from './components/layout/Header/Header'
import { AppointmentsPage } from './pages/AppointmentsPage/AppointmentsPage'
import { HomePage } from './pages/HomePage/HomePage'
import { NotFoundPage } from './pages/NotFoundPage/NotFoundPage'
import { ProfessionalsPage } from './pages/ProfessionalsPage/ProfessionalsPage'
import { ServicesPage } from './pages/ServicesPage/ServicesPage'

const pageTitles: Record<string, string> = {
  '/': 'BarberShop',
  '/agendamentos': 'Agendamentos | BarberShop',
  '/profissionais': 'Profissionais | BarberShop',
  '/servicos': 'Serviços | BarberShop',
}

function App() {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = pageTitles[pathname] ?? 'Página não encontrada | BarberShop'
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  return (
    <div className={styles.appShell}>
      <a className={styles.skipLink} href="#conteudo-principal">
        Ir para o conteúdo principal
      </a>

      <Header />

      <main className={styles.main} id="conteudo-principal">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/servicos" element={<ServicesPage />} />
          <Route path="/profissionais" element={<ProfessionalsPage />} />
          <Route path="/agendamentos" element={<AppointmentsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}

export default App
