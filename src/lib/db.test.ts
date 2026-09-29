import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import { createDb } from './db'

const DB_NAME = 'migration-test'

/** Abre o banco como a versão 1 do app deixava no aparelho, com registros sem "method". */
async function seedV1() {
  const v1 = new Dexie(DB_NAME)
  v1.version(1).stores({
    profile: 'id',
    feedings: '++id, startTime, side',
    activeFeeding: 'id',
    diapers: '++id, timestamp, type',
    measurements: '++id, date',
  })
  await v1.table('profile').put({ id: 1, name: 'Ana', birthDate: '2026-08-01' })
  await v1.table('feedings').bulkAdd([
    { side: 'left', startTime: 1000, endTime: 2000, durationSeconds: 1 },
    { side: 'right', startTime: 3000, endTime: 4000, durationSeconds: 1 },
  ])
  await v1.table('activeFeeding').put({ id: 1, side: 'left', startTime: 5000 })
  await v1.table('diapers').add({ type: 'pee', timestamp: 6000 })
  await v1.table('measurements').add({ date: '2026-08-10', weightGrams: 3500 })
  v1.close()
}

afterEach(async () => {
  await Dexie.delete(DB_NAME)
})

describe('migração v1 → v2', () => {
  it('preenche method = "breast" nas mamadas antigas e na mamada em andamento', async () => {
    await seedV1()
    const db = createDb(DB_NAME)

    const feedings = await db.feedings.orderBy('startTime').toArray()
    expect(feedings.map((f) => f.method)).toEqual(['breast', 'breast'])
    expect(feedings.map((f) => f.side)).toEqual(['left', 'right'])
    expect(await db.activeFeeding.get(1)).toMatchObject({ method: 'breast', side: 'left', startTime: 5000 })
    db.close()
  })

  it('mantém os demais dados intactos', async () => {
    await seedV1()
    const db = createDb(DB_NAME)

    await db.open()
    expect(db.verno).toBe(2)
    expect(await db.profile.get(1)).toEqual({ id: 1, name: 'Ana', birthDate: '2026-08-01' })
    expect(await db.diapers.toArray()).toEqual([{ id: 1, type: 'pee', timestamp: 6000 }])
    expect(await db.measurements.toArray()).toEqual([{ id: 1, date: '2026-08-10', weightGrams: 3500 }])
    db.close()
  })

  it('não sobrescreve method já definido', async () => {
    await seedV1()
    // Simula um registro que, por algum motivo, já tinha method antes da migração.
    const v1 = new Dexie(DB_NAME)
    v1.version(1).stores({ feedings: '++id, startTime, side' })
    await v1.table('feedings').add({ method: 'mixed', side: 'left', startTime: 9000, endTime: 9500, durationSeconds: 1 })
    v1.close()

    const db = createDb(DB_NAME)
    const last = await db.feedings.orderBy('startTime').last()
    expect(last?.method).toBe('mixed')
    db.close()
  })

  it('cria um banco novo direto na v2', async () => {
    const db = createDb(DB_NAME)
    await db.open()
    expect(db.verno).toBe(2)
    expect(await db.feedings.count()).toBe(0)
    db.close()
  })
})
