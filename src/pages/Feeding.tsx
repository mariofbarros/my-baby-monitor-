import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import RangeFilter from '../components/RangeFilter'
import { db } from '../lib/db'
import type { Side } from '../lib/types'
import { clampRangeToData } from '../lib/ranges'
import { useRangeFilter } from '../lib/useRangeFilter'
import { formatClock, formatDateShort, formatDuration, formatDurationLabel } from '../lib/time'

const MAX_ROWS = 100

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

  const active = useLiveQuery(() => db.activeFeeding.get(1))
  // A sugestão de lado segue a última mamada registrada, independente do filtro.
  const latestFeeding = useLiveQuery(() => db.feedings.orderBy('startTime').last())
  const feedings = useLiveQuery(
    () => db.feedings.where('startTime').between(range.start, range.end, true, false).toArray(),
    [range.start, range.end],
    [],
  )

  const now = useNow(!!active)

  const suggestedSide: Side = latestFeeding?.side === 'left' ? 'right' : 'left'

  const rows = (feedings ?? []).slice().sort((a, b) => b.startTime - a.startTime)
  const totalSeconds = rows.reduce((sum, f) => sum + f.durationSeconds, 0)
  const leftCount = rows.filter((f) => f.side === 'left').length
  const rightCount = rows.length - leftCount
  // Em "Máximo" o período começa na mamada mais antiga (a lista está em ordem decrescente).
  const view = clampRangeToData(range, rows.at(-1)?.startTime)

  async function startFeeding(side: Side) {
    await db.activeFeeding.put({ id: 1, side, startTime: Date.now() })
  }

  async function finishFeeding() {
    if (!active) return
    const endTime = Date.now()
    const durationSeconds = Math.max(1, Math.round((endTime - active.startTime) / 1000))
    await db.feedings.add({ side: active.side, startTime: active.startTime, endTime, durationSeconds })
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
            <p style={{ fontWeight: 700, marginBottom: 4 }}>Escolha o peito para começar</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
              Sugestão baseada na última mamada
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <SideButton side="left" suggested={suggestedSide === 'left'} onClick={() => startFeeding('left')} />
              <SideButton side="right" suggested={suggestedSide === 'right'} onClick={() => startFeeding('right')} />
            </div>
          </div>
        )}

        {active && (
          <div
            className="card"
            style={{
              textAlign: 'center',
              background: active.side === 'left' ? 'var(--left-bg)' : 'var(--right-bg)',
            }}
          >
            <span
              className="badge"
              style={{
                background: active.side === 'left' ? 'var(--left)' : 'var(--right)',
                color: 'white',
              }}
            >
              Peito {active.side === 'left' ? 'esquerdo' : 'direito'}
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
              {view.days > 1 && ` · ${(rows.length / view.days).toFixed(1)} por dia`}
            </p>
          </div>
        )}

        {rows.length === 0 && <p className="empty-state">Nenhuma mamada em {range.label.toLowerCase()}.</p>}

        {rows.length > 0 && (
          <div className="card">
            {rows.slice(0, MAX_ROWS).map((f) => (
              <div className="list-item" key={f.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    className="badge"
                    style={{
                      background: f.side === 'left' ? 'var(--left-bg)' : 'var(--right-bg)',
                      color: f.side === 'left' ? 'var(--left)' : 'var(--right)',
                    }}
                  >
                    {f.side === 'left' ? 'Esq' : 'Dir'}
                  </span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14 }}>{formatDuration(f.durationSeconds)}</p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {formatDateShort(f.startTime)} · {formatClock(f.startTime)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteFeeding(f.id)}
                  aria-label="Remover"
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 18 }}
                >
                  ×
                </button>
              </div>
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
