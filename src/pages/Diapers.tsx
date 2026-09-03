import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import type { DiaperType } from '../lib/types'
import { formatClock, formatDateShort, formatTimeAgo } from '../lib/time'
import { DropIcon } from '../components/Icons'

const TYPE_LABEL: Record<DiaperType, string> = {
  pee: 'Xixi',
  poop: 'Cocô',
  both: 'Ambos',
}

const TYPE_COLOR: Record<DiaperType, string> = {
  pee: 'var(--pee)',
  poop: 'var(--poop)',
  both: 'var(--accent)',
}

const TYPE_BG: Record<DiaperType, string> = {
  pee: 'var(--pee-bg)',
  poop: 'var(--poop-bg)',
  both: 'var(--surface-2)',
}

export default function Diapers() {
  const diapers = useLiveQuery(() => db.diapers.orderBy('timestamp').reverse().limit(30).toArray(), [], [])
  const last = diapers?.[0]

  async function logDiaper(type: DiaperType) {
    await db.diapers.add({ type, timestamp: Date.now() })
  }

  async function deleteDiaper(id?: number) {
    if (id == null) return
    await db.diapers.delete(id)
  }

  return (
    <div>
      <header className="app-header">
        <h1 style={{ fontSize: 22 }}>Fraldas</h1>
      </header>
      <div className="page">
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>Registrar troca</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>
            {last ? `Última troca ${formatTimeAgo(last.timestamp)}` : 'Nenhuma troca registrada ainda'}
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            {(['pee', 'poop', 'both'] as DiaperType[]).map((type) => (
              <button
                key={type}
                type="button"
                className="btn"
                onClick={() => logDiaper(type)}
                style={{
                  flex: 1,
                  flexDirection: 'column',
                  padding: '18px 8px',
                  background: TYPE_BG[type],
                  color: TYPE_COLOR[type],
                }}
              >
                <DropIcon className="icon" />
                <span style={{ fontSize: 14, fontWeight: 700 }}>{TYPE_LABEL[type]}</span>
              </button>
            ))}
          </div>
        </div>

        <p className="section-title">Histórico</p>
        {!diapers?.length && <p className="empty-state">Nenhuma troca registrada ainda.</p>}
        {!!diapers?.length && (
          <div className="card">
            {diapers.map((d) => (
              <div className="list-item" key={d.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span className="badge" style={{ background: TYPE_BG[d.type], color: TYPE_COLOR[d.type] }}>
                    {TYPE_LABEL[d.type]}
                  </span>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {formatDateShort(d.timestamp)} · {formatClock(d.timestamp)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteDiaper(d.id)}
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
