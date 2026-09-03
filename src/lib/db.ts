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

export { db }
