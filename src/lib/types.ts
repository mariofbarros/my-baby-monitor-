export type Side = 'left' | 'right'

export type DiaperType = 'pee' | 'poop' | 'both'

export interface BabyProfile {
  id: number
  name: string
  birthDate: string // ISO date (yyyy-mm-dd)
}

export interface FeedingSession {
  id?: number
  side: Side
  startTime: number // epoch ms
  endTime: number // epoch ms
  durationSeconds: number
}

export interface ActiveFeeding {
  id: number // singleton, always 1
  side: Side
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
