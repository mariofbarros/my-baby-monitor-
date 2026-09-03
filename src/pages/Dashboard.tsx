import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { db } from '../lib/db'
import { ageLabel, formatDateShort, formatDuration, formatTimeAgo } from '../lib/time'

const DAY_MS = 86_400_000
const FEEDING_ALERT_HOURS = 4
const DIAPER_ALERT_HOURS = 6

function dayKey(epochMs: number) {
  const d = new Date(epochMs)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function Dashboard() {
  const profile = useLiveQuery(() => db.profile.get(1))
  const activeFeeding = useLiveQuery(() => db.activeFeeding.get(1))
  const feedings = useLiveQuery(() => db.feedings.orderBy('startTime').reverse().toArray(), [], [])
  const diapers = useLiveQuery(() => db.diapers.orderBy('timestamp').reverse().toArray(), [], [])
  const measurements = useLiveQuery(() => db.measurements.orderBy('date').reverse().limit(1).toArray(), [], [])

  const lastFeeding = feedings?.[0]
  const lastDiaper = diapers?.[0]
  const latestMeasurement = measurements?.[0]

  const now = Date.now()
  const since7d = now - 7 * DAY_MS
  const todayKey = dayKey(now)

  const feedingsToday = (feedings ?? []).filter((f) => dayKey(f.startTime) === todayKey)
  const diapersToday = (diapers ?? []).filter((d) => dayKey(d.timestamp) === todayKey)

  const days: string[] = []
  for (let i = 6; i >= 0; i--) {
    days.push(dayKey(now - i * DAY_MS))
  }

  const feedingChart = days.map((key) => {
    const items = (feedings ?? []).filter((f) => f.startTime >= since7d && dayKey(f.startTime) === key)
    return {
      day: key,
      mamadas: items.length,
      minutos: Math.round(items.reduce((sum, f) => sum + f.durationSeconds, 0) / 60),
    }
  })

  const diaperChart = days.map((key) => {
    const items = (diapers ?? []).filter((d) => d.timestamp >= since7d && dayKey(d.timestamp) === key)
    return {
      day: key,
      xixi: items.filter((d) => d.type === 'pee').length,
      coco: items.filter((d) => d.type === 'poop').length,
      ambos: items.filter((d) => d.type === 'both').length,
    }
  })

  const hoursSinceFeeding = lastFeeding ? (now - lastFeeding.startTime) / 3_600_000 : null
  const hoursSinceDiaper = lastDiaper ? (now - lastDiaper.timestamp) / 3_600_000 : null

  const alerts: string[] = []
  if (!activeFeeding && hoursSinceFeeding !== null && hoursSinceFeeding >= FEEDING_ALERT_HOURS) {
    alerts.push(`Já se passaram mais de ${FEEDING_ALERT_HOURS}h desde a última mamada.`)
  }
  if (hoursSinceDiaper !== null && hoursSinceDiaper >= DIAPER_ALERT_HOURS) {
    alerts.push(`Já se passaram mais de ${DIAPER_ALERT_HOURS}h desde a última troca de fralda.`)
  }

  return (
    <div>
      <header className="app-header">
        <div>
          <h1 style={{ fontSize: 22 }}>{profile?.name || 'Meu bebê'}</h1>
          {profile?.birthDate && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>{ageLabel(profile.birthDate)}</p>
          )}
        </div>
      </header>
      <div className="page">
        {!profile && (
          <Link to="/settings" className="card" style={{ display: 'block', textDecoration: 'none', marginBottom: 16 }}>
            <p style={{ fontWeight: 700 }}>Configure o perfil do bebê →</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Adicione nome e data de nascimento</p>
          </Link>
        )}

        {alerts.length > 0 && (
          <div className="card" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', marginBottom: 16 }}>
            {alerts.map((a) => (
              <p key={a} style={{ fontSize: 13, fontWeight: 600 }}>
                ⚠ {a}
              </p>
            ))}
          </div>
        )}

        <div className="stat-grid">
          <Link to="/feeding" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Última mamada</p>
            {activeFeeding ? (
              <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent)' }}>Em andamento</p>
            ) : lastFeeding ? (
              <>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{formatTimeAgo(lastFeeding.startTime)}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {lastFeeding.side === 'left' ? 'Esquerdo' : 'Direito'} · {formatDuration(lastFeeding.durationSeconds)}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sem registros</p>
            )}
          </Link>

          <Link to="/diapers" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Última fralda</p>
            {lastDiaper ? (
              <>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{formatTimeAgo(lastDiaper.timestamp)}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {lastDiaper.type === 'pee' ? 'Xixi' : lastDiaper.type === 'poop' ? 'Cocô' : 'Ambos'}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sem registros</p>
            )}
          </Link>

          <div className="card">
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Hoje</p>
            <p style={{ fontSize: 20, fontWeight: 700 }}>{feedingsToday.length} mamadas</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>{diapersToday.length} fraldas</p>
          </div>

          <Link to="/growth" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Última medição</p>
            {latestMeasurement ? (
              <>
                <p style={{ fontSize: 20, fontWeight: 700 }}>
                  {latestMeasurement.weightGrams ? `${(latestMeasurement.weightGrams / 1000).toFixed(2)} kg` : '—'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {latestMeasurement.heightCm ? `${latestMeasurement.heightCm} cm` : ''}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sem registros</p>
            )}
          </Link>
        </div>

        <p className="section-title">Mamadas (últimos 7 dias)</p>
        <div className="card" style={{ height: 180, padding: '16px 8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={feedingChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tickFormatter={(d) => formatDateShort(new Date(d).getTime())} fontSize={11} stroke="var(--text-muted)" />
              <YAxis fontSize={11} stroke="var(--text-muted)" allowDecimals={false} />
              <Tooltip labelFormatter={(d) => formatDateShort(new Date(String(d)).getTime())} />
              <Bar dataKey="mamadas" fill="var(--accent)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="section-title">Fraldas (últimos 7 dias)</p>
        <div className="card" style={{ height: 180, padding: '16px 8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={diaperChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tickFormatter={(d) => formatDateShort(new Date(d).getTime())} fontSize={11} stroke="var(--text-muted)" />
              <YAxis fontSize={11} stroke="var(--text-muted)" allowDecimals={false} />
              <Tooltip labelFormatter={(d) => formatDateShort(new Date(String(d)).getTime())} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="xixi" stackId="a" fill="var(--pee)" name="Xixi" />
              <Bar dataKey="coco" stackId="a" fill="var(--poop)" name="Cocô" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ambos" stackId="a" fill="var(--accent)" name="Ambos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
