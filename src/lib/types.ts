import type { Timestamp } from 'firebase/firestore'

export type FeedType = 'breast' | 'bottle' | 'formula'
export type BreastSide = 'left' | 'right' | 'both'
export type DiaperType = 'wet' | 'dirty' | 'both' | 'dry'
export type MedicineFor = 'baby' | 'mother'
export type RepeatSchedule = 'daily' | 'weekly'

export interface DoseTime {
  label: string  // 'Morning', 'Lunch', 'Night', etc.
  time: string   // 'HH:MM' in 24h format
}

export interface FeedingLog {
  id: string
  type: FeedType
  side?: BreastSide
  durationMin?: number
  amountMl?: number
  startedAt: Timestamp
  endedAt?: Timestamp
  notes?: string
}

export interface DiaperLog {
  id: string
  type: DiaperType
  changedAt: Timestamp
  notes?: string
}

export interface Medicine {
  id: string
  name: string
  dosage: string
  unit: string
  for: MedicineFor
  doseTimes: DoseTime[]
  startDate: string          // 'YYYY-MM-DD'
  repeatSchedule: RepeatSchedule
  repetitions: number        // days (daily) or weeks (weekly); 0 = ongoing
  active: boolean
  notes?: string
}

export interface MedicineLog {
  id: string
  medicineId: string
  medicineName: string
  medicineFor: MedicineFor
  doseLabel: string
  givenAt: Timestamp
  notes?: string
}

// A growth measurement event. Either/both of weightKg and lengthCm may be
// present (at least one). Stored in the `weightLogs` collection — the name is
// kept for continuity with existing weight history; length is an added field.
export interface GrowthLog {
  id: string
  weightKg?: number  // kg, stored up to 3 decimal places
  lengthCm?: number  // recumbent length in cm, 1 decimal place
  recordedAt: Timestamp
  notes?: string
}

/** @deprecated use GrowthLog — kept as an alias for older references */
export type WeightLog = GrowthLog

export type BabySex = 'boy' | 'girl'

export interface BabyProfile {
  name: string
  sex: BabySex
  birthDate: string  // 'YYYY-MM-DD'
  birthTime?: string // 'HH:MM' (24h)
}

export interface NazarLog {
  id: string
  date: string       // 'YYYY-MM-DD' — also used as the Firestore document ID
  doneAt: Timestamp
}

export interface MassageLog {
  id: string
  date: string       // 'YYYY-MM-DD' — also used as the Firestore document ID
  doneAt: Timestamp
}

export interface IncidentLog {
  id: string
  title: string
  description?: string
  recordedAt: Timestamp
}

export interface FeedIntervalRule {
  upToMl: number | null  // null = catch-all "and above" (always last)
  hours: number
}

export interface FeedIntervalSettings {
  breastHours: number
  bottleHours: number
  formulaRules: FeedIntervalRule[]
}
