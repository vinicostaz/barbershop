import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { getRoleHomePath } from '../../auth/roleRoutes'
import { useAuth } from '../../auth/useAuth'
import { Badge } from '../../components/ui/Badge/Badge'
import { Button } from '../../components/ui/Button/Button'
import { Container } from '../../components/ui/Container/Container'
import { TextField } from '../../components/ui/FormField/FormField'
import { ApiError } from '../../services/api'
import styles from './AuthPage.module.css'

type AuthMode = 'login' | 'register'

type AuthPageProps = {
  mode: AuthMode
}

type AuthLocationState = {
  requestedPath?: string
}

type FormErrors = Partial<
  Record<'nome' | 'email' | 'senha' | 'confirmacaoSenha', string>
>

const REQUIRED_FIELD_MESSAGE = 'Preencha o campo obrigatório.'
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateForm({
  confirmacaoSenha,
  email,
  isLogin,
  nome,
  senha,
}: {
  confirmacaoSenha: string
  email: string
  isLogin: boolean
  nome: string
  senha: string
}) {
  const errors: FormErrors = {}

  if (!isLogin) {
    if (!nome.trim()) errors.nome = REQUIRED_FIELD_MESSAGE
    else if (nome.trim().length < 2) {
      errors.nome = 'O nome deve ter mais de 1 caractere.'
    }
  }

  if (!email.trim()) errors.email = REQUIRED_FIELD_MESSAGE
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'E-mail inválido.'

  if (!senha) errors.senha = REQUIRED_FIELD_MESSAGE
  else if (senha.length < 6) errors.senha = 'Digite no mínimo 6 caracteres.'

  if (!isLogin) {
    if (!confirmacaoSenha) errors.confirmacaoSenha = REQUIRED_FIELD_MESSAGE
    else if (senha !== confirmacaoSenha) {
      errors.confirmacaoSenha = 'As senhas não coincidem.'
    }
  }

  return errors
}

function getErrorMessage(error: unknown, isLogin: boolean) {
  if (isLogin && error instanceof ApiError && error.status === 401) {
    return 'E-mail ou senha inválidos.'
  }

  return isLogin
    ? 'Não foi possível entrar. Tente novamente.'
    : 'Não foi possível criar a conta. Tente novamente.'
}

export function AuthPage({ mode }: AuthPageProps) {
  const isLogin = mode === 'login'
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, login, register, session } = useAuth()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacaoSenha, setConfirmacaoSenha] = useState('')
  const [formError, setFormError] = useState('')
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const locationState = location.state as AuthLocationState | null
  const requestedPath =
    typeof locationState?.requestedPath === 'string' &&
    locationState.requestedPath.startsWith('/') &&
    !locationState.requestedPath.startsWith('//')
      ? locationState.requestedPath
      : null

  const formErrors = hasSubmitted
    ? validateForm({ confirmacaoSenha, email, isLogin, nome, senha })
    : {}

  if (isAuthenticated && session) {
    return (
      <Navigate
        replace
        to={requestedPath ?? getRoleHomePath(session.usuario.role)}
      />
    )
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError('')
    setHasSubmitted(true)

    const errors = validateForm({
      confirmacaoSenha,
      email,
      isLogin,
      nome,
      senha,
    })

    if (Object.keys(errors).length > 0) return

    setIsSubmitting(true)

    try {
      if (isLogin) {
        const nextSession = await login({ email: email.trim(), senha })
        navigate(
          requestedPath ?? getRoleHomePath(nextSession.usuario.role),
          { replace: true },
        )
      } else {
        const nextSession = await register({
          email: email.trim(),
          nome: nome.trim(),
          senha,
          telefone: telefone.trim() || undefined,
        })
        navigate(
          requestedPath ?? getRoleHomePath(nextSession.usuario.role),
          { replace: true },
        )
      }
    } catch (error) {
      setFormError(getErrorMessage(error, isLogin))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={styles.page} aria-labelledby="titulo-autenticacao">
      <Container className={styles.layout}>
        <div className={styles.introduction}>
          <Badge tone="brown">Área do cliente</Badge>
          <h1 id="titulo-autenticacao">
            {isLogin
              ? 'Seu próximo atendimento começa aqui.'
              : 'Crie sua conta e cuide do seu próximo horário.'}
          </h1>
          <p>
            {isLogin
              ? 'Entre para organizar seus agendamentos e acompanhar seus atendimentos em um só lugar.'
              : 'Cadastre-se para escolher serviços, profissionais e horários com mais praticidade.'}
          </p>

          {isLogin && (
            <div className={styles.registerCallout}>
              <span>Ainda não possui cadastro?</span>
              <Link state={location.state} to="/cadastro">
                Criar conta
              </Link>
            </div>
          )}

          <ul className={styles.benefits}>
            <li>Agendamento organizado</li>
            <li>Acesso seguro à sua conta</li>
            <li>Experiência simples e responsiva</li>
          </ul>
        </div>

        <div className={styles.card}>
          <header className={styles.cardHeader}>
            <span className={styles.eyebrow}>
              {isLogin ? 'Boas-vindas' : 'Novo cadastro'}
            </span>
            <h2>{isLogin ? 'Entrar na sua conta' : 'Criar sua conta'}</h2>
            {!isLogin && (
              <p>
                Já possui uma conta?{' '}
                <Link state={location.state} to="/login">
                  Entrar
                </Link>
              </p>
            )}
          </header>

          <form className={styles.form} noValidate onSubmit={handleSubmit}>
            {!isLogin && (
              <TextField
                autoComplete="name"
                error={formErrors.nome}
                id="nome"
                label="Nome completo"
                onChange={(event) => setNome(event.target.value)}
                placeholder="Como podemos chamar você?"
                required
                value={nome}
              />
            )}

            <TextField
              autoComplete="email"
              error={formErrors.email}
              id="email"
              label="E-mail"
              onChange={(event) => {
                setEmail(event.target.value)
                setFormError('')
              }}
              placeholder="voce@exemplo.com"
              required
              type="email"
              value={email}
            />

            {!isLogin && (
              <TextField
                autoComplete="tel"
                hint="Opcional"
                id="telefone"
                inputMode="tel"
                label="Telefone"
                onChange={(event) => setTelefone(event.target.value)}
                placeholder="(85) 99999-9999"
                value={telefone}
              />
            )}

            <TextField
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              error={formErrors.senha}
              id="senha"
              label="Senha"
              onChange={(event) => {
                setSenha(event.target.value)
                setFormError('')
              }}
              placeholder="Digite sua senha"
              required
              type="password"
              value={senha}
            />

            {!isLogin && (
              <TextField
                autoComplete="new-password"
                error={formErrors.confirmacaoSenha}
                id="confirmacao-senha"
                label="Confirmar senha"
                onChange={(event) => setConfirmacaoSenha(event.target.value)}
                placeholder="Digite a senha novamente"
                required
                type="password"
                value={confirmacaoSenha}
              />
            )}

            {formError && (
              <div className={styles.alert} role="alert">
                {formError}
              </div>
            )}

            <Button className={styles.submit} disabled={isSubmitting} type="submit">
              {isSubmitting
                ? 'Aguarde...'
                : isLogin
                  ? 'Entrar'
                  : 'Criar conta'}
            </Button>
          </form>

          <p className={styles.securityNote}>
            Seus dados são utilizados somente para o acesso e a organização dos
            atendimentos.
          </p>
        </div>
      </Container>
    </section>
  )
}
