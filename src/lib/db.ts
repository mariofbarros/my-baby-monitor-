import Dexie, { type EntityTable } from 'dexie'
import type { ActiveFeeding, BabyProfile, DiaperChange, FeedingSession, Measurement } from './types'

const db = new Dexie('baby-monitor') as Dexie & {
  profile: EntityTable<BabyProfile, 'id'>
  feedings: EntityTable<FeedingSession, 'id'>
  activeFeeding: EntityTable<ActiveFeeding, 'id'>
  diapers: EntityTable<DiaperChange, 'id'>
  measurements: EntityTable<Measurement, 'id'>
}

db.version(1).stores({
  profile: 'id',
  feedings: '++id, startTime, side',
  activeFeeding: 'id',
  diapers: '++id, timestamp, type',
  measurements: '++id, date',
})

// Introduz a modalidade da mamada (peito/mamadeira/misto). Registros já
// salvos não têm esse campo — todos eram peito, então preenchemos com
// 'breast' em vez de deixar `method` ausente e cada tela ter que lidar
// com o caso "registro antigo" espalhado pelo código.
db.version(2)
  .stores({
    profile: 'id',
    feedings: '++id, startTime, side',
    activeFeeding: 'id',
    diapers: '++id, timestamp, type',
    measurements: '++id, date',
  })
  .upgrade(async (tx) => {
    await tx
      .table('feedings')
      .toCollection()
      .modify((f) => {
        if (!f.method) f.method = 'breast'
      })
    await tx
      .table('activeFeeding')
      .toCollection()
      .modify((f) => {
        if (!f.method) f.method = 'breast'
      })
  })

export { db }
