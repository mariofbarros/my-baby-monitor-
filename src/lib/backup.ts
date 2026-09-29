import { normalizeGoal, normalizeNote } from './checklist'
import type { BabyDb } from './db'
import { normalizeMaxFeedingMinutes } from './feedingLimit'
import { todayIso } from './time'
import type { DiaperType, FeedingMethod, Side } from './types'

export type ParsedBackup = {
  feedings: {
    method: FeedingMethod
    side?: Side
    startTime: number
    endTime: number
    durationSeconds: number
    autoEnded?: true
  }[]
  diapers: { type: DiaperType; timestamp: number }[]
  measurements: { date: string; weightGrams?: number; heightCm?: number }[]
  profile: { name: string; birthDate?: string } | null
  /** `id` é o do aparelho de origem; só serve para ligar os toques ao item. */
  checklistItems: { id: number; title: string; goal?: number; note?: string; order: number; createdAt: number }[]
  checklistLogs: { itemId: number; timestamp: number }[]
  /** Preferências; null quando o arquivo não traz nenhuma (backups antigos). */
  settings: { maxFeedingMinutes?: number } | null
}

export type ImportMode = 'add' | 'replace'

const FEEDING_SIDES: Side[] = ['left', 'right']
const FEEDING_METHOD_IDS: FeedingMethod[] = ['breast', 'bottle', 'mixed']
const DIAPER_TYPES: DiaperType[] = ['pee', 'poop', 'both']

/** Monta o objeto que vai para o arquivo JSON de backup. */
export async function buildBackup(db: BabyDb) {
  const [profile, feedings, diapers, measurements, checklistItems, checklistLogs, settings] = await Promise.all([
    db.profile.get(1),
    db.feedings.toArray(),
    db.diapers.toArray(),
    db.measurements.toArray(),
    db.checklistItems.toArray(),
    db.checklistLogs.toArray(),
    db.settings.get(1),
  ])
  return {
    profile,
    feedings,
    diapers,
    measurements,
    checklistItems,
    checklistLogs,
    settings: { maxFeedingMinutes: settings?.maxFeedingMinutes },
    exportedAt: new Date().toISOString(),
  }
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
        ...(r.autoEnded === true ? { autoEnded: true as const } : {}),
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

  const checklistItems = (Array.isArray(data.checklistItems) ? data.checklistItems : [])
    .map((i: unknown, index): ParsedBackup['checklistItems'][number] | null => {
      if (!i || typeof i !== 'object') return null
      const r = i as Record<string, unknown>
      if (typeof r.id !== 'number' || typeof r.title !== 'string' || !r.title.trim()) return null
      return {
        id: r.id,
        title: r.title.trim(),
        goal: normalizeGoal(r.goal),
        note: normalizeNote(r.note),
        order: typeof r.order === 'number' ? r.order : index,
        createdAt: typeof r.createdAt === 'number' ? r.createdAt : 0,
      }
    })
    .filter((i): i is ParsedBackup['checklistItems'][number] => i !== null)
  const checklistItemIds = new Set(checklistItems.map((i) => i.id))
  // Toque de um item que não veio no arquivo não tem onde aparecer.
  const checklistLogs = (Array.isArray(data.checklistLogs) ? data.checklistLogs : [])
    .filter(
      (l: unknown): l is { itemId: number; timestamp: number } =>
        !!l &&
        typeof l === 'object' &&
        checklistItemIds.has((l as { itemId?: unknown }).itemId as number) &&
        typeof (l as { timestamp?: unknown }).timestamp === 'number',
    )
    .map((l) => ({ itemId: l.itemId, timestamp: l.timestamp }))

  const rawSettings = data.settings as Record<string, unknown> | null | undefined
  const settings =
    rawSettings && typeof rawSettings === 'object'
      ? { maxFeedingMinutes: normalizeMaxFeedingMinutes(rawSettings.maxFeedingMinutes) }
      : null

  if (
    feedings.length === 0 &&
    diapers.length === 0 &&
    measurements.length === 0 &&
    checklistItems.length === 0 &&
    !profile
  ) {
    throw new Error('nenhum dado reconhecível')
  }

  return { feedings, diapers, measurements, profile, checklistItems, checklistLogs, settings }
}

/** Grava um backup validado no banco, somando aos dados atuais ou substituindo tudo. */
export async function applyBackup(db: BabyDb, backup: ParsedBackup, mode: ImportMode): Promise<void> {
  const { feedings, diapers, measurements, profile: importedProfile, checklistItems, checklistLogs, settings } = backup
  const tables = [db.feedings, db.diapers, db.measurements, db.profile, db.checklistItems, db.checklistLogs, db.settings]
  await db.transaction('rw', tables, async () => {
    if (mode === 'replace') {
      await Promise.all(tables.map((t) => t.clear()))
    }
    for (const f of feedings) {
      await db.feedings.add({
        method: f.method,
        side: f.side,
        startTime: f.startTime,
        endTime: f.endTime,
        durationSeconds: f.durationSeconds,
        ...(f.autoEnded ? { autoEnded: true as const } : {}),
      })
    }
    for (const d of diapers) {
      await db.diapers.add({ type: d.type, timestamp: d.timestamp })
    }
    for (const m of measurements) {
      await db.measurements.add({ date: m.date, weightGrams: m.weightGrams, heightCm: m.heightCm })
    }

    // Os ids do arquivo são do outro aparelho: cada item ganha um id novo aqui
    // e os toques são religados a ele. Em "adicionar", um item com o mesmo
    // título que já existe recebe os toques em vez de virar uma cópia.
    const existingItems = await db.checklistItems.orderBy('order').toArray()
    const idByTitle = new Map(existingItems.map((i) => [i.title, i.id!]))
    let nextOrder = (existingItems.at(-1)?.order ?? -1) + 1
    const newIdBySourceId = new Map<number, number>()
    for (const item of [...checklistItems].sort((a, b) => a.order - b.order)) {
      let id = idByTitle.get(item.title)
      if (id == null) {
        id = (await db.checklistItems.add({
          title: item.title,
          goal: item.goal,
          note: item.note,
          order: nextOrder++,
          createdAt: item.createdAt,
        })) as number
        idByTitle.set(item.title, id)
      }
      newIdBySourceId.set(item.id, id)
    }
    for (const l of checklistLogs) {
      await db.checklistLogs.add({ itemId: newIdBySourceId.get(l.itemId)!, timestamp: l.timestamp })
    }

    // Preferências seguem a mesma regra do perfil: "substituir" adota as do
    // arquivo; "adicionar" só preenche o que ainda não foi configurado aqui.
    const currentLimit = (await db.settings.get(1))?.maxFeedingMinutes
    if (settings?.maxFeedingMinutes != null && (mode === 'replace' || currentLimit == null)) {
      await db.settings.put({ id: 1, maxFeedingMinutes: settings.maxFeedingMinutes })
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
