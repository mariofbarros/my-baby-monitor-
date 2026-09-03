import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PencilIcon } from '../components/Icons'
import { db } from '../lib/db'
import type { Measurement } from '../lib/types'
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
              <MeasurementRow key={m.id} measurement={m} onDelete={deleteMeasurement} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MeasurementRow({
  measurement,
  onDelete,
}: {
  measurement: Measurement
  onDelete: (id?: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [date, setDate] = useState('')
  const [weightKg, setWeightKg] = useState('')
  const [heightCm, setHeightCm] = useState('')

  function startEdit() {
    setDate(measurement.date)
    setWeightKg(measurement.weightGrams ? String(measurement.weightGrams / 1000) : '')
    setHeightCm(measurement.heightCm ? String(measurement.heightCm) : '')
    setEditing(true)
  }

  async function save() {
    if (measurement.id == null || !date) return
    const weightGrams = weightKg ? Math.round(parseFloat(weightKg.replace(',', '.')) * 1000) : undefined
    const heightCmNum = heightCm ? parseFloat(heightCm.replace(',', '.')) : undefined
    if (!weightGrams && !heightCmNum) return
    // Um valor undefined apaga o campo no Dexie — útil se o peso ou a altura foram limpos na edição.
    await db.measurements.update(measurement.id, { date, weightGrams, heightCm: heightCmNum })
    setEditing(false)
  }

  if (editing) {
    const inputId = `measurement-${measurement.id}`
    return (
      <div className="edit-row">
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
            <label htmlFor={`${inputId}-weight`}>Peso (kg)</label>
            <input
              id={`${inputId}-weight`}
              type="number"
              inputMode="decimal"
              step="0.001"
              placeholder="3.5"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={`${inputId}-height`}>Altura (cm)</label>
            <input
              id={`${inputId}-height`}
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="50"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value)}
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
      <div>
        <p style={{ fontWeight: 600, fontSize: 14 }}>
          {measurement.weightGrams ? `${(measurement.weightGrams / 1000).toFixed(3)} kg` : '—'}
          {measurement.heightCm ? ` · ${measurement.heightCm} cm` : ''}
        </p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {formatDateShort(new Date(measurement.date + 'T00:00:00').getTime())}
        </p>
      </div>
      <div className="row-actions">
        <button type="button" className="icon-btn" onClick={startEdit} aria-label="Editar medição">
          <PencilIcon />
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onDelete(measurement.id)}
          aria-label="Remover medição"
          style={{ fontSize: 18 }}
        >
          ×
        </button>
      </div>
    </div>
  )
}
