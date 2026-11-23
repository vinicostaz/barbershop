import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/useAuth'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Container } from '../../components/ui/Container/Container'
import { TextField } from '../../components/ui/FormField/FormField'
import { ApiError } from '../../services/api'
import { authService, type UserProfile } from '../../services/auth'
import styles from './ProfilePage.module.css'

type FormErrors = Partial<Record<'email' | 'nome' | 'telefone', string>>

const roleLabels: Record<UserProfile['role'], string> = {
  ADMINISTRADOR: 'Administrador',
  BARBEIRO: 'Profissional',
  CLIENTE: 'Cliente',
}

const createdAtFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'long',
})

function validateProfile(nome: string, email: string, telefone: string) {
  const errors: FormErrors = {}

  if (nome.trim().length < 2) {
    errors.nome = 'Digite um nome com pelo menos 2 caracteres.'
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    errors.email = 'Informe um e-mail válido.'
  }
  if (telefone.trim() && (telefone.trim().length < 8 || telefone.trim().length > 20)) {
    errors.telefone = 'O telefone deve ter entre 8 e 20 caracteres.'
  }

  return errors
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError && error.message ? error.message : fallback
}

export function ProfilePage() {
  const { session, updateProfile } = useAuth()
  const token = session?.token
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [errors, setErrors] = useState<FormErrors>({})
  const [loadError, setLoadError] = useState('')
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!token) return

    const authToken = token
    const controller = new AbortController()

    async function loadProfile() {
      setIsLoading(true)
      setLoadError('')

      try {
        const loadedProfile = await authService.getProfile(
          authToken,
          controller.signal,
        )
        setProfile(loadedProfile)
        setNome(loadedProfile.nome)
        setEmail(loadedProfile.email)
        setTelefone(loadedProfile.telefone ?? '')
      } catch (error) {
        if (controller.signal.aborted) return
        setLoadError(
          getErrorMessage(error, 'Não foi possível carregar os dados da conta.'),
        )
      } finally {
        if (!controller.signal.aborted) setIsLoading(false)
      }
    }

    void loadProfile()
    return () => controller.abort()
  }, [reloadKey, token])

  function restoreProfile() {
    if (!profile) return
    setNome(profile.nome)
    setEmail(profile.email)
    setTelefone(profile.telefone ?? '')
    setErrors({})
    setSubmitError('')
    setSuccessMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors = validateProfile(nome, email, telefone)
    setErrors(nextErrors)
    setSubmitError('')
    setSuccessMessage('')
    if (Object.keys(nextErrors).length > 0) return

    setIsSubmitting(true)
    try {
      const updatedProfile = await updateProfile({
        email: email.trim(),
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
      })
      setProfile(updatedProfile)
      setNome(updatedProfile.nome)
      setEmail(updatedProfile.email)
      setTelefone(updatedProfile.telefone ?? '')
      setSuccessMessage('Dados atualizados com sucesso.')
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, 'Não foi possível atualizar os dados da conta.'),
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={styles.page} aria-labelledby="profile-title">
      <Container>
        <header className={styles.hero}>
          <div>
            <Badge tone="brown">Sua conta</Badge>
            <h1 id="profile-title">Meu perfil</h1>
            <p>
              Consulte suas informações e mantenha seus dados de contato atualizados.
            </p>
          </div>
          {profile && (
            <div className={styles.pointsCard}>
              <span>Fidelidade</span>
              <strong>{profile.pontosFidelidade}</strong>
              <p>{profile.pontosFidelidade === 1 ? 'ponto acumulado' : 'pontos acumulados'}</p>
            </div>
          )}
        </header>

        {isLoading && (
          <div className={styles.dataState} role="status">
            Carregando seus dados...
          </div>
        )}

        {!isLoading && loadError && (
          <div className={styles.dataState} role="alert">
            <strong>Não foi possível abrir seu perfil</strong>
            <p>{loadError}</p>
            <Button onClick={() => setReloadKey((key) => key + 1)} size="small">
              Tentar novamente
            </Button>
          </div>
        )}

        {!isLoading && profile && (
          <div className={styles.layout}>
            <aside className={styles.summary} aria-label="Resumo da conta">
              <span>Informações da conta</span>
              <h2>{profile.nome}</h2>
              <dl>
                <div>
                  <dt>Perfil</dt>
                  <dd>{roleLabels[profile.role]}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>{profile.ativo ? 'Ativo' : 'Inativo'}</dd>
                </div>
                <div>
                  <dt>Cliente desde</dt>
                  <dd>{createdAtFormatter.format(new Date(profile.criadoEm))}</dd>
                </div>
                <div>
                  <dt>Pontos de fidelidade</dt>
                  <dd>{profile.pontosFidelidade}</dd>
                </div>
              </dl>
            </aside>

            <form className={styles.formCard} onSubmit={handleSubmit}>
              <header>
                <span>Dados pessoais</span>
                <h2>Editar informações</h2>
                <p>Nome, e-mail e telefone podem ser alterados a qualquer momento.</p>
              </header>

              {successMessage && (
                <p className={styles.successMessage} role="status">
                  {successMessage}
                </p>
              )}
              {submitError && (
                <p className={styles.errorMessage} role="alert">
                  {submitError}
                </p>
              )}

              <div className={styles.fields}>
                <TextField
                  autoComplete="name"
                  error={errors.nome}
                  hint={`Este nome aparece no cabeçalho como “Olá, ${nome.trim().split(' ')[0] || 'seu nome'}”.`}
                  id="perfil-nome"
                  label="Nome completo"
                  maxLength={100}
                  onChange={(event) => setNome(event.target.value)}
                  required
                  value={nome}
                />
                <TextField
                  autoComplete="email"
                  error={errors.email}
                  id="perfil-email"
                  label="E-mail"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
                <TextField
                  autoComplete="tel"
                  error={errors.telefone}
                  hint="Opcional. Use o número pelo qual prefere receber contato."
                  id="perfil-telefone"
                  label="Telefone"
                  maxLength={20}
                  onChange={(event) => setTelefone(event.target.value)}
                  type="tel"
                  value={telefone}
                />
              </div>

              <div className={styles.actions}>
                <Button
                  disabled={isSubmitting}
                  onClick={restoreProfile}
                  type="button"
                  variant="ghost"
                >
                  Descartar alterações
                </Button>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </Container>
    </section>
  )
}
