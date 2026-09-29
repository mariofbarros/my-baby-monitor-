import Dexie from 'dexie'
import type { BabyDb } from './db'
import type { ChecklistLog } from './types'

const DAY_MS = 86_400_000

/** Início (meia-noite local) do dia que contém `epochMs`. */
export function startOfDay(epochMs: number): number {
  const d = new Date(epochMs)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Início do dia seguinte. Usa o calendário, não +24h, por causa do horário de verão. */
export function startOfNextDay(epochMs: number): number {
  const d = new Date(startOfDay(epochMs))
  d.setDate(d.getDate() + 1)
  return d.getTime()
}

/** Inícios dos últimos `days` dias, do mais antigo até o dia de `now`. */
export function lastDays(now: number, days: number): number[] {
  const result: number[] = []
  let day = startOfDay(now)
  for (let i = 0; i < days; i++) {
    result.unshift(day)
    // Meio-dia do dia anterior evita cair no mesmo dia em trocas de fuso de 23h/25h.
    day = startOfDay(day - DAY_MS / 2)
  }
  return result
}

/** Conta os toques por item e por dia. Chave: `${itemId}:${inícioDoDia}`. */
export function countByItemAndDay(logs: ChecklistLog[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const log of logs) {
    const key = countKey(log.itemId, startOfDay(log.timestamp))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

export function countKey(itemId: number, dayStart: number): string {
  return `${itemId}:${dayStart}`
}

export async function addChecklistItem(db: BabyDb, title: string, now = Date.now()): Promise<number | undefined> {
  const trimmed = title.trim()
  if (!trimmed) return undefined
  const last = await db.checklistItems.orderBy('order').last()
  return db.checklistItems.add({ title: trimmed, order: (last?.order ?? -1) + 1, createdAt: now })
}

export async function renameChecklistItem(db: BabyDb, id: number, title: string): Promise<void> {
  const trimmed = title.trim()
  if (!trimmed) return
  await db.checklistItems.update(id, { title: trimmed })
}

/** Remove o item junto com todo o histórico de toques dele. */
export async function removeChecklistItem(db: BabyDb, id: number): Promise<void> {
  await db.transaction('rw', db.checklistItems, db.checklistLogs, async () => {
    await logsOfItem(db, id).delete()
    await db.checklistItems.delete(id)
  })
}

export async function incrementChecklistItem(db: BabyDb, itemId: number, now = Date.now()): Promise<void> {
  await db.checklistLogs.add({ itemId, timestamp: now })
}

/**
 * Desfaz o toque mais recente do item no dia de `now`. Não mexe em dias
 * anteriores, para o "−" nunca apagar histórico que não está na tela.
 */
export async function undoChecklistItem(db: BabyDb, itemId: number, now = Date.now()): Promise<boolean> {
  const last = await db.checklistLogs
    .where('[itemId+timestamp]')
    .between([itemId, startOfDay(now)], [itemId, startOfNextDay(now)], true, false)
    .last()
  if (last?.id == null) return false
  await db.checklistLogs.delete(last.id)
  return true
}

function logsOfItem(db: BabyDb, itemId: number) {
  return db.checklistLogs.where('[itemId+timestamp]').between([itemId, Dexie.minKey], [itemId, Dexie.maxKey])
}
