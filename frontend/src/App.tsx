import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { ProfileRoute } from './auth/ProfileRoute'
import styles from './App.module.css'
import { Footer } from './components/layout/Footer/Footer'
import { Header } from './components/layout/Header/Header'
import { RoutePage } from './components/layout/RoutePage/RoutePage'
import { AdminPage } from './pages/AdminPage/AdminPage'
import { AppointmentsPage } from './pages/AppointmentsPage/AppointmentsPage'
import { AuthPage } from './pages/AuthPage/AuthPage'
import { HomePage } from './pages/HomePage/HomePage'
import { NotFoundPage } from './pages/NotFoundPage/NotFoundPage'
import { ProfessionalsPage } from './pages/ProfessionalsPage/ProfessionalsPage'
import { ServicesPage } from './pages/ServicesPage/ServicesPage'

const pageTitles: Record<string, string> = {
  '/': 'BarberShop',
  '/admin': 'Administração | BarberShop',
  '/agendamentos': 'Agendamentos | BarberShop',
  '/cadastro': 'Criar conta | BarberShop',
  '/login': 'Entrar | BarberShop',
  '/profissionais': 'Profissionais | BarberShop',
  '/profissional': 'Área profissional | BarberShop',
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
          <Route path="/login" element={<AuthPage key="login" mode="login" />} />
          <Route
            path="/cadastro"
            element={<AuthPage key="register" mode="register" />}
          />
          <Route path="/servicos" element={<ServicesPage />} />
          <Route path="/profissionais" element={<ProfessionalsPage />} />
          <Route
            path="/agendamentos"
            element={
              <ProfileRoute
                allowedRoles={['CLIENTE', 'BARBEIRO', 'ADMINISTRADOR']}
              >
                <AppointmentsPage />
              </ProfileRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProfileRoute allowedRoles={['ADMINISTRADOR']}>
                <AdminPage />
              </ProfileRoute>
            }
          />
          <Route
            path="/profissional"
            element={
              <ProfileRoute allowedRoles={['BARBEIRO', 'ADMINISTRADOR']}>
                <RoutePage
                  description="Consulte sua rotina profissional e acompanhe os atendimentos vinculados ao seu perfil."
                  eyebrow="Área profissional"
                  title="Sua agenda de trabalho organizada."
                />
              </ProfileRoute>
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>

      <Footer />
    </div>
  )
}

export default App
