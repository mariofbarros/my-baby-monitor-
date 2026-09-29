import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { applyBackup, buildBackup, parseBackup } from './backup'
import { type BabyDb, createDb } from './db'

let db: BabyDb
let dbCount = 0

beforeEach(() => {
  db = createDb(`backup-test-${++dbCount}`)
})

afterEach(async () => {
  db.close()
  await Dexie.delete(db.name)
})

async function seed(target: BabyDb) {
  await target.profile.put({ id: 1, name: 'Ana', birthDate: '2026-08-01' })
  await target.feedings.bulkAdd([
    { method: 'breast', side: 'left', startTime: 1000, endTime: 2000, durationSeconds: 1 },
    { method: 'bottle', startTime: 3000, endTime: 4000, durationSeconds: 1 },
    { method: 'mixed', side: 'right', startTime: 5000, endTime: 6000, durationSeconds: 1 },
  ])
  await target.diapers.bulkAdd([
    { type: 'pee', timestamp: 7000 },
    { type: 'both', timestamp: 8000 },
  ])
  await target.measurements.add({ date: '2026-08-10', weightGrams: 3500, heightCm: 50 })
}

/** Registros sem o id autoincremento, para comparar dados entre bancos. */
function stripIds<T extends { id?: number }>(rows: T[]) {
  return rows.map(({ id: _id, ...rest }) => rest)
}

describe('buildBackup', () => {
  it('exporta perfil, mamadas, fraldas, medições e data de exportação', async () => {
    await seed(db)
    const backup = await buildBackup(db)

    expect(backup.profile).toEqual({ id: 1, name: 'Ana', birthDate: '2026-08-01' })
    expect(backup.feedings).toHaveLength(3)
    expect(backup.diapers).toHaveLength(2)
    expect(backup.measurements).toHaveLength(1)
    expect(Number.isNaN(Date.parse(backup.exportedAt))).toBe(false)
  })

  it('não exporta a mamada em andamento', async () => {
    await db.activeFeeding.put({ id: 1, method: 'breast', side: 'left', startTime: 1 })
    expect(await buildBackup(db)).not.toHaveProperty('activeFeeding')
  })
})

describe('exportar → importar (ida e volta)', () => {
  it('restaura os mesmos dados em outro aparelho', async () => {
    await seed(db)
    const file = JSON.stringify(await buildBackup(db))

    const other = createDb(`backup-test-${++dbCount}`)
    try {
      await applyBackup(other, parseBackup(JSON.parse(file)), 'replace')

      expect(await other.profile.get(1)).toEqual(await db.profile.get(1))
      expect(stripIds(await other.feedings.toArray())).toEqual(stripIds(await db.feedings.toArray()))
      expect(stripIds(await other.diapers.toArray())).toEqual(stripIds(await db.diapers.toArray()))
      expect(stripIds(await other.measurements.toArray())).toEqual(stripIds(await db.measurements.toArray()))
    } finally {
      other.close()
      await Dexie.delete(other.name)
    }
  })
})

describe('parseBackup', () => {
  it('rejeita o que não é objeto', () => {
    expect(() => parseBackup(null)).toThrow()
    expect(() => parseBackup('texto')).toThrow()
    expect(() => parseBackup(42)).toThrow()
  })

  it('rejeita arquivo sem nenhum dado reconhecível', () => {
    expect(() => parseBackup({})).toThrow()
    expect(() => parseBackup({ feedings: [{ foo: 1 }], diapers: 'x' })).toThrow()
  })

  it('aceita backup só com perfil', () => {
    expect(parseBackup({ profile: { name: 'Ana' } }).profile).toEqual({ name: 'Ana', birthDate: undefined })
  })

  it('trata backups antigos sem "method": com lado é peito, sem lado é mamadeira', () => {
    const { feedings } = parseBackup({
      feedings: [
        { side: 'left', startTime: 1, endTime: 2, durationSeconds: 1 },
        { startTime: 3, endTime: 4, durationSeconds: 1 },
      ],
    })
    expect(feedings.map((f) => [f.method, f.side])).toEqual([
      ['breast', 'left'],
      ['bottle', undefined],
    ])
  })

  it('descarta mamada de peito/misto sem lado e remove lado de mamadeira', () => {
    const { feedings } = parseBackup({
      feedings: [
        { method: 'breast', startTime: 1, endTime: 2, durationSeconds: 1 },
        { method: 'mixed', side: 'up', startTime: 1, endTime: 2, durationSeconds: 1 },
        { method: 'bottle', side: 'left', startTime: 5, endTime: 6, durationSeconds: 1 },
      ],
    })
    expect(feedings).toEqual([{ method: 'bottle', side: undefined, startTime: 5, endTime: 6, durationSeconds: 1 }])
  })

  it('descarta registros com campos faltando ou de tipo errado', () => {
    const result = parseBackup({
      feedings: [
        { method: 'breast', side: 'left', startTime: '1', endTime: 2, durationSeconds: 1 },
        null,
        { method: 'breast', side: 'left', startTime: 1, endTime: 2, durationSeconds: 1 },
      ],
      diapers: [{ type: 'pee', timestamp: 1 }, { type: 'xixi', timestamp: 2 }, { type: 'poop' }],
      measurements: [{ date: '2026-08-10', weightGrams: 3500 }, { weightGrams: 3600 }],
      profile: { name: 42 },
    })
    expect(result.feedings).toHaveLength(1)
    expect(result.diapers).toEqual([{ type: 'pee', timestamp: 1 }])
    expect(result.measurements).toEqual([{ date: '2026-08-10', weightGrams: 3500 }])
    expect(result.profile).toBeNull()
  })
})

describe('applyBackup', () => {
  const incoming = parseBackup({
    profile: { name: 'Bia', birthDate: '2026-09-01' },
    feedings: [{ method: 'bottle', startTime: 100, endTime: 200, durationSeconds: 1 }],
    diapers: [{ type: 'poop', timestamp: 300 }],
    measurements: [{ date: '2026-09-02', heightCm: 49 }],
  })

  it('"adicionar" soma aos dados atuais e mantém o perfil existente', async () => {
    await seed(db)
    await applyBackup(db, incoming, 'add')

    expect(await db.feedings.count()).toBe(4)
    expect(await db.diapers.count()).toBe(3)
    expect(await db.measurements.count()).toBe(2)
    expect((await db.profile.get(1))?.name).toBe('Ana')
  })

  it('"adicionar" adota o perfil do arquivo quando o aparelho não tem um', async () => {
    await applyBackup(db, incoming, 'add')
    expect(await db.profile.get(1)).toEqual({ id: 1, name: 'Bia', birthDate: '2026-09-01' })
  })

  it('"substituir" apaga tudo antes de importar', async () => {
    await seed(db)
    await applyBackup(db, incoming, 'replace')

    expect(stripIds(await db.feedings.toArray())).toEqual([
      { method: 'bottle', side: undefined, startTime: 100, endTime: 200, durationSeconds: 1 },
    ])
    expect(stripIds(await db.diapers.toArray())).toEqual([{ type: 'poop', timestamp: 300 }])
    expect(stripIds(await db.measurements.toArray())).toEqual([
      { date: '2026-09-02', weightGrams: undefined, heightCm: 49 },
    ])
    expect(await db.profile.get(1)).toEqual({ id: 1, name: 'Bia', birthDate: '2026-09-01' })
  })

  it('"substituir" sem perfil no arquivo deixa o aparelho sem perfil', async () => {
    await seed(db)
    await applyBackup(db, { ...incoming, profile: null }, 'replace')
    expect(await db.profile.get(1)).toBeUndefined()
  })

  it('perfil sem data de nascimento usa a data de hoje', async () => {
    await applyBackup(db, { ...incoming, profile: { name: 'Bia' } }, 'replace')
    expect((await db.profile.get(1))?.birthDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('não grava nada se a importação falhar no meio', async () => {
    await seed(db)
    const broken = { ...incoming, diapers: [{ type: 'pee', timestamp: 1 }, null] } as never
    await expect(applyBackup(db, broken, 'replace')).rejects.toThrow()

    expect(await db.feedings.count()).toBe(3)
    expect((await db.profile.get(1))?.name).toBe('Ana')
  })
})
