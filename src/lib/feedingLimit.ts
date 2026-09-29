import type { BabyDb } from './db'
import type { FeedingSession } from './types'

/** Sugestão ao ligar o limite: cobre a maioria das mamadas sem cortar uma longa. */
export const DEFAULT_MAX_FEEDING_MINUTES = 60
export const MAX_FEEDING_MINUTES_UPPER = 600

/** Minutos inteiros entre 1 e 600; qualquer outra coisa é "sem limite". */
export function normalizeMaxFeedingMinutes(value: unknown): number | undefined {
  const n = typeof value === 'string' ? Number(value.trim() || NaN) : value
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= MAX_FEEDING_MINUTES_UPPER ? n : undefined
}

export async function getMaxFeedingMinutes(db: BabyDb): Promise<number | undefined> {
  return normalizeMaxFeedingMinutes((await db.settings.get(1))?.maxFeedingMinutes)
}

/** Grava o limite; undefined (ou valor inválido) desliga. */
export async function setMaxFeedingMinutes(db: BabyDb, minutes: number | undefined): Promise<void> {
  const value = normalizeMaxFeedingMinutes(minutes)
  await db.transaction('rw', db.settings, async () => {
    const current = (await db.settings.get(1)) ?? { id: 1 }
    const next = { ...current, id: 1 }
    if (value == null) delete next.maxFeedingMinutes
    else next.maxFeedingMinutes = value
    await db.settings.put(next)
  })
}

/**
 * Se a mamada em andamento passou do tempo máximo, salva ela terminando
 * exatamente no limite (e não na hora em que o app percebeu) e marca como
 * encerrada automaticamente, para a pessoa revisar. Funciona igual quando o
 * app fica fechado por horas: ao reabrir, a duração registrada é o limite.
 * Retorna true se encerrou.
 */
export async function autoEndFeedingIfOverLimit(db: BabyDb, now = Date.now()): Promise<boolean> {
  return db.transaction('rw', db.activeFeeding, db.feedings, db.settings, async () => {
    const [active, maxMinutes] = await Promise.all([db.activeFeeding.get(1), getMaxFeedingMinutes(db)])
    if (!active || maxMinutes == null) return false
    const endTime = active.startTime + maxMinutes * 60_000
    if (now < endTime) return false
    const record: Omit<FeedingSession, 'id'> = {
      method: active.method,
      startTime: active.startTime,
      endTime,
      durationSeconds: maxMinutes * 60,
      autoEnded: true,
    }
    if (active.side) record.side = active.side
    await db.feedings.add(record)
    await db.activeFeeding.delete(1)
    return true
  })
}
