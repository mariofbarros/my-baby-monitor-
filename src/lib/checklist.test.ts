import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addChecklistItem,
  countByItemAndDay,
  countKey,
  incrementChecklistItem,
  lastDays,
  removeChecklistItem,
  renameChecklistItem,
  startOfDay,
  undoChecklistItem,
} from './checklist'
import { type BabyDb, createDb } from './db'

let db: BabyDb
let dbCount = 0

beforeEach(() => {
  db = createDb(`checklist-test-${++dbCount}`)
})

afterEach(async () => {
  db.close()
  await Dexie.delete(db.name)
})

/** Horário local, para os testes não dependerem do fuso da máquina. */
function at(day: number, hour: number, minute = 0) {
  return new Date(2026, 8, day, hour, minute).getTime()
}

describe('itens', () => {
  it('adiciona no fim da lista, ignorando espaços e títulos vazios', async () => {
    await addChecklistItem(db, '  Vitamina D  ')
    await addChecklistItem(db, '   ')
    await addChecklistItem(db, 'Água')

    const items = await db.checklistItems.orderBy('order').toArray()
    expect(items.map((i) => [i.title, i.order])).toEqual([
      ['Vitamina D', 0],
      ['Água', 1],
    ])
  })

  it('renomeia, mas não aceita título vazio', async () => {
    const id = (await addChecklistItem(db, 'Vitamina'))!
    await renameChecklistItem(db, id, ' Vitamina D ')
    await renameChecklistItem(db, id, '')
    expect((await db.checklistItems.get(id))?.title).toBe('Vitamina D')
  })

  it('remover apaga o item e só os toques dele', async () => {
    const a = (await addChecklistItem(db, 'A'))!
    const b = (await addChecklistItem(db, 'B'))!
    await incrementChecklistItem(db, a, at(10, 8))
    await incrementChecklistItem(db, b, at(10, 9))
    await incrementChecklistItem(db, a, at(11, 8))

    await removeChecklistItem(db, a)

    expect(await db.checklistItems.toArray()).toHaveLength(1)
    expect((await db.checklistLogs.toArray()).map((l) => l.itemId)).toEqual([b])
  })
})

describe('contagem por dia', () => {
  it('zera no dia seguinte e mantém o histórico de cada dia', async () => {
    const id = (await addChecklistItem(db, 'Água'))!
    await incrementChecklistItem(db, id, at(10, 0, 0))
    await incrementChecklistItem(db, id, at(10, 23, 59))
    await incrementChecklistItem(db, id, at(11, 0, 1))

    const counts = countByItemAndDay(await db.checklistLogs.toArray())
    expect(counts.get(countKey(id, startOfDay(at(10, 12))))).toBe(2)
    expect(counts.get(countKey(id, startOfDay(at(11, 12))))).toBe(1)
    expect(counts.get(countKey(id, startOfDay(at(12, 12))))).toBeUndefined()
  })

  it('lastDays devolve dias consecutivos terminando hoje', () => {
    const days = lastDays(at(29, 15), 3)
    expect(days).toEqual([at(27, 0), at(28, 0), at(29, 0)])
  })
})

describe('desfazer', () => {
  it('remove o toque mais recente de hoje', async () => {
    const id = (await addChecklistItem(db, 'Água'))!
    await incrementChecklistItem(db, id, at(29, 8))
    await incrementChecklistItem(db, id, at(29, 10))

    expect(await undoChecklistItem(db, id, at(29, 12))).toBe(true)
    expect((await db.checklistLogs.toArray()).map((l) => l.timestamp)).toEqual([at(29, 8)])
  })

  it('não apaga toques de dias anteriores nem de outros itens', async () => {
    const a = (await addChecklistItem(db, 'A'))!
    const b = (await addChecklistItem(db, 'B'))!
    await incrementChecklistItem(db, a, at(28, 22))
    await incrementChecklistItem(db, b, at(29, 9))

    expect(await undoChecklistItem(db, a, at(29, 12))).toBe(false)
    expect(await db.checklistLogs.count()).toBe(2)
  })
})
