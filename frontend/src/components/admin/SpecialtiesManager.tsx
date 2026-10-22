import { useEffect, useState, type FormEvent } from 'react'
import { adminService, type Specialty } from '../../services/admin'
import { Button } from '../ui/Button/Button'
import { TextField } from '../ui/FormField/FormField'
import styles from './AdminManagement.module.css'

type Props = { token: string }

export function SpecialtiesManager({ token }: Props) {
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    adminService
      .listSpecialties(controller.signal)
      .then(setSpecialties)
      .catch((requestError: Error) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  function resetForm() {
    setEditingId(null)
    setName('')
    setError('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const saved = editingId
        ? await adminService.updateSpecialty(editingId, name.trim(), token)
        : await adminService.createSpecialty(name.trim(), token)

      setSpecialties((current) =>
        editingId
          ? current
              .map((specialty) => (specialty.id === saved.id ? saved : specialty))
              .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
          : [...current, saved].sort((a, b) =>
              a.nome.localeCompare(b.nome, 'pt-BR'),
            ),
      )
      setMessage(editingId ? 'Especialidade atualizada.' : 'Especialidade cadastrada.')
      setEditingId(null)
      setName('')
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setSaving(false)
    }
  }

  function startEditing(specialty: Specialty) {
    setEditingId(specialty.id)
    setName(specialty.nome)
    setError('')
    setMessage('')
  }

  async function remove(specialty: Specialty) {
    setRemovingId(specialty.id)
    setError('')
    setMessage('')

    try {
      await adminService.removeSpecialty(specialty.id, token)
      setSpecialties((current) => current.filter(({ id }) => id !== specialty.id))
      if (editingId === specialty.id) resetForm()
      setConfirmingId(null)
      setMessage('Especialidade removida.')
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className={styles.managerLayout}>
      <section className={styles.listPanel} aria-labelledby="specialties-title">
        <div className={styles.panelHeading}>
          <div>
            <span>Equipe</span>
            <h2 id="specialties-title">Especialidades</h2>
          </div>
          <strong>{specialties.length}</strong>
        </div>

        {loading ? (
          <p className={styles.dataState}>Carregando especialidades...</p>
        ) : specialties.length === 0 ? (
          <p className={styles.dataState}>Nenhuma especialidade cadastrada.</p>
        ) : (
          <div className={styles.compactList}>
            {specialties.map((specialty) => (
              <article className={styles.compactItem} key={specialty.id}>
                <div>
                  <span className={styles.specialtyMark} aria-hidden="true" />
                  <strong>{specialty.nome}</strong>
                </div>
                <div className={styles.itemActions}>
                  {confirmingId === specialty.id ? (
                    <>
                      <Button size="small" variant="ghost" onClick={() => setConfirmingId(null)}>
                        Cancelar
                      </Button>
                      <button
                        className={styles.confirmDangerAction}
                        disabled={removingId === specialty.id}
                        onClick={() => remove(specialty)}
                        type="button"
                      >
                        {removingId === specialty.id ? 'Removendo...' : 'Confirmar remoção'}
                      </button>
                    </>
                  ) : (
                    <>
                      <Button size="small" variant="ghost" onClick={() => startEditing(specialty)}>
                        Editar
                      </Button>
                      <button
                        className={styles.dangerAction}
                        onClick={() => setConfirmingId(specialty.id)}
                        type="button"
                      >
                        Remover
                      </button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <aside className={styles.formPanel}>
        <div className={styles.formHeading}>
          <span>{editingId ? 'Edição' : 'Novo cadastro'}</span>
          <h2>{editingId ? 'Editar especialidade' : 'Adicionar especialidade'}</h2>
          <p>As especialidades poderão ser vinculadas aos profissionais.</p>
        </div>

        {(error || message) && (
          <p className={error ? styles.errorMessage : styles.successMessage} role="status">
            {error || message}
          </p>
        )}

        <form className={styles.form} onSubmit={submit}>
          <TextField
            autoComplete="off"
            id="specialty-name"
            label="Nome"
            maxLength={100}
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
          <div className={styles.formActions}>
            <Button disabled={saving} type="submit">
              {saving
                ? 'Salvando...'
                : editingId
                  ? 'Salvar alterações'
                  : 'Cadastrar especialidade'}
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
