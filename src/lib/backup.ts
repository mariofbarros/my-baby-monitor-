import type { BabyDb } from './db'
import { todayIso } from './time'
import type { DiaperType, FeedingMethod, Side } from './types'

export type ParsedBackup = {
  feedings: { method: FeedingMethod; side?: Side; startTime: number; endTime: number; durationSeconds: number }[]
  diapers: { type: DiaperType; timestamp: number }[]
  measurements: { date: string; weightGrams?: number; heightCm?: number }[]
  profile: { name: string; birthDate?: string } | null
}

export type ImportMode = 'add' | 'replace'

const FEEDING_SIDES: Side[] = ['left', 'right']
const FEEDING_METHOD_IDS: FeedingMethod[] = ['breast', 'bottle', 'mixed']
const DIAPER_TYPES: DiaperType[] = ['pee', 'poop', 'both']

/** Monta o objeto que vai para o arquivo JSON de backup. */
export async function buildBackup(db: BabyDb) {
  const [profile, feedings, diapers, measurements] = await Promise.all([
    db.profile.get(1),
    db.feedings.toArray(),
    db.diapers.toArray(),
    db.measurements.toArray(),
  ])
  return { profile, feedings, diapers, measurements, exportedAt: new Date().toISOString() }
}

/**
 * Valida o conteúdo de um arquivo de backup já passado por JSON.parse,
 * descartando registros inválidos. Lança erro se nada for aproveitável.
 */
export function parseBackup(parsed: unknown): ParsedBackup {
  if (!parsed || typeof parsed !== 'object') throw new Error('formato inválido')
  const data = parsed as Record<string, unknown>

  const feedings = (Array.isArray(data.feedings) ? data.feedings : [])
    .map((f: unknown): ParsedBackup['feedings'][number] | null => {
      if (!f || typeof f !== 'object') return null
      const r = f as Record<string, unknown>
      if (typeof r.startTime !== 'number' || typeof r.endTime !== 'number' || typeof r.durationSeconds !== 'number') {
        return null
      }
      const side = FEEDING_SIDES.includes(r.side as Side) ? (r.side as Side) : undefined
      // Backups de antes da modalidade existir não têm "method" — toda mamada era no peito.
      const method: FeedingMethod = FEEDING_METHOD_IDS.includes(r.method as FeedingMethod)
        ? (r.method as FeedingMethod)
        : side
          ? 'breast'
          : 'bottle'
      if (method !== 'bottle' && !side) return null
      return {
        method,
        side: method === 'bottle' ? undefined : side,
        startTime: r.startTime,
        endTime: r.endTime,
        durationSeconds: r.durationSeconds,
      }
    })
    .filter((f): f is ParsedBackup['feedings'][number] => f !== null)
  const diapers = (Array.isArray(data.diapers) ? data.diapers : []).filter(
    (d: unknown): d is ParsedBackup['diapers'][number] =>
      !!d &&
      typeof d === 'object' &&
      DIAPER_TYPES.includes((d as { type?: unknown }).type as DiaperType) &&
      typeof (d as { timestamp?: unknown }).timestamp === 'number',
  )
  const measurements = (Array.isArray(data.measurements) ? data.measurements : []).filter(
    (m: unknown): m is ParsedBackup['measurements'][number] =>
      !!m && typeof m === 'object' && typeof (m as { date?: unknown }).date === 'string',
  )
  const rawProfile = data.profile as Record<string, unknown> | null | undefined
  const profile =
    rawProfile && typeof rawProfile === 'object' && typeof rawProfile.name === 'string'
      ? { name: rawProfile.name, birthDate: rawProfile.birthDate as string | undefined }
      : null

  if (feedings.length === 0 && diapers.length === 0 && measurements.length === 0 && !profile) {
    throw new Error('nenhum dado reconhecível')
  }

  return { feedings, diapers, measurements, profile }
}

/** Grava um backup validado no banco, somando aos dados atuais ou substituindo tudo. */
export async function applyBackup(db: BabyDb, backup: ParsedBackup, mode: ImportMode): Promise<void> {
  const { feedings, diapers, measurements, profile: importedProfile } = backup
  await db.transaction('rw', db.feedings, db.diapers, db.measurements, db.profile, async () => {
    if (mode === 'replace') {
      await Promise.all([db.feedings.clear(), db.diapers.clear(), db.measurements.clear(), db.profile.clear()])
    }
    for (const f of feedings) {
      await db.feedings.add({
        method: f.method,
        side: f.side,
        startTime: f.startTime,
        endTime: f.endTime,
        durationSeconds: f.durationSeconds,
      })
    }
    for (const d of diapers) {
      await db.diapers.add({ type: d.type, timestamp: d.timestamp })
    }
    for (const m of measurements) {
      await db.measurements.add({ date: m.date, weightGrams: m.weightGrams, heightCm: m.heightCm })
    }

    if (mode === 'replace') {
      if (importedProfile) {
        await db.profile.put({ id: 1, name: importedProfile.name, birthDate: importedProfile.birthDate || todayIso() })
      }
    } else {
      // Em "adicionar", só adota o perfil do arquivo se este dispositivo ainda não tiver um configurado.
      const existingProfile = await db.profile.get(1)
      if (!existingProfile && importedProfile) {
        await db.profile.put({ id: 1, name: importedProfile.name, birthDate: importedProfile.birthDate || todayIso() })
      }
    }
  })
}
