export type RangeId = 'today' | 'yesterday' | 'week' | 'days15' | 'month' | 'days30'

export const RANGE_OPTIONS: { id: RangeId; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'week', label: 'Última semana' },
  { id: 'days15', label: 'Últimos 15 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'days30', label: 'Últimos 30 dias' },
]

export const DEFAULT_RANGE: RangeId = 'week'

/** Intervalo [start, end) alinhado a dias inteiros, para não mudar a cada render. */
export interface Range {
  id: RangeId
  label: string
  start: number
  end: number
  /** Número de dias de calendário cobertos. */
  days: number
}

export interface Bucket {
  key: string
  label: string
}

export function startOfDay(value: number | Date): number {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Soma dias pelo calendário (não por milissegundos), para sobreviver a horário de verão. */
function addDays(epochMs: number, days: number): number {
  const d = new Date(epochMs)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

function countDays(start: number, end: number): number {
  let days = 0
  for (let t = start; t < end; t = addDays(t, 1)) days++
  return days
}

export function dayKey(value: number | Date): string {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function resolveRange(id: RangeId, now: number = Date.now()): Range {
  const label = RANGE_OPTIONS.find((o) => o.id === id)?.label ?? ''
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)

  let start = today
  let end = tomorrow

  switch (id) {
    case 'today':
      break
    case 'yesterday':
      start = addDays(today, -1)
      end = today
      break
    case 'week':
      start = addDays(today, -6)
      break
    case 'days15':
      start = addDays(today, -14)
      break
    case 'days30':
      start = addDays(today, -29)
      break
    case 'month': {
      const first = new Date(now)
      first.setDate(1)
      first.setHours(0, 0, 0, 0)
      start = first.getTime()
      break
    }
  }

  return { id, label, start, end, days: countDays(start, end) }
}

/**
 * Períodos de um dia são agrupados em blocos de 3 horas (mostra a rotina do dia);
 * períodos maiores, dia a dia.
 */
export function buildBuckets(range: Range): Bucket[] {
  if (range.days <= 1) {
    const buckets: Bucket[] = []
    for (let hour = 0; hour < 24; hour += 3) {
      buckets.push({ key: `h${hour}`, label: `${String(hour).padStart(2, '0')}h` })
    }
    return buckets
  }

  const buckets: Bucket[] = []
  for (let t = range.start; t < range.end; t = addDays(t, 1)) {
    const d = new Date(t)
    buckets.push({
      key: dayKey(d),
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
    })
  }
  return buckets
}

/** Chave do bucket a que um instante pertence, no mesmo formato de buildBuckets. */
export function bucketKeyOf(range: Range, epochMs: number): string {
  if (range.days <= 1) {
    return `h${Math.floor(new Date(epochMs).getHours() / 3) * 3}`
  }
  return dayKey(epochMs)
}
