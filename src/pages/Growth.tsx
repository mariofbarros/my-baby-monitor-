import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../lib/db'
import { formatDateShort, todayIso } from '../lib/time'

export default function Growth() {
  const measurements = useLiveQuery(() => db.measurements.orderBy('date').reverse().toArray(), [], [])
  const [date, setDate] = useState(todayIso())
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')

  const chartData = (measurements ?? [])
    .slice()
    .reverse()
    .map((m) => ({
      date: m.date,
      label: new Date(m.date + 'T00:00:00').getTime(),
      weight: m.weightGrams ? m.weightGrams / 1000 : undefined,
      height: m.heightCm,
    }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const weightGrams = weightKg ? Math.round(parseFloat(weightKg.replace(',', '.')) * 1000) : undefined
    const heightCmNum = heightCm ? parseFloat(heightCm.replace(',', '.')) : undefined
    if (!weightGrams && !heightCmNum) return
    await db.measurements.add({ date, weightGrams, heightCm: heightCmNum })
    setWeightKg('')
    setHeightCm('')
  }

  async function deleteMeasurement(id?: number) {
    if (id == null) return
    await db.measurements.delete(id)
  }

  return (
    <div>
      <header className="app-header">
        <h1 style={{ fontSize: 22 }}>Crescimento</h1>
      </header>
      <div className="page">
        <form className="card" onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label htmlFor="date">Data</label>
            <input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={todayIso()} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="weight">Peso (kg)</label>
              <input
                id="weight"
                type="number"
                inputMode="decimal"
                step="0.001"
                placeholder="3.5"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label htmlFor="height">Altura (cm)</label>
              <input
                id="height"
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="50"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Adicionar medição
          </button>
        </form>

        {chartData.length > 1 && (
          <>
            <p className="section-title">Peso (kg)</p>
            <div className="card" style={{ height: 180, padding: '16px 8px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={(d) => formatDateShort(new Date(d).getTime())} fontSize={11} stroke="var(--text-muted)" />
                  <YAxis fontSize={11} stroke="var(--text-muted)" domain={['auto', 'auto']} />
                  <Tooltip
                    labelFormatter={(d) => formatDateShort(new Date(String(d)).getTime())}
                    formatter={(v) => [`${v} kg`, 'Peso']}
                  />
                  <Line type="monotone" dataKey="weight" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="section-title">Altura (cm)</p>
            <div className="card" style={{ height: 180, padding: '16px 8px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" tickFormatter={(d) => formatDateShort(new Date(d).getTime())} fontSize={11} stroke="var(--text-muted)" />
                  <YAxis fontSize={11} stroke="var(--text-muted)" domain={['auto', 'auto']} />
                  <Tooltip
                    labelFormatter={(d) => formatDateShort(new Date(String(d)).getTime())}
                    formatter={(v) => [`${v} cm`, 'Altura']}
                  />
                  <Line type="monotone" dataKey="height" stroke="var(--right)" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        <p className="section-title">Histórico</p>
        {!measurements?.length && <p className="empty-state">Nenhuma medição registrada ainda.</p>}
        {!!measurements?.length && (
          <div className="card">
            {measurements.map((m) => (
              <div className="list-item" key={m.id}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>
                    {m.weightGrams ? `${(m.weightGrams / 1000).toFixed(3)} kg` : '—'}
                    {m.heightCm ? ` · ${m.heightCm} cm` : ''}
                  </p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateShort(new Date(m.date + 'T00:00:00').getTime())}</p>
                </div>
                <button
                  type="button"
                  onClick={() => deleteMeasurement(m.id)}
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
