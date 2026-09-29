import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { PencilIcon } from '../components/Icons'
import {
  addChecklistItem,
  countByItemAndDay,
  countKey,
  incrementChecklistItem,
  lastDays,
  removeChecklistItem,
  startOfDay,
  startOfNextDay,
  undoChecklistItem,
  updateChecklistItem,
} from '../lib/checklist'
import { db } from '../lib/db'
import { formatClock } from '../lib/time'
import type { ChecklistItem } from '../lib/types'

const HISTORY_DAYS = 7

const WEEKDAY = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })

/** Início do dia de hoje, atualizado sozinho quando vira a meia-noite com o app aberto. */
function useTodayStart(): number {
  const [today, setToday] = useState(() => startOfDay(Date.now()))
  useEffect(() => {
    const timer = setInterval(() => setToday(startOfDay(Date.now())), 30_000)
    return () => clearInterval(timer)
  }, [])
  return today
}

export default function Checklist() {
  const today = useTodayStart()
  const days = lastDays(today, HISTORY_DAYS)
  const historyStart = days[0]
  const tomorrow = startOfNextDay(today)

  const items = useLiveQuery(() => db.checklistItems.orderBy('order').toArray(), [], undefined)
  const logs = useLiveQuery(
    () => db.checklistLogs.where('timestamp').between(historyStart, tomorrow, true, false).toArray(),
    [historyStart, tomorrow],
    [],
  )

  const counts = countByItemAndDay(logs ?? [])
  const lastToday = new Map<number, number>()
  for (const log of logs ?? []) {
    if (log.timestamp >= today && log.timestamp > (lastToday.get(log.itemId) ?? 0)) {
      lastToday.set(log.itemId, log.timestamp)
    }
  }

  const [adding, setAdding] = useState(false)

  return (
    <div>
      <header className="app-header">
        <h1 style={{ fontSize: 22 }}>Checklist</h1>
      </header>
      <div className="page">
        <p className="section-title">Hoje</p>

        {items && items.length === 0 && (
          <p className="empty-state">
            Nenhum item ainda. Adicione ações que você quer acompanhar no dia, como “Beber água” ou “Tomar vitamina”.
          </p>
        )}

        {items && items.length > 0 && (
          <div className="card">
            {items.map((item) => (
              <ChecklistRow
                key={item.id}
                item={item}
                count={counts.get(countKey(item.id!, today)) ?? 0}
                lastAt={lastToday.get(item.id!)}
              />
            ))}
          </div>
        )}

        {adding ? (
          <div className="card" style={{ marginTop: 12 }}>
            <p style={{ fontWeight: 700, marginBottom: 12 }}>Novo item</p>
            <ItemForm
              idPrefix="checklist-new"
              submitLabel="Adicionar"
              onCancel={() => setAdding(false)}
              onSubmit={async (fields) => {
                await addChecklistItem(db, fields)
                setAdding(false)
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-outline"
            style={{ width: '100%', marginTop: 12 }}
            onClick={() => setAdding(true)}
          >
            + Novo item
          </button>
        )}

        {items && items.length > 0 && (
          <>
            <p className="section-title">Últimos {HISTORY_DAYS} dias</p>
            <div className="card" style={{ overflowX: 'auto' }}>
              <table className="checklist-history">
                <thead>
                  <tr>
                    <th />
                    {days.map((day) => (
                      <th key={day}>{day === today ? 'Hoje' : WEEKDAY.format(day).replace('.', '')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="checklist-history-title">{item.title}</td>
                      {days.map((day) => {
                        const count = counts.get(countKey(item.id!, day)) ?? 0
                        const className = count === 0 ? 'zero' : item.goal && count >= item.goal ? 'done' : undefined
                        return (
                          <td key={day} className={className}>
                            {count}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

type ItemFormValues = { title: string; goal: string; note: string }

/** Campos de um item (título, meta diária opcional, observação opcional), para criar ou editar. */
function ItemForm({
  idPrefix,
  initial = { title: '', goal: '', note: '' },
  submitLabel,
  onSubmit,
  onCancel,
  children,
}: {
  idPrefix: string
  initial?: ItemFormValues
  submitLabel: string
  onSubmit: (values: ItemFormValues) => Promise<void>
  onCancel: () => void
  children?: React.ReactNode
}) {
  const [values, setValues] = useState(initial)
  const set = (field: keyof ItemFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!values.title.trim()) return
    await onSubmit(values)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label htmlFor={`${idPrefix}-title`}>Título</label>
        <input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={set('title')}
          placeholder="Ex.: Beber água"
          autoFocus
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-goal`}>Meta por dia (opcional)</label>
        <input
          id={`${idPrefix}-goal`}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={values.goal}
          onChange={set('goal')}
          placeholder="Quantas vezes por dia?"
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-note`}>Observação (opcional)</label>
        <textarea
          id={`${idPrefix}-note`}
          rows={2}
          value={values.note}
          onChange={set('note')}
          placeholder="Descrição ou lembrete"
        />
      </div>
      <div className="edit-row-buttons">
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={!values.title.trim()}>
          {submitLabel}
        </button>
      </div>
      {children}
    </form>
  )
}

function ChecklistRow({ item, count, lastAt }: { item: ChecklistItem; count: number; lastAt?: number }) {
  const [editing, setEditing] = useState(false)

  async function remove() {
    if (item.id == null) return
    const confirmed = window.confirm(`Remover “${item.title}” e todo o histórico dele?`)
    if (!confirmed) return
    await removeChecklistItem(db, item.id)
  }

  if (editing) {
    return (
      <div className="edit-row">
        <ItemForm
          idPrefix={`checklist-${item.id}`}
          initial={{ title: item.title, goal: item.goal ? String(item.goal) : '', note: item.note ?? '' }}
          submitLabel="Salvar"
          onCancel={() => setEditing(false)}
          onSubmit={async (fields) => {
            if (item.id != null) await updateChecklistItem(db, item.id, fields)
            setEditing(false)
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            style={{ color: 'var(--danger)', padding: '9px 12px', fontSize: 13 }}
            onClick={remove}
          >
            Remover item
          </button>
        </ItemForm>
      </div>
    )
  }

  const goalMet = item.goal != null && count >= item.goal
  let status = lastAt ? `Última às ${formatClock(lastAt)}` : 'Nenhuma vez hoje'
  if (item.goal && !goalMet) status = `Faltam ${item.goal - count} · ${status.toLowerCase()}`

  return (
    <div className="list-item" style={{ gap: 10 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <p style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.title}</p>
          <button type="button" className="icon-btn" onClick={() => setEditing(true)} aria-label={`Editar ${item.title}`}>
            <PencilIcon />
          </button>
        </div>
        {item.note && <p className="checklist-note">{item.note}</p>}
        <p style={{ fontSize: 12, color: goalMet ? 'var(--success)' : 'var(--text-muted)', fontWeight: goalMet ? 600 : 400 }}>
          {goalMet ? 'Meta do dia cumprida ✓' : status}
        </p>
      </div>
      <div className="counter">
        <button
          type="button"
          className="counter-btn"
          onClick={() => item.id != null && undoChecklistItem(db, item.id)}
          disabled={count === 0}
          aria-label={`Desfazer último de ${item.title}`}
        >
          −
        </button>
        <span className="counter-value" aria-live="polite" style={goalMet ? { color: 'var(--success)' } : undefined}>
          {count}
          {item.goal != null && <span className="counter-goal">/{item.goal}</span>}
        </span>
        <button
          type="button"
          className="counter-btn counter-btn-plus"
          onClick={() => item.id != null && incrementChecklistItem(db, item.id)}
          aria-label={`Marcar ${item.title}`}
        >
          +
        </button>
      </div>
    </div>
  )
}
