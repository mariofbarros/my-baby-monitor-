export type Side = 'left' | 'right'

export type FeedingMethod = 'breast' | 'bottle' | 'mixed'

export type DiaperType = 'pee' | 'poop' | 'both'

export interface BabyProfile {
  id: number
  name: string
  birthDate: string // ISO date (yyyy-mm-dd)
}

export interface FeedingSession {
  id?: number
  method: FeedingMethod
  // Só se aplica a 'breast' e 'mixed'; ausente para 'bottle'.
  side?: Side
  startTime: number // epoch ms
  endTime: number // epoch ms
  durationSeconds: number
  /** Encerrada pelo app ao atingir o tempo máximo, e ainda não revisada pela pessoa. */
  autoEnded?: true
}

export interface ActiveFeeding {
  id: number // singleton, always 1
  method: FeedingMethod
  side?: Side
  startTime: number // epoch ms
}

/** Preferências do app (singleton, id sempre 1). */
export interface AppSettings {
  id: number
  /** Tempo máximo de mamada em minutos. Ausente = sem limite. */
  maxFeedingMinutes?: number
}

export interface DiaperChange {
  id?: number
  type: DiaperType
  timestamp: number // epoch ms
}

export interface Measurement {
  id?: number
  date: string // ISO date (yyyy-mm-dd)
  weightGrams?: number
  heightCm?: number
}

/** Ação do checklist pessoal ("Trocar a água", "Tomar vitamina"...). */
export interface ChecklistItem {
  id?: number
  title: string
  /** Quantas vezes por dia a pessoa quer fazer a ação. Ausente = sem meta. */
  goal?: number
  /** Descrição ou observação livre. */
  note?: string
  order: number
  createdAt: number // epoch ms
}

/** Um toque no item: a contagem do dia é o número de registros dentro dele. */
export interface ChecklistLog {
  id?: number
  itemId: number
  timestamp: number // epoch ms
}
