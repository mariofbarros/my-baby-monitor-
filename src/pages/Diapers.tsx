import { useLiveQuery } from 'dexie-react-hooks'
import RangeFilter from '../components/RangeFilter'
import { db } from '../lib/db'
import type { DiaperType } from '../lib/types'
import { clampRangeToData } from '../lib/ranges'
import { useRangeFilter } from '../lib/useRangeFilter'
import { formatClock, formatDateShort, formatTimeAgo } from '../lib/time'
import { DropIcon } from '../components/Icons'

const MAX_ROWS = 100

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
  const { rangeId, setRangeId, range } = useRangeFilter('range:diapers')

  // A última troca é sempre a mais recente de todas, independente do filtro.
  const latestDiaper = useLiveQuery(() => db.diapers.orderBy('timestamp').last())
  const diapers = useLiveQuery(
    () => db.diapers.where('timestamp').between(range.start, range.end, true, false).toArray(),
    [range.start, range.end],
    [],
  )

  const rows = (diapers ?? []).slice().sort((a, b) => b.timestamp - a.timestamp)
  const peeCount = rows.filter((d) => d.type === 'pee' || d.type === 'both').length
  const poopCount = rows.filter((d) => d.type === 'poop' || d.type === 'both').length
  // Em "Máximo" o período começa na troca mais antiga (a lista está em ordem decrescente).
  const view = clampRangeToData(range, rows.at(-1)?.timestamp)

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
            {latestDiaper ? `Última troca ${formatTimeAgo(latestDiaper.timestamp)}` : 'Nenhuma troca registrada ainda'}
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
        <RangeFilter value={rangeId} onChange={setRangeId} />

        {rows.length > 0 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="summary-grid">
              <div>
                <p className="summary-value">{rows.length}</p>
                <p className="summary-label">trocas</p>
              </div>
              <div>
                <p className="summary-value" style={{ color: 'var(--pee)' }}>
                  {peeCount}
                </p>
                <p className="summary-label">com xixi</p>
              </div>
              <div>
                <p className="summary-value" style={{ color: 'var(--poop)' }}>
                  {poopCount}
                </p>
                <p className="summary-label">com cocô</p>
              </div>
            </div>
            {view.days > 1 && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
                Média por dia: {(rows.length / view.days).toFixed(1)} trocas
                {range.id === 'all' && ` · ${view.days} dias de registros`}
              </p>
            )}
          </div>
        )}

        {rows.length === 0 && <p className="empty-state">Nenhuma troca em {range.label.toLowerCase()}.</p>}

        {rows.length > 0 && (
          <div className="card">
            {rows.slice(0, MAX_ROWS).map((d) => (
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

        {rows.length > MAX_ROWS && (
          <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: 10 }}>
            Mostrando as {MAX_ROWS} mais recentes de {rows.length}.
          </p>
        )}
      </div>
    </div>
  )
}
