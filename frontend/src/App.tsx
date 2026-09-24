import styles from './App.module.css'
import { Footer } from './components/layout/Footer/Footer'
import { Header } from './components/layout/Header/Header'
import { HomePage } from './pages/HomePage/HomePage'

function App() {
  return (
    <div className={styles.appShell} id="inicio">
      <a className={styles.skipLink} href="#conteudo-principal">
        Ir para o conteúdo principal
      </a>

      <Header />

      <main className={styles.main} id="conteudo-principal">
        <HomePage />
      </main>

      <Footer />
    </div>
  )
}

export default App
