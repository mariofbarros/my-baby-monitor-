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
}

export interface ActiveFeeding {
  id: number // singleton, always 1
  method: FeedingMethod
  side?: Side
  startTime: number // epoch ms
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
