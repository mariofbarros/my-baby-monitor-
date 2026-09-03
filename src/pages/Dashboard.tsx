import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import RangeFilter from '../components/RangeFilter'
import { db } from '../lib/db'
import { bucketKeyOf, buildBuckets, clampRangeToData, granularityOf, GRANULARITY_LABEL } from '../lib/ranges'
import { useRangeFilter } from '../lib/useRangeFilter'
import { ageLabel, formatDuration, formatDurationLabel, formatTimeAgo } from '../lib/time'

const FEEDING_ALERT_HOURS = 4
const DIAPER_ALERT_HOURS = 6

export default function Dashboard() {
  const { rangeId, setRangeId, range } = useRangeFilter('range:dashboard')

  const profile = useLiveQuery(() => db.profile.get(1))
  const activeFeeding = useLiveQuery(() => db.activeFeeding.get(1))
  const latestFeeding = useLiveQuery(() => db.feedings.orderBy('startTime').last())
  const latestDiaper = useLiveQuery(() => db.diapers.orderBy('timestamp').last())
  const latestMeasurement = useLiveQuery(() => db.measurements.orderBy('date').last())

  const feedings = useLiveQuery(
    () => db.feedings.where('startTime').between(range.start, range.end, true, false).toArray(),
    [range.start, range.end],
    [],
  )
  const diapers = useLiveQuery(
    () => db.diapers.where('timestamp').between(range.start, range.end, true, false).toArray(),
    [range.start, range.end],
    [],
  )

  // "Máximo" começa no registro mais antigo que existir entre mamadas e fraldas.
  let earliest = Infinity
  for (const f of feedings ?? []) earliest = Math.min(earliest, f.startTime)
  for (const d of diapers ?? []) earliest = Math.min(earliest, d.timestamp)
  const view = clampRangeToData(range, Number.isFinite(earliest) ? earliest : undefined)

  const buckets = buildBuckets(view)
  const granularity = granularityOf(view)
  const grouping = GRANULARITY_LABEL[granularity]
  // Com dezenas de barras finas (semana/mês) uma linha lê muito melhor num celular.
  const asLine = granularity === 'week' || granularity === 'month'

  const feedingChart = buckets.map((b) => ({ ...b, mamadas: 0 }))
  const feedingByKey = new Map(feedingChart.map((b) => [b.key, b]))
  for (const f of feedings ?? []) {
    const bucket = feedingByKey.get(bucketKeyOf(view, f.startTime))
    if (bucket) bucket.mamadas++
  }

  const diaperChart = buckets.map((b) => ({ ...b, xixi: 0, coco: 0, ambos: 0 }))
  const diaperByKey = new Map(diaperChart.map((b) => [b.key, b]))
  for (const d of diapers ?? []) {
    const bucket = diaperByKey.get(bucketKeyOf(view, d.timestamp))
    if (!bucket) continue
    if (d.type === 'pee') bucket.xixi++
    else if (d.type === 'poop') bucket.coco++
    else bucket.ambos++
  }

  const feedingCount = feedings?.length ?? 0
  const totalSeconds = (feedings ?? []).reduce((sum, f) => sum + f.durationSeconds, 0)
  const avgSeconds = feedingCount > 0 ? totalSeconds / feedingCount : 0
  const diaperCount = diapers?.length ?? 0
  const peeCount = (diapers ?? []).filter((d) => d.type === 'pee' || d.type === 'both').length
  const poopCount = (diapers ?? []).filter((d) => d.type === 'poop' || d.type === 'both').length
  const hasBothType = (diapers ?? []).some((d) => d.type === 'both')
  const isMultiDay = view.days > 1

  const now = Date.now()
  const hoursSinceFeeding = latestFeeding ? (now - latestFeeding.endTime) / 3_600_000 : null
  const hoursSinceDiaper = latestDiaper ? (now - latestDiaper.timestamp) / 3_600_000 : null

  const alerts: string[] = []
  if (!activeFeeding && hoursSinceFeeding !== null && hoursSinceFeeding >= FEEDING_ALERT_HOURS) {
    alerts.push(`Já se passaram mais de ${FEEDING_ALERT_HOURS}h desde a última mamada.`)
  }
  if (hoursSinceDiaper !== null && hoursSinceDiaper >= DIAPER_ALERT_HOURS) {
    alerts.push(`Já se passaram mais de ${DIAPER_ALERT_HOURS}h desde a última troca de fralda.`)
  }

  const nextSide = latestFeeding?.side === 'left' ? 'Direito' : 'Esquerdo'

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
              <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>Em andamento</p>
            ) : latestFeeding ? (
              <>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{formatTimeAgo(latestFeeding.endTime)}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {latestFeeding.side === 'left' ? 'Esquerdo' : 'Direito'} ·{' '}
                  {formatDuration(latestFeeding.durationSeconds)}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sem registros</p>
            )}
          </Link>

          <Link to="/feeding" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Próximo peito</p>
            {latestFeeding ? (
              <>
                <p
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: nextSide === 'Esquerdo' ? 'var(--left)' : 'var(--right)',
                  }}
                >
                  {nextSide}
                </p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Alternando o lado</p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Qualquer um</p>
            )}
          </Link>

          <Link to="/diapers" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>Última fralda</p>
            {latestDiaper ? (
              <>
                <p style={{ fontSize: 20, fontWeight: 700 }}>{formatTimeAgo(latestDiaper.timestamp)}</p>
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {latestDiaper.type === 'pee' ? 'Xixi' : latestDiaper.type === 'poop' ? 'Cocô' : 'Ambos'}
                </p>
              </>
            ) : (
              <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Sem registros</p>
            )}
          </Link>

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

        <p className="section-title">Período</p>
        <RangeFilter value={rangeId} onChange={setRangeId} />

        <div className="card">
          <div className="summary-grid">
            <div>
              <p className="summary-value">{feedingCount}</p>
              <p className="summary-label">mamadas</p>
            </div>
            <div>
              <p className="summary-value">{formatDurationLabel(totalSeconds)}</p>
              <p className="summary-label">tempo total</p>
            </div>
            <div>
              <p className="summary-value">{feedingCount > 0 ? formatDurationLabel(avgSeconds) : '—'}</p>
              <p className="summary-label">média por mamada</p>
            </div>
            <div>
              <p className="summary-value">{diaperCount}</p>
              <p className="summary-label">fraldas</p>
            </div>
            <div>
              <p className="summary-value" style={{ color: 'var(--pee)' }}>
                {peeCount}
              </p>
              <p className="summary-label">xixi</p>
            </div>
            <div>
              <p className="summary-value" style={{ color: 'var(--poop)' }}>
                {poopCount}
              </p>
              <p className="summary-label">cocô</p>
            </div>
          </div>
          {isMultiDay && (feedingCount > 0 || diaperCount > 0) && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 14 }}>
              Média por dia: {(feedingCount / view.days).toFixed(1)} mamadas ·{' '}
              {(diaperCount / view.days).toFixed(1)} fraldas
              {range.id === 'all' && ` · ${view.days} dias de registros`}
            </p>
          )}
        </div>

        <p className="section-title" style={{ marginBottom: 2 }}>
          Mamadas · {range.label.toLowerCase()}
        </p>
        <p className="chart-note">{grouping}</p>
        <div className="card" style={{ height: 180, padding: '16px 8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {asLine ? (
              <LineChart data={feedingChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--text-muted)" interval="preserveStartEnd" minTickGap={8} />
                <YAxis fontSize={11} stroke="var(--text-muted)" allowDecimals={false} width={30} tickMargin={4} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="mamadas"
                  name="Mamadas"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ r: 2.5 }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            ) : (
              <BarChart data={feedingChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--text-muted)" interval="preserveStartEnd" minTickGap={8} />
                <YAxis fontSize={11} stroke="var(--text-muted)" allowDecimals={false} width={30} tickMargin={4} />
                <Tooltip />
                <Bar dataKey="mamadas" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Mamadas" />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>

        <p className="section-title" style={{ marginBottom: 2 }}>
          Fraldas · {range.label.toLowerCase()}
        </p>
        <p className="chart-note">{grouping}</p>
        <div className="card" style={{ height: 180, padding: '16px 8px' }}>
          <ResponsiveContainer width="100%" height="100%">
            {asLine ? (
              <LineChart data={diaperChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--text-muted)" interval="preserveStartEnd" minTickGap={8} />
                <YAxis fontSize={11} stroke="var(--text-muted)" allowDecimals={false} width={30} tickMargin={4} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="xixi" name="Xixi" stroke="var(--pee)" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="coco" name="Cocô" stroke="var(--poop)" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                {hasBothType && (
                  <Line type="monotone" dataKey="ambos" name="Ambos" stroke="var(--accent)" strokeWidth={2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                )}
              </LineChart>
            ) : (
              <BarChart data={diaperChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="label" fontSize={11} stroke="var(--text-muted)" interval="preserveStartEnd" minTickGap={8} />
                <YAxis fontSize={11} stroke="var(--text-muted)" allowDecimals={false} width={30} tickMargin={4} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="xixi" stackId="a" fill="var(--pee)" name="Xixi" />
                <Bar dataKey="coco" stackId="a" fill="var(--poop)" name="Cocô" />
                <Bar dataKey="ambos" stackId="a" fill="var(--accent)" name="Ambos" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
