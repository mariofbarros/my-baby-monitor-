import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  addChecklistItem,
  countByItemAndDay,
  countKey,
  incrementChecklistItem,
  lastDays,
  normalizeGoal,
  removeChecklistItem,
  startOfDay,
  undoChecklistItem,
  updateChecklistItem,
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
    await addChecklistItem(db, { title: '  Vitamina D  ' })
    await addChecklistItem(db, { title: '   ' })
    await addChecklistItem(db, { title: 'Água' })

    const items = await db.checklistItems.orderBy('order').toArray()
    expect(items.map((i) => [i.title, i.order])).toEqual([
      ['Vitamina D', 0],
      ['Água', 1],
    ])
  })

  it('guarda meta e observação quando informadas', async () => {
    const withGoal = (await addChecklistItem(db, { title: 'Água', goal: '8', note: '  copo de 300 ml ' }))!
    const without = (await addChecklistItem(db, { title: 'Banho', goal: '', note: '   ' }))!

    expect(await db.checklistItems.get(withGoal)).toMatchObject({ goal: 8, note: 'copo de 300 ml' })
    const plain = await db.checklistItems.get(without)
    expect(plain?.goal).toBeUndefined()
    expect(plain?.note).toBeUndefined()
  })

  it('edita título, meta e observação, e apaga meta/observação deixadas em branco', async () => {
    const id = (await addChecklistItem(db, { title: 'Vitamina', goal: 1, note: 'depois do almoço' }))!
    await updateChecklistItem(db, id, { title: ' Vitamina D ', goal: '2', note: 'antes do almoço' })
    expect(await db.checklistItems.get(id)).toMatchObject({ title: 'Vitamina D', goal: 2, note: 'antes do almoço' })

    await updateChecklistItem(db, id, { title: 'Vitamina D', goal: '', note: '' })
    const item = await db.checklistItems.get(id)
    expect(item).not.toHaveProperty('goal')
    expect(item).not.toHaveProperty('note')
  })

  it('não aceita título vazio na edição', async () => {
    const id = (await addChecklistItem(db, { title: 'Vitamina', goal: 3 }))!
    await updateChecklistItem(db, id, { title: '  ', goal: 5 })
    expect(await db.checklistItems.get(id)).toMatchObject({ title: 'Vitamina', goal: 3 })
  })

  it('remover apaga o item e só os toques dele', async () => {
    const a = (await addChecklistItem(db, { title: 'A' }))!
    const b = (await addChecklistItem(db, { title: 'B' }))!
    await incrementChecklistItem(db, a, at(10, 8))
    await incrementChecklistItem(db, b, at(10, 9))
    await incrementChecklistItem(db, a, at(11, 8))

    await removeChecklistItem(db, a)

    expect(await db.checklistItems.toArray()).toHaveLength(1)
    expect((await db.checklistLogs.toArray()).map((l) => l.itemId)).toEqual([b])
  })
})

describe('normalizeGoal', () => {
  it('aceita só inteiros a partir de 1', () => {
    expect(['8', 8, ' 3 '].map(normalizeGoal)).toEqual([8, 8, 3])
    expect(['', '0', '-2', '2.5', 'abc', 0, 1.5, null, undefined].map(normalizeGoal)).toEqual(
      Array(9).fill(undefined),
    )
  })
})

describe('contagem por dia', () => {
  it('zera no dia seguinte e mantém o histórico de cada dia', async () => {
    const id = (await addChecklistItem(db, { title: 'Água' }))!
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
    const id = (await addChecklistItem(db, { title: 'Água' }))!
    await incrementChecklistItem(db, id, at(29, 8))
    await incrementChecklistItem(db, id, at(29, 10))

    expect(await undoChecklistItem(db, id, at(29, 12))).toBe(true)
    expect((await db.checklistLogs.toArray()).map((l) => l.timestamp)).toEqual([at(29, 8)])
  })

  it('não apaga toques de dias anteriores nem de outros itens', async () => {
    const a = (await addChecklistItem(db, { title: 'A' }))!
    const b = (await addChecklistItem(db, { title: 'B' }))!
    await incrementChecklistItem(db, a, at(28, 22))
    await incrementChecklistItem(db, b, at(29, 9))

    expect(await undoChecklistItem(db, a, at(29, 12))).toBe(false)
    expect(await db.checklistLogs.count()).toBe(2)
  })
})
