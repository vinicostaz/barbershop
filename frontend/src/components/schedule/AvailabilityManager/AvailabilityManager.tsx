import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { adminService, type AdminProfessional } from '../../../services/admin'
import {
  availabilityService,
  type Availability,
  type ScheduleBlock,
} from '../../../services/availability'
import { Button } from '../../ui/Button/Button'
import {
  SelectField,
  TextareaField,
  TextField,
} from '../../ui/FormField/FormField'
import styles from './AvailabilityManager.module.css'

type ManagementMode = 'availability' | 'blocks'

type Props = {
  currentUserId: string
  isAdministrator: boolean
  token: string
}

const weekdays = [
  { id: 0, label: 'Domingo', shortLabel: 'Dom' },
  { id: 1, label: 'Segunda-feira', shortLabel: 'Seg' },
  { id: 2, label: 'Terça-feira', shortLabel: 'Ter' },
  { id: 3, label: 'Quarta-feira', shortLabel: 'Qua' },
  { id: 4, label: 'Quinta-feira', shortLabel: 'Qui' },
  { id: 5, label: 'Sexta-feira', shortLabel: 'Sex' },
  { id: 6, label: 'Sábado', shortLabel: 'Sáb' },
]

const emptyAvailabilityForm = {
  diaSemana: '1',
  horaFim: '18:00',
  horaInicio: '09:00',
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function createEmptyBlockForm() {
  const today = localDateKey()
  return {
    dataFim: today,
    dataInicio: today,
    diaInteiro: true,
    horaFim: '18:00',
    horaInicio: '09:00',
    motivo: '',
  }
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: 'short',
  timeZone: 'UTC',
  year: 'numeric',
})

function sortAvailability(items: Availability[]) {
  return [...items].sort(
    (first, second) =>
      first.diaSemana - second.diaSemana ||
      first.horaInicio.localeCompare(second.horaInicio),
  )
}

function sortBlocks(items: ScheduleBlock[]) {
  return [...items].sort(
    (first, second) =>
      new Date(first.inicio).getTime() - new Date(second.inicio).getTime(),
  )
}

function blockPeriod(block: ScheduleBlock) {
  const start = new Date(block.inicio)
  const end = new Date(block.fim)
  const isFullDay =
    start.getUTCHours() === 0 &&
    start.getUTCMinutes() === 0 &&
    end.getUTCHours() === 0 &&
    end.getUTCMinutes() === 0

  if (!isFullDay) {
    return `${dateTimeFormatter.format(start)} — ${dateTimeFormatter.format(end)}`
  }

  const inclusiveEnd = new Date(end.getTime() - 24 * 60 * 60 * 1000)
  const sameDay = start.toISOString().slice(0, 10) === inclusiveEnd.toISOString().slice(0, 10)

  return sameDay
    ? `${dateFormatter.format(start)} · dia inteiro`
    : `${dateFormatter.format(start)} — ${dateFormatter.format(inclusiveEnd)} · dias inteiros`
}

export function AvailabilityManager({
  currentUserId,
  isAdministrator,
  token,
}: Props) {
  const [mode, setMode] = useState<ManagementMode>('availability')
  const [professionals, setProfessionals] = useState<AdminProfessional[]>([])
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(
    isAdministrator ? '' : currentUserId,
  )
  const [availability, setAvailability] = useState<Availability[]>([])
  const [blocks, setBlocks] = useState<ScheduleBlock[]>([])
  const [availabilityForm, setAvailabilityForm] = useState(
    emptyAvailabilityForm,
  )
  const [blockForm, setBlockForm] = useState(createEmptyBlockForm)
  const [editingAvailabilityId, setEditingAvailabilityId] = useState<
    string | null
  >(null)
  const [confirmingAvailabilityId, setConfirmingAvailabilityId] = useState<
    string | null
  >(null)
  const [confirmingBlockId, setConfirmingBlockId] = useState<string | null>(null)
  const [isLoadingProfessionals, setIsLoadingProfessionals] = useState(
    isAdministrator,
  )
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(!isAdministrator)
  const [isSaving, setIsSaving] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [loadError, setLoadError] = useState('')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!isAdministrator) return

    const controller = new AbortController()

    adminService
      .listProfessionals(token, controller.signal)
      .then((items) => {
        const activeProfessionals = items.filter((professional) => professional.ativo)
        setProfessionals(activeProfessionals)
        setIsLoadingSchedule(activeProfessionals.length > 0)
        setSelectedProfessionalId((current) => current || activeProfessionals[0]?.id || '')
      })
      .catch((requestError: Error) => {
        if (requestError.name !== 'AbortError') setLoadError(requestError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingProfessionals(false)
      })

    return () => controller.abort()
  }, [isAdministrator, reloadKey, token])

  useEffect(() => {
    if (!selectedProfessionalId) return

    const controller = new AbortController()

    Promise.all([
      availabilityService.listAvailability(
        selectedProfessionalId,
        controller.signal,
      ),
      availabilityService.listBlocks(
        selectedProfessionalId,
        token,
        controller.signal,
      ),
    ])
      .then(([availabilityResult, blocksResult]) => {
        setAvailability(sortAvailability(availabilityResult))
        setBlocks(sortBlocks(blocksResult))
      })
      .catch((requestError: Error) => {
        if (requestError.name !== 'AbortError') setLoadError(requestError.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingSchedule(false)
      })

    return () => controller.abort()
  }, [reloadKey, selectedProfessionalId, token])

  const selectedProfessional = professionals.find(
    (professional) => professional.id === selectedProfessionalId,
  )

  const availabilityByWeekday = useMemo(
    () =>
      weekdays.map((weekday) => ({
        ...weekday,
        intervals: availability.filter(
          (item) => item.diaSemana === weekday.id,
        ),
      })),
    [availability],
  )

  function clearFeedback() {
    setActionError('')
    setMessage('')
  }

  function resetAvailabilityForm() {
    setEditingAvailabilityId(null)
    setAvailabilityForm(emptyAvailabilityForm)
    clearFeedback()
  }

  function editAvailability(item: Availability) {
    setEditingAvailabilityId(item.id)
    setAvailabilityForm({
      diaSemana: String(item.diaSemana),
      horaFim: item.horaFim,
      horaInicio: item.horaInicio,
    })
    clearFeedback()
  }

  async function submitAvailability(event: FormEvent) {
    event.preventDefault()
    if (!selectedProfessionalId) return

    clearFeedback()
    if (availabilityForm.horaInicio >= availabilityForm.horaFim) {
      setActionError('O horário final deve ser posterior ao horário inicial.')
      return
    }

    setIsSaving(true)
    const input = {
      diaSemana: Number(availabilityForm.diaSemana),
      horaFim: availabilityForm.horaFim,
      horaInicio: availabilityForm.horaInicio,
    }

    try {
      const saved = editingAvailabilityId
        ? await availabilityService.updateAvailability(
            editingAvailabilityId,
            input,
            token,
          )
        : await availabilityService.createAvailability(
            selectedProfessionalId,
            input,
            token,
          )

      setAvailability((current) =>
        sortAvailability(
          editingAvailabilityId
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved],
        ),
      )
      setEditingAvailabilityId(null)
      setAvailabilityForm(emptyAvailabilityForm)
      setMessage(
        editingAvailabilityId
          ? 'Disponibilidade atualizada.'
          : 'Disponibilidade adicionada.',
      )
    } catch (requestError) {
      setActionError((requestError as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  async function removeAvailability(item: Availability) {
    setRemovingId(item.id)
    clearFeedback()

    try {
      await availabilityService.removeAvailability(item.id, token)
      setAvailability((current) =>
        current.filter((availabilityItem) => availabilityItem.id !== item.id),
      )
      if (editingAvailabilityId === item.id) resetAvailabilityForm()
      setConfirmingAvailabilityId(null)
      setMessage('Disponibilidade removida.')
    } catch (requestError) {
      setActionError((requestError as Error).message)
    } finally {
      setRemovingId(null)
    }
  }

  async function submitBlock(event: FormEvent) {
    event.preventDefault()
    if (!selectedProfessionalId) return

    clearFeedback()
    const inicio = blockForm.diaInteiro
      ? blockForm.dataInicio
      : `${blockForm.dataInicio}T${blockForm.horaInicio}`
    const fim = blockForm.diaInteiro
      ? blockForm.dataFim
      : `${blockForm.dataFim}T${blockForm.horaFim}`

    if (fim < inicio || (!blockForm.diaInteiro && fim === inicio)) {
      setActionError('O fim do bloqueio deve ser posterior ao início.')
      return
    }

    setIsSaving(true)

    try {
      const saved = await availabilityService.createBlock(
        selectedProfessionalId,
        {
          fim,
          inicio,
          motivo: blockForm.motivo.trim() || undefined,
        },
        token,
      )
      setBlocks((current) => sortBlocks([...current, saved]))
      setBlockForm(createEmptyBlockForm())
      setMessage('Período bloqueado.')
    } catch (requestError) {
      setActionError((requestError as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  async function removeBlock(block: ScheduleBlock) {
    setRemovingId(block.id)
    clearFeedback()

    try {
      await availabilityService.removeBlock(block.id, token)
      setBlocks((current) => current.filter((item) => item.id !== block.id))
      setConfirmingBlockId(null)
      setMessage('Bloqueio removido.')
    } catch (requestError) {
      setActionError((requestError as Error).message)
    } finally {
      setRemovingId(null)
    }
  }

  const isLoading = isLoadingProfessionals || isLoadingSchedule
  const professionalLabel = isAdministrator
    ? selectedProfessional?.nome ?? 'profissional selecionado'
    : 'sua agenda'

  return (
    <section className={styles.manager} aria-labelledby="availability-title">
      <header className={styles.managerHeader}>
        <div>
          <span>Organização da agenda</span>
          <h2 id="availability-title">Disponibilidade e bloqueios</h2>
          <p>
            Defina a rotina semanal e registre folgas, pausas ou compromissos
            específicos.
          </p>
        </div>

        {isAdministrator && (
          <label className={styles.professionalPicker}>
            <span>Profissional</span>
            <select
              disabled={isLoadingProfessionals || professionals.length === 0}
              onChange={(event) => {
                setIsLoadingSchedule(true)
                setLoadError('')
                setSelectedProfessionalId(event.target.value)
                resetAvailabilityForm()
                setBlockForm(createEmptyBlockForm())
              }}
              value={selectedProfessionalId}
            >
              {professionals.length === 0 && <option value="">Nenhum ativo</option>}
              {professionals.map((professional) => (
                <option key={professional.id} value={professional.id}>
                  {professional.nome}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      <div className={styles.modeSwitch} aria-label="Área de gerenciamento">
        <button
          aria-pressed={mode === 'availability'}
          className={mode === 'availability' ? styles.activeMode : ''}
          onClick={() => {
            setMode('availability')
            clearFeedback()
          }}
          type="button"
        >
          Horários semanais
        </button>
        <button
          aria-pressed={mode === 'blocks'}
          className={mode === 'blocks' ? styles.activeMode : ''}
          onClick={() => {
            setMode('blocks')
            clearFeedback()
          }}
          type="button"
        >
          Bloqueios
        </button>
      </div>

      {loadError && (
        <div className={styles.loadState} role="alert">
          <strong>Não foi possível carregar os horários</strong>
          <p>{loadError}</p>
          <Button
            onClick={() => {
              setIsLoadingSchedule(true)
              if (isAdministrator) setIsLoadingProfessionals(true)
              setLoadError('')
              setReloadKey((key) => key + 1)
            }}
            size="small"
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {!loadError && isLoading && (
        <div className={styles.loadState} role="status">
          <span className={styles.loader} aria-hidden="true" />
          <p>Carregando disponibilidade...</p>
        </div>
      )}

      {!loadError && !isLoading && !selectedProfessionalId && (
        <div className={styles.loadState} role="status">
          <strong>Nenhum profissional ativo</strong>
          <p>Cadastre ou ative um profissional para configurar sua agenda.</p>
        </div>
      )}

      {!loadError && !isLoading && selectedProfessionalId && (
        <div className={styles.workspace}>
          <div className={styles.listPanel}>
            <div className={styles.panelHeading}>
              <div>
                <span>{mode === 'availability' ? 'Rotina' : 'Exceções'}</span>
                <h3>
                  {mode === 'availability' ? 'Semana de atendimento' : 'Períodos bloqueados'}
                </h3>
                <p>Configuração de {professionalLabel}.</p>
              </div>
              <strong>{mode === 'availability' ? availability.length : blocks.length}</strong>
            </div>

            {mode === 'availability' ? (
              <div className={styles.weekList}>
                {availabilityByWeekday.map((weekday) => (
                  <section className={styles.weekdayRow} key={weekday.id}>
                    <div className={styles.weekdayName}>
                      <span>{weekday.shortLabel}</span>
                      <strong>{weekday.label}</strong>
                    </div>
                    <div className={styles.intervalList}>
                      {weekday.intervals.length === 0 ? (
                        <p>Sem atendimento</p>
                      ) : (
                        weekday.intervals.map((item) => (
                          <article className={styles.intervalCard} key={item.id}>
                            <strong>
                              {item.horaInicio} — {item.horaFim}
                            </strong>
                            <div className={styles.itemActions}>
                              {confirmingAvailabilityId === item.id ? (
                                <>
                                  <button
                                    className={styles.cancelAction}
                                    onClick={() => setConfirmingAvailabilityId(null)}
                                    type="button"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    className={styles.confirmDangerAction}
                                    disabled={removingId === item.id}
                                    onClick={() => removeAvailability(item)}
                                    type="button"
                                  >
                                    {removingId === item.id ? 'Removendo...' : 'Confirmar'}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className={styles.editAction}
                                    onClick={() => editAvailability(item)}
                                    type="button"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    className={styles.dangerAction}
                                    onClick={() => setConfirmingAvailabilityId(item.id)}
                                    type="button"
                                  >
                                    Remover
                                  </button>
                                </>
                              )}
                            </div>
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                ))}
              </div>
            ) : blocks.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>Nenhum período bloqueado</strong>
                <p>Folgas, pausas e compromissos aparecerão aqui.</p>
              </div>
            ) : (
              <div className={styles.blockList}>
                {blocks.map((block) => (
                  <article className={styles.blockCard} key={block.id}>
                    <div>
                      <span>{blockPeriod(block)}</span>
                      <h4>{block.motivo?.trim() || 'Sem motivo informado'}</h4>
                    </div>
                    <div className={styles.itemActions}>
                      {confirmingBlockId === block.id ? (
                        <>
                          <button
                            className={styles.cancelAction}
                            onClick={() => setConfirmingBlockId(null)}
                            type="button"
                          >
                            Cancelar
                          </button>
                          <button
                            className={styles.confirmDangerAction}
                            disabled={removingId === block.id}
                            onClick={() => removeBlock(block)}
                            type="button"
                          >
                            {removingId === block.id ? 'Removendo...' : 'Confirmar'}
                          </button>
                        </>
                      ) : (
                        <button
                          className={styles.dangerAction}
                          onClick={() => setConfirmingBlockId(block.id)}
                          type="button"
                        >
                          Remover
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className={styles.formPanel}>
            {(actionError || message) && (
              <p
                className={actionError ? styles.errorMessage : styles.successMessage}
                role="status"
              >
                {actionError || message}
              </p>
            )}

            {mode === 'availability' ? (
              <>
                <div className={styles.formHeading}>
                  <span>{editingAvailabilityId ? 'Edição' : 'Novo horário'}</span>
                  <h3>
                    {editingAvailabilityId
                      ? 'Editar disponibilidade'
                      : 'Adicionar disponibilidade'}
                  </h3>
                  <p>É possível cadastrar mais de um intervalo no mesmo dia.</p>
                </div>

                <form className={styles.form} onSubmit={submitAvailability}>
                  <SelectField
                    id="availability-weekday"
                    label="Dia da semana"
                    onChange={(event) =>
                      setAvailabilityForm({
                        ...availabilityForm,
                        diaSemana: event.target.value,
                      })
                    }
                    required
                    value={availabilityForm.diaSemana}
                  >
                    {weekdays.map((weekday) => (
                      <option key={weekday.id} value={weekday.id}>
                        {weekday.label}
                      </option>
                    ))}
                  </SelectField>
                  <div className={styles.formRow}>
                    <TextField
                      id="availability-start"
                      label="Início"
                      onChange={(event) =>
                        setAvailabilityForm({
                          ...availabilityForm,
                          horaInicio: event.target.value,
                        })
                      }
                      required
                      type="time"
                      value={availabilityForm.horaInicio}
                    />
                    <TextField
                      id="availability-end"
                      label="Término"
                      onChange={(event) =>
                        setAvailabilityForm({
                          ...availabilityForm,
                          horaFim: event.target.value,
                        })
                      }
                      required
                      type="time"
                      value={availabilityForm.horaFim}
                    />
                  </div>
                  <div className={styles.formActions}>
                    <Button disabled={isSaving} type="submit">
                      {isSaving
                        ? 'Salvando...'
                        : editingAvailabilityId
                          ? 'Salvar alterações'
                          : 'Adicionar horário'}
                    </Button>
                    {editingAvailabilityId && (
                      <Button
                        disabled={isSaving}
                        onClick={resetAvailabilityForm}
                        variant="ghost"
                      >
                        Cancelar
                      </Button>
                    )}
                  </div>
                </form>
              </>
            ) : (
              <>
                <div className={styles.formHeading}>
                  <span>Novo bloqueio</span>
                  <h3>Bloquear período</h3>
                  <p>Agendamentos confirmados precisam ser tratados antes do bloqueio.</p>
                </div>

                <form className={styles.form} onSubmit={submitBlock}>
                  <label className={styles.checkboxField}>
                    <input
                      checked={blockForm.diaInteiro}
                      onChange={(event) =>
                        setBlockForm({
                          ...blockForm,
                          diaInteiro: event.target.checked,
                        })
                      }
                      type="checkbox"
                    />
                    <span>Bloquear dia inteiro</span>
                  </label>
                  <div className={styles.formRow}>
                    <TextField
                      id="block-start-date"
                      label="Data inicial"
                      min={localDateKey()}
                      onChange={(event) =>
                        setBlockForm({
                          ...blockForm,
                          dataInicio: event.target.value,
                          dataFim:
                            event.target.value > blockForm.dataFim
                              ? event.target.value
                              : blockForm.dataFim,
                        })
                      }
                      required
                      type="date"
                      value={blockForm.dataInicio}
                    />
                    <TextField
                      id="block-end-date"
                      label="Data final"
                      min={blockForm.dataInicio}
                      onChange={(event) =>
                        setBlockForm({ ...blockForm, dataFim: event.target.value })
                      }
                      required
                      type="date"
                      value={blockForm.dataFim}
                    />
                  </div>
                  {!blockForm.diaInteiro && (
                    <div className={styles.formRow}>
                      <TextField
                        id="block-start-time"
                        label="Horário inicial"
                        onChange={(event) =>
                          setBlockForm({
                            ...blockForm,
                            horaInicio: event.target.value,
                          })
                        }
                        required
                        type="time"
                        value={blockForm.horaInicio}
                      />
                      <TextField
                        id="block-end-time"
                        label="Horário final"
                        onChange={(event) =>
                          setBlockForm({ ...blockForm, horaFim: event.target.value })
                        }
                        required
                        type="time"
                        value={blockForm.horaFim}
                      />
                    </div>
                  )}
                  <TextareaField
                    id="block-reason"
                    label="Motivo"
                    maxLength={200}
                    onChange={(event) =>
                      setBlockForm({ ...blockForm, motivo: event.target.value })
                    }
                    placeholder="Ex.: folga, almoço ou compromisso"
                    value={blockForm.motivo}
                  />
                  <div className={styles.formActions}>
                    <Button disabled={isSaving} type="submit">
                      {isSaving ? 'Salvando...' : 'Criar bloqueio'}
                    </Button>
                  </div>
                </form>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  )
}
