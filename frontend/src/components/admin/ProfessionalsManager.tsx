import { useEffect, useState, type FormEvent } from 'react'
import {
  adminService,
  type AdminProfessional,
  type Specialty,
} from '../../services/admin'
import { Button } from '../ui/Button/Button'
import { TextField } from '../ui/FormField/FormField'
import styles from './AdminManagement.module.css'

type Props = { token: string }

const emptyForm = {
  email: '',
  especialidadeIds: [] as string[],
  nome: '',
  senha: '',
  telefone: '',
}

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function ProfessionalsManager({ token }: Props) {
  const [professionals, setProfessionals] = useState<AdminProfessional[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      adminService.listProfessionals(token, controller.signal),
      adminService.listSpecialties(controller.signal),
    ])
      .then(([professionalList, specialtyList]) => {
        setProfessionals(professionalList)
        setSpecialties(specialtyList)
      })
      .catch((requestError: Error) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [token])

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  function startEditing(professional: AdminProfessional) {
    setEditingId(professional.id)
    setForm({
      email: professional.email,
      especialidadeIds: professional.especialidades.map(({ id }) => id),
      nome: professional.nome,
      senha: '',
      telefone: professional.telefone ?? '',
    })
    setError('')
    setMessage('')
  }

  function toggleSpecialty(id: string) {
    setForm((current) => ({
      ...current,
      especialidadeIds: current.especialidadeIds.includes(id)
        ? current.especialidadeIds.filter((specialtyId) => specialtyId !== id)
        : [...current.especialidadeIds, id],
    }))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const saved = editingId
        ? await adminService.updateProfessional(
            editingId,
            {
              especialidadeIds: form.especialidadeIds,
              nome: form.nome.trim(),
              telefone: form.telefone.trim(),
            },
            token,
          )
        : await adminService.createProfessional(
            {
              email: form.email.trim(),
              especialidadeIds: form.especialidadeIds,
              nome: form.nome.trim(),
              senha: form.senha,
              telefone: form.telefone.trim() || undefined,
            },
            token,
          )

      setProfessionals((current) =>
        editingId
          ? current
              .map((professional) =>
                professional.id === saved.id ? saved : professional,
              )
              .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
          : [...current, saved].sort((a, b) =>
              a.nome.localeCompare(b.nome, 'pt-BR'),
            ),
      )
      setMessage(editingId ? 'Profissional atualizado.' : 'Profissional cadastrado.')
      setEditingId(null)
      setForm(emptyForm)
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(professional: AdminProfessional) {
    setTogglingId(professional.id)
    setError('')
    setMessage('')

    try {
      const saved = await adminService.setProfessionalActive(
        professional.id,
        !professional.ativo,
        token,
      )
      setProfessionals((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      )
      setConfirmingId(null)
      setMessage(saved.ativo ? 'Profissional reativado.' : 'Profissional desativado.')
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className={styles.managerLayout}>
      <section className={styles.listPanel} aria-labelledby="professionals-title">
        <div className={styles.panelHeading}>
          <div>
            <span>Equipe</span>
            <h2 id="professionals-title">Profissionais</h2>
          </div>
          <strong>{professionals.filter(({ ativo }) => ativo).length} ativos</strong>
        </div>

        {loading ? (
          <p className={styles.dataState}>Carregando profissionais...</p>
        ) : professionals.length === 0 ? (
          <p className={styles.dataState}>Nenhum profissional cadastrado.</p>
        ) : (
          <div className={styles.itemList}>
            {professionals.map((professional) => (
              <article
                className={`${styles.itemCard} ${!professional.ativo ? styles.inactiveItem : ''}`}
                key={professional.id}
              >
                <span className={styles.avatar} aria-hidden="true">
                  {initials(professional.nome)}
                </span>
                <div className={styles.itemMain}>
                  <div className={styles.nameLine}>
                    <h3>{professional.nome}</h3>
                    <span className={professional.ativo ? styles.activeStatus : styles.inactiveStatus}>
                      {professional.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  <p>{professional.email}</p>
                  <div className={styles.tags}>
                    {professional.especialidades.length > 0 ? (
                      professional.especialidades.map((specialty) => (
                        <span key={specialty.id}>{specialty.nome}</span>
                      ))
                    ) : (
                      <span>Sem especialidade</span>
                    )}
                  </div>
                </div>
                <div className={styles.itemActions}>
                  {confirmingId === professional.id ? (
                    <>
                      <Button size="small" variant="ghost" onClick={() => setConfirmingId(null)}>
                        Cancelar
                      </Button>
                      <button
                        className={professional.ativo ? styles.confirmDangerAction : styles.confirmRestoreAction}
                        disabled={togglingId === professional.id}
                        onClick={() => toggleActive(professional)}
                        type="button"
                      >
                        {togglingId === professional.id
                          ? 'Salvando...'
                          : professional.ativo
                            ? 'Confirmar desativação'
                            : 'Confirmar reativação'}
                      </button>
                    </>
                  ) : (
                    <>
                      <Button size="small" variant="ghost" onClick={() => startEditing(professional)}>
                        Editar
                      </Button>
                      <button
                        className={professional.ativo ? styles.dangerAction : styles.restoreAction}
                        onClick={() => setConfirmingId(professional.id)}
                        type="button"
                      >
                        {professional.ativo ? 'Desativar' : 'Reativar'}
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className={styles.formPanel} id="professional-form">
        <div className={styles.formHeading}>
          <span>{editingId ? 'Edição' : 'Novo cadastro'}</span>
          <h2>{editingId ? 'Editar profissional' : 'Adicionar profissional'}</h2>
          <p>
            {editingId
              ? 'Atualize os dados públicos e as especialidades.'
              : 'Crie o acesso do profissional e organize sua atuação.'}
          </p>
        </div>

        {(error || message) && (
          <p className={error ? styles.errorMessage : styles.successMessage} role="status">
            {error || message}
          </p>
        )}

        <form className={styles.form} onSubmit={submit}>
          <TextField
            autoComplete="name"
            id="professional-name"
            label="Nome"
            maxLength={120}
            onChange={(event) => setForm({ ...form, nome: event.target.value })}
            required
            value={form.nome}
          />
          <TextField
            autoComplete="email"
            disabled={Boolean(editingId)}
            hint={editingId ? 'O e-mail de acesso não pode ser alterado.' : undefined}
            id="professional-email"
            label="E-mail"
            onChange={(event) => setForm({ ...form, email: event.target.value })}
            required
            type="email"
            value={form.email}
          />
          {!editingId && (
            <TextField
              autoComplete="new-password"
              hint="Mínimo de 6 caracteres."
              id="professional-password"
              label="Senha inicial"
              minLength={6}
              onChange={(event) => setForm({ ...form, senha: event.target.value })}
              required
              type="password"
              value={form.senha}
            />
          )}
          <TextField
            autoComplete="tel"
            id="professional-phone"
            label="Telefone"
            onChange={(event) => setForm({ ...form, telefone: event.target.value })}
            type="tel"
            value={form.telefone}
          />

          <fieldset className={styles.checkboxFieldset}>
            <legend>Especialidades</legend>
            {specialties.length === 0 ? (
              <p>Cadastre uma especialidade antes de vinculá-la.</p>
            ) : (
              <div className={styles.checkboxGrid}>
                {specialties.map((specialty) => (
                  <label key={specialty.id}>
                    <input
                      checked={form.especialidadeIds.includes(specialty.id)}
                      onChange={() => toggleSpecialty(specialty.id)}
                      type="checkbox"
                    />
                    <span>{specialty.nome}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>

          <div className={styles.formActions}>
            <Button disabled={saving} type="submit">
              {saving
                ? 'Salvando...'
                : editingId
                  ? 'Salvar alterações'
                  : 'Cadastrar profissional'}
            </Button>
            {editingId && (
              <Button disabled={saving} onClick={resetForm} variant="ghost">
                Cancelar
              </Button>
            )}
          </div>
        </form>
      </aside>
    </div>
  )
}
