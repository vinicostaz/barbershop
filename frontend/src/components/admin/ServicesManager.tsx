import { useEffect, useState, type FormEvent } from 'react'
import { adminService, type AdminService } from '../../services/admin'
import { Button } from '../ui/Button/Button'
import { TextareaField, TextField } from '../ui/FormField/FormField'
import styles from './AdminManagement.module.css'

type Props = { token: string }

const emptyForm = { descricao: '', duracaoMin: '30', nome: '', preco: '' }

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    currency: 'BRL',
    style: 'currency',
  }).format(value)
}

export function ServicesManager({ token }: Props) {
  const [services, setServices] = useState<AdminService[]>([])
  const [form, setForm] = useState(emptyForm)
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
      .listServices(controller.signal)
      .then(setServices)
      .catch((requestError: Error) => {
        if (requestError.name !== 'AbortError') setError(requestError.message)
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
    setError('')
  }

  function startEditing(service: AdminService) {
    setEditingId(service.id)
    setForm({
      descricao: service.descricao ?? '',
      duracaoMin: String(service.duracaoMin),
      nome: service.nome,
      preco: String(service.preco),
    })
    setError('')
    setMessage('')
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    const input = {
      descricao: form.descricao.trim(),
      duracaoMin: Number(form.duracaoMin),
      nome: form.nome.trim(),
      preco: Number(form.preco.replace(',', '.')),
    }

    try {
      const saved = editingId
        ? await adminService.updateService(editingId, input, token)
        : await adminService.createService(input, token)

      setServices((current) =>
        editingId
          ? current
              .map((service) => (service.id === saved.id ? saved : service))
              .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
          : [...current, saved].sort((a, b) =>
              a.nome.localeCompare(b.nome, 'pt-BR'),
            ),
      )
      setMessage(editingId ? 'Serviço atualizado.' : 'Serviço cadastrado.')
      setEditingId(null)
      setForm(emptyForm)
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setSaving(false)
    }
  }

  async function remove(service: AdminService) {
    setRemovingId(service.id)
    setError('')
    setMessage('')

    try {
      await adminService.removeService(service.id, token)
      setServices((current) => current.filter(({ id }) => id !== service.id))
      if (editingId === service.id) resetForm()
      setConfirmingId(null)
      setMessage('Serviço removido.')
    } catch (requestError) {
      setError((requestError as Error).message)
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className={styles.managerLayout}>
      <section className={styles.listPanel} aria-labelledby="services-title">
        <div className={styles.panelHeading}>
          <div>
            <span>Catálogo</span>
            <h2 id="services-title">Serviços</h2>
          </div>
          <strong>{services.length}</strong>
        </div>

        {loading ? (
          <p className={styles.dataState}>Carregando serviços...</p>
        ) : services.length === 0 ? (
          <p className={styles.dataState}>Nenhum serviço cadastrado.</p>
        ) : (
          <div className={styles.itemList}>
            {services.map((service) => (
              <article className={styles.itemCard} key={service.id}>
                <div className={styles.itemMain}>
                  <h3>{service.nome}</h3>
                  <p>{service.descricao || 'Sem descrição.'}</p>
                  <div className={styles.metadata}>
                    <span>{service.duracaoMin} min</span>
                    <span>{money(service.preco)}</span>
                  </div>
                </div>
                <div className={styles.itemActions}>
                  {confirmingId === service.id ? (
                    <>
                      <Button size="small" variant="ghost" onClick={() => setConfirmingId(null)}>
                        Cancelar
                      </Button>
                      <button
                        className={styles.confirmDangerAction}
                        disabled={removingId === service.id}
                        onClick={() => remove(service)}
                        type="button"
                      >
                        {removingId === service.id ? 'Removendo...' : 'Confirmar remoção'}
                      </button>
                    </>
                  ) : (
                    <>
                      <Button size="small" variant="ghost" onClick={() => startEditing(service)}>
                        Editar
                      </Button>
                      <button
                        className={styles.dangerAction}
                        onClick={() => setConfirmingId(service.id)}
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

      <aside className={styles.formPanel} id="service-form">
        <div className={styles.formHeading}>
          <span>{editingId ? 'Edição' : 'Novo cadastro'}</span>
          <h2>{editingId ? 'Editar serviço' : 'Adicionar serviço'}</h2>
          <p>Informe os dados exibidos no catálogo e usados nos agendamentos.</p>
        </div>

        {(error || message) && (
          <p className={error ? styles.errorMessage : styles.successMessage} role="status">
            {error || message}
          </p>
        )}

        <form className={styles.form} onSubmit={submit}>
          <TextField
            id="service-name"
            label="Nome"
            maxLength={100}
            onChange={(event) => setForm({ ...form, nome: event.target.value })}
            required
            value={form.nome}
          />
          <TextareaField
            id="service-description"
            label="Descrição"
            maxLength={500}
            onChange={(event) => setForm({ ...form, descricao: event.target.value })}
            value={form.descricao}
          />
          <div className={styles.formRow}>
            <TextField
              id="service-duration"
              label="Duração (min)"
              min="1"
              onChange={(event) => setForm({ ...form, duracaoMin: event.target.value })}
              required
              type="number"
              value={form.duracaoMin}
            />
            <TextField
              id="service-price"
              label="Preço (R$)"
              min="0"
              onChange={(event) => setForm({ ...form, preco: event.target.value })}
              required
              step="0.01"
              type="number"
              value={form.preco}
            />
          </div>
          <div className={styles.formActions}>
            <Button disabled={saving} type="submit">
              {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar serviço'}
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
