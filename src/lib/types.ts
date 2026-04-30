import type { Timestamp } from 'firebase/firestore'

export type FeedType = 'breast' | 'bottle' | 'formula'
export type BreastSide = 'left' | 'right' | 'both'
export type DiaperType = 'wet' | 'dirty' | 'both' | 'dry'
export type MedicineFor = 'baby' | 'mother'

export interface DoseTime {
  label: string  // 'Morning', 'Lunch', 'Night', etc.
  time: string   // 'HH:MM' in 24h format, e.g. '10:00'
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
