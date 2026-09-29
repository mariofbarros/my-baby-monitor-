import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import RangeFilter from '../components/RangeFilter'
import { BottleIcon, PencilIcon } from '../components/Icons'
import { db } from '../lib/db'
import type { ActiveFeeding, FeedingMethod, FeedingSession, Side } from '../lib/types'
import { clampRangeToData } from '../lib/ranges'
import { useRangeFilter } from '../lib/useRangeFilter'
import {
  FEEDING_METHODS,
  feedingBadgeTag,
  feedingMethodBadgeLabel,
  feedingMethodBg,
  feedingMethodColor,
} from '../lib/feeding'
import {
  combineDateAndTime,
  formatClock,
  formatDateShort,
  formatDuration,
  formatDurationLabel,
  todayIso,
  toDateInputValue,
  toTimeInputValue,
} from '../lib/time'

const MAX_ROWS = 100
// Buffer de registros recentes onde procurar a última mamada NO PEITO (para
// a sugestão de lado) — mamadas de mamadeira pura não têm lado e são puladas.
const RECENT_LOOKUP = 50

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [active])
  return now
}

export default function Feeding() {
  const { rangeId, setRangeId, range } = useRangeFilter('range:feeding')

  const [selectedMethod, setSelectedMethod] = useState<FeedingMethod>('breast')

  const active = useLiveQuery(() => db.activeFeeding.get(1))
  const recentFeedings = useLiveQuery(
    () => db.feedings.orderBy('startTime').reverse().limit(RECENT_LOOKUP).toArray(),
    [],
    [],
  )
  const feedings = useLiveQuery(
    () => db.feedings.where('startTime').between(range.start, range.end, true, false).toArray(),
    [range.start, range.end],
    [],
  )

  const now = useNow(!!active)

  // A sugestão de lado segue a última mamada no peito (peito ou misto), independente do filtro.
  const lastWithSide = recentFeedings.find((f) => f.side)
  const suggestedSide: Side = lastWithSide?.side === 'left' ? 'right' : 'left'

  const rows = (feedings ?? []).slice().sort((a, b) => b.startTime - a.startTime)
  const totalSeconds = rows.reduce((sum, f) => sum + f.durationSeconds, 0)
  const leftCount = rows.filter((f) => f.side === 'left').length
  const rightCount = rows.filter((f) => f.side === 'right').length
  const bottleCount = rows.filter((f) => f.method === 'bottle').length
  // Em "Máximo" o período começa na mamada mais antiga (a lista está em ordem decrescente).
  const view = clampRangeToData(range, rows.at(-1)?.startTime)

  async function startFeeding(method: FeedingMethod, side?: Side) {
    const record: ActiveFeeding = { id: 1, method, startTime: Date.now() }
    if (side) record.side = side
    await db.activeFeeding.put(record)
  }

  async function finishFeeding() {
    if (!active) return
    const endTime = Date.now()
    const durationSeconds = Math.max(1, Math.round((endTime - active.startTime) / 1000))
    const record: Omit<FeedingSession, 'id'> = { method: active.method, startTime: active.startTime, endTime, durationSeconds }
    if (active.side) record.side = active.side
    await db.feedings.add(record)
    await db.activeFeeding.delete(1)
  }

  async function cancelFeeding() {
    await db.activeFeeding.delete(1)
  }

  async function deleteFeeding(id?: number) {
    if (id == null) return
    await db.feedings.delete(id)
  }

  const elapsedSeconds = active ? Math.floor((now - active.startTime) / 1000) : 0

  return (
    <div>
      <header className="app-header">
        <h1 style={{ fontSize: 22 }}>Mamadas</h1>
      </header>
      <div className="page">
        {!active && (
          <div className="card" style={{ textAlign: 'center' }}>
            <p style={{ fontWeight: 700, marginBottom: 12 }}>Nova mamada</p>
            <div className="method-toggle">
              {FEEDING_METHODS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`toggle-btn${selectedMethod === m.id ? ' active' : ''}`}
                  style={{ color: feedingMethodColor(m.id, 'left') }}
                  onClick={() => setSelectedMethod(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {selectedMethod === 'bottle' ? (
              <button
                type="button"
                onClick={() => startFeeding('bottle')}
                className="btn"
                style={{
                  width: '100%',
                  flexDirection: 'column',
                  padding: '22px 12px',
                  background: 'var(--bottle-bg)',
                  color: 'var(--bottle)',
                }}
              >
                <BottleIcon />
                <span style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>Iniciar mamadeira</span>
              </button>
            ) : (
              <>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Sugestão baseada na última mamada no peito
                </p>
                <div style={{ display: 'flex', gap: 12 }}>
                  <SideButton side="left" suggested={suggestedSide === 'left'} onClick={() => startFeeding(selectedMethod, 'left')} />
                  <SideButton side="right" suggested={suggestedSide === 'right'} onClick={() => startFeeding(selectedMethod, 'right')} />
                </div>
              </>
            )}
          </div>
        )}

        {active && (
          <div
            className="card"
            style={{
              textAlign: 'center',
              background: feedingMethodBg(active.method, active.side),
            }}
          >
            <span
              className="badge"
              style={{
                background: feedingMethodColor(active.method, active.side),
                color: 'white',
              }}
            >
              {feedingMethodBadgeLabel(active.method, active.side)}
            </span>
            <p style={{ fontSize: 48, fontWeight: 800, fontVariantNumeric: 'tabular-nums', margin: '16px 0' }}>
              {formatDuration(elapsedSeconds)}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Iniciada às {formatClock(active.startTime)}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={cancelFeeding}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" style={{ flex: 2 }} onClick={finishFeeding}>
                Finalizar mamada
              </button>
            </div>
          </div>
        )}

        <p className="section-title">Histórico</p>
        <RangeFilter value={rangeId} onChange={setRangeId} />

        {rows.length > 0 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="summary-grid">
              <div>
                <p className="summary-value">{rows.length}</p>
                <p className="summary-label">mamadas</p>
              </div>
              <div>
                <p className="summary-value">{formatDurationLabel(totalSeconds)}</p>
                <p className="summary-label">tempo total</p>
              </div>
              <div>
                <p className="summary-value">{formatDurationLabel(totalSeconds / rows.length)}</p>
                <p className="summary-label">média</p>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
              <span style={{ color: 'var(--left)', fontWeight: 700 }}>{leftCount}</span> no esquerdo ·{' '}
              <span style={{ color: 'var(--right)', fontWeight: 700 }}>{rightCount}</span> no direito
              {bottleCount > 0 && (
                <>
                  {' · '}
                  <span style={{ color: 'var(--bottle)', fontWeight: 700 }}>{bottleCount}</span> na mamadeira
                </>
              )}
              {view.days > 1 && ` · ${(rows.length / view.days).toFixed(1)} por dia`}
            </p>
          </div>
        )}

        {rows.length === 0 && <p className="empty-state">Nenhuma mamada em {range.label.toLowerCase()}.</p>}

        {rows.length > 0 && (
          <div className="card">
            {rows.slice(0, MAX_ROWS).map((f) => (
              <FeedingRow key={f.id} feeding={f} onDelete={deleteFeeding} />
            ))}
          </div>
        )}

        {rows.length > MAX_ROWS && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
            Mostrando as {MAX_ROWS} mais recentes de {rows.length}.
          </p>
        )}
      </div>
    </div>
  )
}

function SideButton({ side, suggested, onClick }: { side: Side; suggested: boolean; onClick: () => void }) {
  const label = side === 'left' ? 'Esquerdo' : 'Direito'
  const color = side === 'left' ? 'var(--left)' : 'var(--right)'
  const bg = side === 'left' ? 'var(--left-bg)' : 'var(--right-bg)'
  return (
    <button
      type="button"
      onClick={onClick}
      className="btn"
      style={{
        flex: 1,
        flexDirection: 'column',
        padding: '24px 12px',
        background: bg,
        color,
        border: suggested ? `2px solid ${color}` : '2px solid transparent',
        position: 'relative',
      }}
    >
      {suggested && (
        <span
          className="badge"
          style={{ position: 'absolute', top: -10, background: color, color: 'white', fontSize: 10 }}
        >
          Sugerido
        </span>
      )}
      <span style={{ fontSize: 28 }}>{side === 'left' ? '◐' : '◑'}</span>
      <span style={{ fontSize: 15, fontWeight: 700 }}>{label}</span>
    </button>
  )
}

function FeedingRow({ feeding, onDelete }: { feeding: FeedingSession; onDelete: (id?: number) => void }) {
  const [editing, setEditing] = useState(false)
  const [method, setMethod] = useState<FeedingMethod>(feeding.method)
  const [side, setSide] = useState<Side>(feeding.side ?? 'left')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [durationMin, setDurationMin] = useState('')

  function startEdit() {
    setMethod(feeding.method)
    setSide(feeding.side ?? 'left')
    setDate(toDateInputValue(feeding.startTime))
    setTime(toTimeInputValue(feeding.startTime))
    setDurationMin(String(Math.round(feeding.durationSeconds / 60)))
    setEditing(true)
  }

  async function save() {
    if (feeding.id == null) return
    const minutes = parseFloat(durationMin.replace(',', '.'))
    if (!date || !time || !Number.isFinite(minutes) || minutes <= 0) return
    const startTime = combineDateAndTime(date, time)
    const durationSeconds = Math.round(minutes * 60)
    const endTime = startTime + durationSeconds * 1000
    await db.feedings.update(feeding.id, {
      method,
      side: method === 'bottle' ? undefined : side,
      startTime,
      endTime,
      durationSeconds,
      // Depois de revisada, a mamada deixa de ser "encerrada automaticamente".
      autoEnded: undefined,
    })
    setEditing(false)
  }

  async function dismissAutoEnded() {
    if (feeding.id == null) return
    await db.feedings.update(feeding.id, { autoEnded: undefined })
  }

  if (editing) {
    const inputId = `feeding-${feeding.id}`
    return (
      <div className="edit-row">
        <div className="edit-row-toggle">
          {FEEDING_METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`toggle-btn${method === m.id ? ' active' : ''}`}
              style={{ color: feedingMethodColor(m.id, 'left') }}
              onClick={() => setMethod(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        {method !== 'bottle' && (
          <div className="edit-row-toggle">
            <button
              type="button"
              className={`toggle-btn${side === 'left' ? ' active' : ''}`}
              style={{ color: 'var(--left)' }}
              onClick={() => setSide('left')}
            >
              Esquerdo
            </button>
            <button
              type="button"
              className={`toggle-btn${side === 'right' ? ' active' : ''}`}
              style={{ color: 'var(--right)' }}
              onClick={() => setSide('right')}
            >
              Direito
            </button>
          </div>
        )}
        <div>
          <label htmlFor={`${inputId}-date`}>Data</label>
          <input
            id={`${inputId}-date`}
            type="date"
            value={date}
            max={todayIso()}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="edit-row-fields">
          <div>
            <label htmlFor={`${inputId}-time`}>Início</label>
            <input id={`${inputId}-time`} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div>
            <label htmlFor={`${inputId}-dur`}>Duração (min)</label>
            <input
              id={`${inputId}-dur`}
              type="number"
              inputMode="numeric"
              min="1"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
            />
          </div>
        </div>
        <div className="edit-row-buttons">
          <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Salvar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="list-item">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          className="badge"
          style={{
            background: feedingMethodBg(feeding.method, feeding.side),
            color: feedingMethodColor(feeding.method, feeding.side),
          }}
        >
          {feedingBadgeTag(feeding.method, feeding.side)}
        </span>
        <div>
          <p style={{ fontWeight: 600, fontSize: 14 }}>
            {formatDuration(feeding.durationSeconds)}
            {feeding.method === 'mixed' && feeding.side && (
              <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>
                {' '}
                · {feeding.side === 'left' ? 'Esq' : 'Dir'}
              </span>
            )}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {formatDateShort(feeding.startTime)} · {formatClock(feeding.startTime)}
          </p>
          {feeding.autoEnded && (
            <p style={{ fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>
              Encerrada no tempo máximo. Toque no lápis para ajustar.{' '}
              <button type="button" className="link-btn" onClick={dismissAutoEnded}>
                Ok
              </button>
            </p>
          )}
        </div>
      </div>
      <div className="row-actions">
        <button type="button" className="icon-btn" onClick={startEdit} aria-label="Editar mamada">
          <PencilIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onDelete(feeding.id)}
          aria-label="Remover mamada"
          style={{ fontSize: 18 }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
