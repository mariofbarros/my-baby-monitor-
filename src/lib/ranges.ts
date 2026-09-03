const DAY_MS = 86_400_000

export type RangeId =
  | 'today'
  | 'yesterday'
  | 'week'
  | 'days15'
  | 'month'
  | 'days30'
  | 'days90'
  | 'all'

export const RANGE_OPTIONS: { id: RangeId; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'week', label: 'Última semana' },
  { id: 'days15', label: 'Últimos 15 dias' },
  { id: 'month', label: 'Este mês' },
  { id: 'days30', label: 'Últimos 30 dias' },
  { id: 'days90', label: 'Últimos 90 dias' },
  { id: 'all', label: 'Máximo' },
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

/** Como os registros são agrupados no gráfico, conforme o tamanho do período. */
export type Granularity = 'hours3' | 'day' | 'week' | 'month'

export function startOfDay(value: number | Date): number {
  const d = new Date(value)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function startOfMonth(value: number | Date): number {
  const d = new Date(value)
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Soma dias pelo calendário (não por milissegundos), para sobreviver a horário de verão. */
function addDays(epochMs: number, days: number): number {
  const d = new Date(epochMs)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

function addMonths(epochMs: number, months: number): number {
  const d = new Date(epochMs)
  d.setMonth(d.getMonth() + months)
  return d.getTime()
}

/**
 * Dias inteiros entre dois marcos de meia-noite. Arredonda em vez de truncar
 * porque uma virada de horário de verão desloca a diferença em uma hora.
 */
function dayIndex(from: number, epochMs: number): number {
  return Math.round((startOfDay(epochMs) - from) / DAY_MS)
}

export function dayKey(value: number | Date): string {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function shortDate(value: number | Date): string {
  const d = new Date(value)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

const MONTH_NAMES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

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
    case 'days90':
      start = addDays(today, -89)
      break
    case 'month':
      start = startOfMonth(now)
      break
    case 'all':
      // Sem início fixo: clampRangeToData recorta no primeiro registro real.
      start = 0
      break
  }

  return { id, label, start, end, days: Math.max(1, Math.round((end - start) / DAY_MS)) }
}

/**
 * "Máximo" só ganha um início quando se sabe qual é o registro mais antigo —
 * sem isso o período seria contado desde 1970 e a média por dia iria a zero.
 */
export function clampRangeToData(range: Range, earliestMs?: number): Range {
  if (range.id !== 'all') return range
  const start = startOfDay(earliestMs ?? range.end - 1)
  return { ...range, start, days: Math.max(1, Math.round((range.end - start) / DAY_MS)) }
}

export function granularityOf(range: Range): Granularity {
  if (range.days <= 1) return 'hours3'
  if (range.days <= 31) return 'day'
  if (range.days <= 182) return 'week'
  return 'month'
}

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  hours3: 'agrupado em blocos de 3 horas',
  day: 'agrupado por dia',
  week: 'agrupado por semana',
  month: 'agrupado por mês',
}

export function buildBuckets(range: Range): Bucket[] {
  const buckets: Bucket[] = []

  switch (granularityOf(range)) {
    case 'hours3':
      for (let hour = 0; hour < 24; hour += 3) {
        buckets.push({ key: `h${hour}`, label: `${String(hour).padStart(2, '0')}h` })
      }
      return buckets

    case 'day':
      for (let t = range.start; t < range.end; t = addDays(t, 1)) {
        buckets.push({ key: dayKey(t), label: shortDate(t) })
      }
      return buckets

    case 'week':
      for (let t = range.start, i = 0; t < range.end; t = addDays(t, 7), i++) {
        buckets.push({ key: `w${i}`, label: shortDate(t) })
      }
      return buckets

    case 'month': {
      for (let t = startOfMonth(range.start); t < range.end; t = addMonths(t, 1)) {
        const d = new Date(t)
        buckets.push({
          key: `${d.getFullYear()}-${d.getMonth()}`,
          label: `${MONTH_NAMES[d.getMonth()]}/${String(d.getFullYear()).slice(2)}`,
        })
      }
      return buckets
    }
  }
}

/** Chave do bucket a que um instante pertence, no mesmo formato de buildBuckets. */
export function bucketKeyOf(range: Range, epochMs: number): string {
  switch (granularityOf(range)) {
    case 'hours3':
      return `h${Math.floor(new Date(epochMs).getHours() / 3) * 3}`
    case 'day':
      return dayKey(epochMs)
    case 'week':
      return `w${Math.floor(dayIndex(range.start, epochMs) / 7)}`
    case 'month': {
      const d = new Date(epochMs)
      return `${d.getFullYear()}-${d.getMonth()}`
    }
  }
}
