import Dexie, { type EntityTable } from 'dexie'
import type {
  ActiveFeeding,
  AppSettings,
  BabyProfile,
  ChecklistItem,
  ChecklistLog,
  DiaperChange,
  FeedingSession,
  Measurement,
} from './types'

export type BabyDb = Dexie & {
  profile: EntityTable<BabyProfile, 'id'>
  feedings: EntityTable<FeedingSession, 'id'>
  activeFeeding: EntityTable<ActiveFeeding, 'id'>
  diapers: EntityTable<DiaperChange, 'id'>
  measurements: EntityTable<Measurement, 'id'>
  checklistItems: EntityTable<ChecklistItem, 'id'>
  checklistLogs: EntityTable<ChecklistLog, 'id'>
  settings: EntityTable<AppSettings, 'id'>
}

/** Declara o schema e as migrações. Exportado para os testes abrirem bancos isolados. */
export function createDb(name: string): BabyDb {
  const db = new Dexie(name) as BabyDb

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

  // Checklist pessoal: só cria tabelas novas, os dados existentes não mudam.
  // Cada toque vira um registro com horário, então o histórico por dia sai
  // de uma consulta por intervalo, sem precisar "zerar" nada à meia-noite.
  db.version(3).stores({
    profile: 'id',
    feedings: '++id, startTime, side',
    activeFeeding: 'id',
    diapers: '++id, timestamp, type',
    measurements: '++id, date',
    checklistItems: '++id, order',
    checklistLogs: '++id, timestamp, [itemId+timestamp]',
  })

  // Preferências do app (tempo máximo de mamada). Só uma tabela nova.
  db.version(4).stores({
    profile: 'id',
    feedings: '++id, startTime, side',
    activeFeeding: 'id',
    diapers: '++id, timestamp, type',
    measurements: '++id, date',
    checklistItems: '++id, order',
    checklistLogs: '++id, timestamp, [itemId+timestamp]',
    settings: 'id',
  })

  return db
}

export const db = createDb('baby-monitor')
