import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { db } from '../lib/db'
import type { Side } from '../lib/types'
import { formatClock, formatDateShort, formatDuration } from '../lib/time'

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
  const active = useLiveQuery(() => db.activeFeeding.get(1))
  const feedings = useLiveQuery(() => db.feedings.orderBy('startTime').reverse().limit(30).toArray(), [], [])
  const lastFeeding = feedings?.[0]

  const now = useNow(!!active)

  const suggestedSide: Side = lastFeeding?.side === 'left' ? 'right' : 'left'

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
            <p style={{ fontWeight: 700, marginBottom: 4 }}>Qual peito ela vai oferecer?</p>
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
        {!feedings?.length && <p className="empty-state">Nenhuma mamada registrada ainda.</p>}
        {!!feedings?.length && (
          <div className="card">
            {feedings.map((f) => (
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
