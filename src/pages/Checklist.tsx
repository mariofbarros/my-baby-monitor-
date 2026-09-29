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
  renameChecklistItem,
  startOfDay,
  startOfNextDay,
  undoChecklistItem,
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

  const [newTitle, setNewTitle] = useState('')

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    await addChecklistItem(db, newTitle)
    setNewTitle('')
  }

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

        <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <input
            aria-label="Novo item"
            placeholder="Novo item"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={!newTitle.trim()}>
            Adicionar
          </button>
        </form>

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
                        return (
                          <td key={day} className={count === 0 ? 'zero' : undefined}>
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

function ChecklistRow({ item, count, lastAt }: { item: ChecklistItem; count: number; lastAt?: number }) {
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(item.title)

  function startEdit() {
    setTitle(item.title)
    setEditing(true)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (item.id == null || !title.trim()) return
    await renameChecklistItem(db, item.id, title)
    setEditing(false)
  }

  async function remove() {
    if (item.id == null) return
    const confirmed = window.confirm(`Remover “${item.title}” e todo o histórico dele?`)
    if (!confirmed) return
    await removeChecklistItem(db, item.id)
  }

  if (editing) {
    return (
      <form className="edit-row" onSubmit={save}>
        <div>
          <label htmlFor={`checklist-${item.id}`}>Título</label>
          <input id={`checklist-${item.id}`} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="edit-row-buttons">
          <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            Salvar
          </button>
        </div>
        <button
          type="button"
          className="btn btn-outline"
          style={{ color: 'var(--danger)', padding: '9px 12px', fontSize: 13 }}
          onClick={remove}
        >
          Remover item
        </button>
      </form>
    )
  }

  return (
    <div className="list-item" style={{ gap: 10 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <p style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{item.title}</p>
          <button type="button" className="icon-btn" onClick={startEdit} aria-label={`Editar ${item.title}`}>
            <PencilIcon />
          </button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {lastAt ? `Última às ${formatClock(lastAt)}` : 'Nenhuma vez hoje'}
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
        <span className="counter-value" aria-live="polite">
          {count}
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
