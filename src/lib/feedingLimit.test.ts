import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type BabyDb, createDb } from './db'
import {
  autoEndFeedingIfOverLimit,
  getMaxFeedingMinutes,
  normalizeMaxFeedingMinutes,
  setMaxFeedingMinutes,
} from './feedingLimit'

let db: BabyDb
let dbCount = 0

beforeEach(() => {
  db = createDb(`feeding-limit-test-${++dbCount}`)
})

afterEach(async () => {
  db.close()
  await Dexie.delete(db.name)
})

const MIN = 60_000
const START = 1_000_000

describe('normalizeMaxFeedingMinutes', () => {
  it('aceita inteiros de 1 a 600, inclusive em texto', () => {
    expect(normalizeMaxFeedingMinutes(45)).toBe(45)
    expect(normalizeMaxFeedingMinutes(' 90 ')).toBe(90)
    expect(normalizeMaxFeedingMinutes(600)).toBe(600)
  })

  it('trata o resto como sem limite', () => {
    for (const v of [0, -5, 1.5, 601, '', 'abc', null, undefined, NaN]) {
      expect(normalizeMaxFeedingMinutes(v)).toBeUndefined()
    }
  })
})

describe('setMaxFeedingMinutes', () => {
  it('começa desligado, liga e desliga', async () => {
    expect(await getMaxFeedingMinutes(db)).toBeUndefined()
    await setMaxFeedingMinutes(db, 40)
    expect(await getMaxFeedingMinutes(db)).toBe(40)
    await setMaxFeedingMinutes(db, undefined)
    expect(await getMaxFeedingMinutes(db)).toBeUndefined()
    expect(await db.settings.get(1)).toEqual({ id: 1 })
  })
})

describe('autoEndFeedingIfOverLimit', () => {
  it('não faz nada sem limite configurado, mesmo com a mamada aberta há horas', async () => {
    await db.activeFeeding.put({ id: 1, method: 'breast', side: 'left', startTime: START })
    expect(await autoEndFeedingIfOverLimit(db, START + 10 * 60 * MIN)).toBe(false)
    expect(await db.activeFeeding.get(1)).toBeDefined()
    expect(await db.feedings.count()).toBe(0)
  })

  it('não faz nada sem mamada em andamento', async () => {
    await setMaxFeedingMinutes(db, 30)
    expect(await autoEndFeedingIfOverLimit(db, START)).toBe(false)
  })

  it('mantém a mamada aberta antes do limite', async () => {
    await setMaxFeedingMinutes(db, 30)
    await db.activeFeeding.put({ id: 1, method: 'bottle', startTime: START })
    expect(await autoEndFeedingIfOverLimit(db, START + 30 * MIN - 1)).toBe(false)
    expect(await db.activeFeeding.get(1)).toBeDefined()
  })

  it('encerra no limite exato, mesmo quando o app é reaberto muito depois', async () => {
    await setMaxFeedingMinutes(db, 30)
    await db.activeFeeding.put({ id: 1, method: 'mixed', side: 'right', startTime: START })

    expect(await autoEndFeedingIfOverLimit(db, START + 8 * 60 * MIN)).toBe(true)

    expect(await db.activeFeeding.get(1)).toBeUndefined()
    const [feeding] = await db.feedings.toArray()
    expect(feeding).toMatchObject({
      method: 'mixed',
      side: 'right',
      startTime: START,
      endTime: START + 30 * MIN,
      durationSeconds: 30 * 60,
      autoEnded: true,
    })
  })

  it('mamadeira encerrada não ganha lado', async () => {
    await setMaxFeedingMinutes(db, 20)
    await db.activeFeeding.put({ id: 1, method: 'bottle', startTime: START })
    await autoEndFeedingIfOverLimit(db, START + 20 * MIN)
    expect((await db.feedings.toArray())[0]).not.toHaveProperty('side')
  })

  it('rodar de novo não duplica a mamada', async () => {
    await setMaxFeedingMinutes(db, 20)
    await db.activeFeeding.put({ id: 1, method: 'breast', side: 'left', startTime: START })
    await Promise.all([autoEndFeedingIfOverLimit(db, START + 25 * MIN), autoEndFeedingIfOverLimit(db, START + 25 * MIN)])
    expect(await db.feedings.count()).toBe(1)
  })
})
