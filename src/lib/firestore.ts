import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  where,
  getDocs,
} from 'firebase/firestore'
import { db } from './firebase'
import type { FeedingLog, DiaperLog, Medicine, MedicineLog, FeedType, BreastSide, DiaperType, MedicineFor } from './types'

// ── Feeding ──────────────────────────────────────────────────────────────────

export function subscribeFeedings(count: number, callback: (logs: FeedingLog[]) => void) {
  const q = query(collection(db, 'feedingLogs'), orderBy('startedAt', 'desc'), limit(count))
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as FeedingLog))
  )
}

export async function addFeeding(data: {
  type: FeedType
  side?: BreastSide
  durationMin?: number
  amountMl?: number
  notes?: string
}) {
  await addDoc(collection(db, 'feedingLogs'), {
    ...data,
    startedAt: Timestamp.now(),
  })
}

export async function updateFeeding(id: string, data: Partial<FeedingLog>) {
  await updateDoc(doc(db, 'feedingLogs', id), data)
}

export async function deleteFeeding(id: string) {
  await deleteDoc(doc(db, 'feedingLogs', id))
}

// ── Diapers ──────────────────────────────────────────────────────────────────

export function subscribeDiapers(count: number, callback: (logs: DiaperLog[]) => void) {
  const q = query(collection(db, 'diaperLogs'), orderBy('changedAt', 'desc'), limit(count))
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as DiaperLog))
  )
}

export async function addDiaper(type: DiaperType, notes?: string) {
  await addDoc(collection(db, 'diaperLogs'), {
    type,
    changedAt: Timestamp.now(),
    ...(notes ? { notes } : {}),
  })
}

export async function deleteDiaper(id: string) {
  await deleteDoc(doc(db, 'diaperLogs', id))
}

// ── Medicines ─────────────────────────────────────────────────────────────────

export function subscribeMedicines(callback: (meds: Medicine[]) => void) {
  const q = query(collection(db, 'medicines'), orderBy('name'))
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as Medicine))
  )
}

export async function addMedicine(data: Omit<Medicine, 'id'>) {
  await addDoc(collection(db, 'medicines'), data)
}

export async function updateMedicine(id: string, data: Partial<Medicine>) {
  await updateDoc(doc(db, 'medicines', id), data)
}

export async function deleteMedicine(id: string) {
  await deleteDoc(doc(db, 'medicines', id))
}

// ── Medicine Logs ─────────────────────────────────────────────────────────────

export function subscribeMedicineLogs(count: number, callback: (logs: MedicineLog[]) => void) {
  const q = query(collection(db, 'medicineLogs'), orderBy('givenAt', 'desc'), limit(count))
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MedicineLog))
  )
}

export async function logMedicine(medicine: Medicine) {
  await addDoc(collection(db, 'medicineLogs'), {
    medicineId: medicine.id,
    medicineName: medicine.name,
    medicineFor: medicine.for,
    givenAt: Timestamp.now(),
  })
}

export async function getLastMedicineLog(medicineId: string): Promise<MedicineLog | null> {
  const q = query(
    collection(db, 'medicineLogs'),
    where('medicineId', '==', medicineId),
    orderBy('givenAt', 'desc'),
    limit(1)
  )
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as MedicineLog
}

export async function deleteMedicineLog(id: string) {
  await deleteDoc(doc(db, 'medicineLogs', id))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function formatTime(ts: Timestamp): string {
  return ts.toDate().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export function formatDate(ts: Timestamp): string {
  const d = ts.toDate()
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'Today'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export function timeAgo(ts: Timestamp): string {
  const diffMs = Date.now() - ts.toDate().getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function nextDueTime(lastTs: Timestamp, frequencyHours: number): string {
  const nextMs = lastTs.toDate().getTime() + frequencyHours * 3600000
  const diffMs = nextMs - Date.now()
  if (diffMs <= 0) return 'OVERDUE'
  const mins = Math.floor(diffMs / 60000)
  if (mins < 60) return `in ${mins}m`
  const hrs = Math.floor(mins / 60)
  return `in ${hrs}h ${mins % 60}m`

}

export type { FeedingLog, DiaperLog, Medicine, MedicineLog, MedicineFor }
