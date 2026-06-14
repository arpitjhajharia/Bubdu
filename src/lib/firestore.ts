import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  query,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  where,
} from 'firebase/firestore'
import { db } from './firebase'
import type { FeedingLog, DiaperLog, Medicine, MedicineLog, GrowthLog, WeightLog, BabyProfile, BabySex, AgeFormat, NazarLog, MassageLog, IncidentLog, FeedIntervalSettings, FeedIntervalRule, FeedType, BreastSide, DiaperType, MedicineFor } from './types'

// ── Feeding ──────────────────────────────────────────────────────────────────

export function subscribeFeedings(count: number | null, callback: (logs: FeedingLog[]) => void) {
  const constraints = count != null
    ? [orderBy('startedAt', 'desc'), limit(count)]
    : [orderBy('startedAt', 'desc')]
  const q = query(collection(db, 'feedingLogs'), ...constraints)
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
  startedAt?: Timestamp
}) {
  const { startedAt, ...rest } = data
  await addDoc(collection(db, 'feedingLogs'), {
    ...rest,
    startedAt: startedAt ?? Timestamp.now(),
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

export async function addDiaper(type: DiaperType, notes?: string, changedAt?: Timestamp) {
  await addDoc(collection(db, 'diaperLogs'), {
    type,
    changedAt: changedAt ?? Timestamp.now(),
    ...(notes ? { notes } : {}),
  })
}

export async function updateDiaper(id: string, data: Partial<DiaperLog>) {
  await updateDoc(doc(db, 'diaperLogs', id), data)
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

// Loads logs from the past 30 days to support backdating missed doses
export function subscribeMedicineLogs(callback: (logs: MedicineLog[]) => void) {
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const q = query(
    collection(db, 'medicineLogs'),
    where('givenAt', '>=', Timestamp.fromDate(thirtyDaysAgo)),
    orderBy('givenAt', 'desc')
  )
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MedicineLog))
  )
}

export async function logMedicine(medicine: Medicine, doseLabel: string, givenAt?: Timestamp) {
  await addDoc(collection(db, 'medicineLogs'), {
    medicineId: medicine.id,
    medicineName: medicine.name,
    medicineFor: medicine.for,
    doseLabel,
    givenAt: givenAt ?? Timestamp.now(),
  })
}

export async function deleteMedicineLog(id: string) {
  await deleteDoc(doc(db, 'medicineLogs', id))
}

// ── Dose status helpers ───────────────────────────────────────────────────────

export function isDoseGivenToday(logs: MedicineLog[], medicineId: string, doseLabel: string): boolean {
  return isDoseGivenOnDate(logs, medicineId, doseLabel, toYMD(new Date()))
}

export function isDoseGivenOnDate(logs: MedicineLog[], medicineId: string, doseLabel: string, date: string): boolean {
  const checkDate = new Date(date + 'T00:00:00').toDateString()
  return logs.some(l =>
    l.medicineId === medicineId &&
    l.doseLabel === doseLabel &&
    l.givenAt.toDate().toDateString() === checkDate
  )
}

// Returns the HH:MM current time string for comparison
function nowTime(): string {
  const n = new Date()
  return `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
}

export type DoseStatus = 'given' | 'upcoming' | 'overdue' | 'later'

export function getDoseStatus(
  logs: MedicineLog[],
  medicineId: string,
  doseLabel: string,
  doseTime: string,
  date?: string  // 'YYYY-MM-DD'; defaults to today
): DoseStatus {
  const selectedDate = date ?? toYMD(new Date())
  if (isDoseGivenOnDate(logs, medicineId, doseLabel, selectedDate)) return 'given'
  const today = toYMD(new Date())
  if (selectedDate < today) return 'overdue'  // past date, not given = missed
  const now = nowTime()
  if (doseTime <= now) return 'overdue'
  // "upcoming" = due in the next 30 min
  const [dh, dm] = doseTime.split(':').map(Number)
  const [nh, nm] = now.split(':').map(Number)
  const diffMins = (dh * 60 + dm) - (nh * 60 + nm)
  return diffMins <= 30 ? 'upcoming' : 'later'
}

// ── Schedule helpers ──────────────────────────────────────────────────────────

function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function getEndDate(medicine: Medicine): string | null {
  if (!medicine.repetitions) return null  // ongoing
  const start = new Date(medicine.startDate)
  if (medicine.repeatSchedule === 'daily') {
    start.setDate(start.getDate() + medicine.repetitions - 1)
  } else {
    start.setDate(start.getDate() + (medicine.repetitions - 1) * 7)
  }
  return toYMD(start)
}

export function isCourseComplete(medicine: Medicine): boolean {
  const end = getEndDate(medicine)
  if (!end) return false
  return toYMD(new Date()) > end
}

export function isCourseStarted(medicine: Medicine): boolean {
  return toYMD(new Date()) >= medicine.startDate
}

// For weekly: is the given date (default: today) the scheduled day of week?
export function isWeeklyDueToday(medicine: Medicine, date?: string): boolean {
  const checkDate = date ? new Date(date + 'T00:00:00') : new Date()
  return new Date(medicine.startDate).getDay() === checkDate.getDay()
}

// Returns { current, total, unit } — e.g. { current: 3, total: 7, unit: 'day' }
export function getCourseProgress(medicine: Medicine): { current: number; total: number; unit: string } {
  const start = new Date(medicine.startDate)
  const today = new Date()
  start.setHours(0, 0, 0, 0); today.setHours(0, 0, 0, 0)
  const diffDays = Math.max(0, Math.floor((today.getTime() - start.getTime()) / 86400000))
  if (medicine.repeatSchedule === 'daily') {
    return { current: Math.min(diffDays + 1, medicine.repetitions || 9999), total: medicine.repetitions, unit: 'day' }
  }
  return { current: Math.min(Math.floor(diffDays / 7) + 1, medicine.repetitions || 9999), total: medicine.repetitions, unit: 'week' }
}

// Next weekly due date as a readable string
export function nextWeeklyDueLabel(medicine: Medicine): string {
  const start = new Date(medicine.startDate)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dayOfWeek = start.getDay()
  const todayDay = today.getDay()
  let daysUntil = dayOfWeek - todayDay
  if (daysUntil <= 0) daysUntil += 7
  const next = new Date(today); next.setDate(today.getDate() + daysUntil)
  return next.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })
}

export function formatShortDate(ymd: string): string {
  return new Date(ymd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Returns true if any dose is overdue today (schedule-aware)
export function hasMedicineOverdue(logs: MedicineLog[], medicine: Medicine): boolean {
  if (!medicine.active) return false
  if (!isCourseStarted(medicine)) return false
  if (isCourseComplete(medicine)) return false
  if (medicine.repeatSchedule === 'weekly' && !isWeeklyDueToday(medicine)) return false
  return medicine.doseTimes.some(d => getDoseStatus(logs, medicine.id, d.label, d.time) === 'overdue')
}

// Formats 'HH:MM' (24h) to '10:00 AM'
export function formatDoseTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
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

export const DEFAULT_FEED_SETTINGS: FeedIntervalSettings = {
  breastHours: 2.5,
  bottleHours: 2.5,
  formulaRules: [
    { upToMl: 40, hours: 2 },
    { upToMl: 50, hours: 2.5 },
    { upToMl: null, hours: 3 },
  ],
}

export function subscribeFeedSettings(callback: (s: FeedIntervalSettings) => void) {
  return onSnapshot(doc(db, 'settings', 'feedIntervals'), snap => {
    callback(snap.exists() ? (snap.data() as FeedIntervalSettings) : DEFAULT_FEED_SETTINGS)
  })
}

export async function saveFeedSettings(s: FeedIntervalSettings) {
  await setDoc(doc(db, 'settings', 'feedIntervals'), s)
}

// Returns hours until next feed based on type and amount
export function feedIntervalHours(log: FeedingLog, settings: FeedIntervalSettings = DEFAULT_FEED_SETTINGS): number {
  if (log.type === 'breast') return settings.breastHours
  if (log.type === 'bottle') return settings.bottleHours
  const ml = log.amountMl ?? 0
  for (const rule of settings.formulaRules) {
    if (rule.upToMl === null || ml <= rule.upToMl) return rule.hours
  }
  return settings.formulaRules[settings.formulaRules.length - 1]?.hours ?? 3
}

export function feedIntervalLabel(log: FeedingLog, settings: FeedIntervalSettings = DEFAULT_FEED_SETTINGS): string {
  const h = feedIntervalHours(log, settings)
  return Number.isInteger(h) ? `${h}h` : `${h}h`
}

// Returns the Date when the next feed is due
export function nextFeedDue(log: FeedingLog, settings: FeedIntervalSettings = DEFAULT_FEED_SETTINGS): Date {
  const startMs = log.startedAt.toDate().getTime()
  const durationMs = (log.durationMin ?? 0) * 60000
  return new Date(startMs + durationMs + feedIntervalHours(log, settings) * 3600000)
}

// Returns { label, overdue, urgent } for display
export function feedCountdownLabel(log: FeedingLog, settings: FeedIntervalSettings = DEFAULT_FEED_SETTINGS): { label: string; overdue: boolean; urgent: boolean } {
  const diffMs = nextFeedDue(log, settings).getTime() - Date.now()
  if (diffMs <= 0) {
    const overdueMins = Math.floor(-diffMs / 60000)
    const h = Math.floor(overdueMins / 60)
    const m = overdueMins % 60
    return { label: h > 0 ? `${h}h ${m}m overdue` : `${overdueMins}m overdue`, overdue: true, urgent: true }
  }
  const mins = Math.floor(diffMs / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return {
    label: h > 0 ? `${h}h ${m}m` : `${m}m`,
    overdue: false,
    urgent: mins <= 20,
  }
}

// Builds a Firestore Timestamp from a date string ('YYYY-MM-DD') and time string ('HH:MM')
export function makeTimestamp(dateStr: string, timeStr: string): Timestamp {
  const [y, mo, d] = dateStr.split('-').map(Number)
  const [h, m] = timeStr.split(':').map(Number)
  return Timestamp.fromDate(new Date(y, mo - 1, d, h, m))
}

export function todayInputDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function nowInputTime(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ── Growth (weight + length) ───────────────────────────────────────────────────
// Stored in the `weightLogs` collection (name kept for data continuity); each
// doc may carry weightKg and/or lengthCm.

export function subscribeGrowth(callback: (logs: GrowthLog[]) => void) {
  const q = query(collection(db, 'weightLogs'), orderBy('recordedAt', 'desc'))
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as GrowthLog))
  )
}

export async function addGrowth(data: { weightKg?: number; lengthCm?: number; notes?: string; recordedAt?: Timestamp }) {
  await addDoc(collection(db, 'weightLogs'), {
    recordedAt: data.recordedAt ?? Timestamp.now(),
    ...(data.weightKg != null ? { weightKg: data.weightKg } : {}),
    ...(data.lengthCm != null ? { lengthCm: data.lengthCm } : {}),
    ...(data.notes ? { notes: data.notes } : {}),
  })
}

export async function updateGrowth(id: string, data: Partial<GrowthLog>) {
  await updateDoc(doc(db, 'weightLogs', id), data)
}

export async function deleteGrowth(id: string) {
  await deleteDoc(doc(db, 'weightLogs', id))
}

// Backward-compatible aliases (older imports)
export const subscribeWeights = subscribeGrowth
export const deleteWeight = deleteGrowth

// ── Baby profile ────────────────────────────────────────────────────────────────

export const DEFAULT_BABY_PROFILE: BabyProfile = {
  name: 'Bubdu',
  sex: 'boy',
  birthDate: '2026-04-26',
  birthTime: '08:25',
  ageFormat: 'monthsDays',
}

export function subscribeBabyProfile(callback: (p: BabyProfile) => void) {
  return onSnapshot(doc(db, 'settings', 'babyProfile'), snap => {
    callback(snap.exists() ? { ...DEFAULT_BABY_PROFILE, ...(snap.data() as Partial<BabyProfile>) } : DEFAULT_BABY_PROFILE)
  })
}

export async function saveBabyProfile(p: BabyProfile) {
  await setDoc(doc(db, 'settings', 'babyProfile'), p)
}

// Birth instant (ms) from a profile, combining birthDate + optional birthTime.
export function birthMs(p: BabyProfile): number {
  const [y, mo, d] = p.birthDate.split('-').map(Number)
  const [h, mi] = (p.birthTime ?? '00:00').split(':').map(Number)
  return new Date(y, mo - 1, d, h, mi).getTime()
}

function plural(n: number, unit: string): string {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

// Human-readable age in the profile's chosen format: total days, weeks+days,
// or calendar months+days.
export function ageLabel(p: BabyProfile, atMs: number = Date.now()): string {
  const birth = birthMs(p)
  const days = Math.max(0, Math.floor((atMs - birth) / 86400000))
  const fmt = p.ageFormat ?? 'monthsDays'

  if (fmt === 'days') return plural(days, 'day')

  if (fmt === 'weeksDays') {
    const w = Math.floor(days / 7)
    const d = days % 7
    if (w === 0) return plural(d, 'day')
    return d > 0 ? `${plural(w, 'week')} ${plural(d, 'day')}` : plural(w, 'week')
  }

  // monthsDays — calendar-accurate (whole months elapsed, then leftover days)
  const b = new Date(birth)
  const now = new Date(atMs)
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth())
  let dayDiff = now.getDate() - b.getDate()
  if (dayDiff < 0) {
    months--
    dayDiff += new Date(now.getFullYear(), now.getMonth(), 0).getDate() // days in previous month
  }
  if (months < 0) months = 0
  if (months === 0) return plural(dayDiff, 'day')
  return dayDiff > 0 ? `${plural(months, 'month')} ${plural(dayDiff, 'day')}` : plural(months, 'month')
}

// ── Nazar ─────────────────────────────────────────────────────────────────────

export function subscribeNazar(callback: (logs: NazarLog[]) => void) {
  const q = query(collection(db, 'nazarLogs'), orderBy('date', 'desc'))
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as NazarLog))
  )
}

export async function markNazarDone(date: string) {
  await setDoc(doc(db, 'nazarLogs', date), { date, doneAt: Timestamp.now() })
}

export async function unmarkNazar(date: string) {
  await deleteDoc(doc(db, 'nazarLogs', date))
}

// ── Massage ───────────────────────────────────────────────────────────────────

export function subscribeMassage(callback: (logs: MassageLog[]) => void) {
  const q = query(collection(db, 'massageLogs'), orderBy('date', 'desc'))
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as MassageLog))
  )
}

export async function markMassageDone(date: string) {
  await setDoc(doc(db, 'massageLogs', date), { date, doneAt: Timestamp.now() })
}

export async function unmarkMassage(date: string) {
  await deleteDoc(doc(db, 'massageLogs', date))
}

// ── Incidents (Reports) ───────────────────────────────────────────────────────

export function subscribeIncidents(callback: (logs: IncidentLog[]) => void) {
  const q = query(collection(db, 'incidentLogs'), orderBy('recordedAt', 'desc'))
  return onSnapshot(q, snap =>
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() }) as IncidentLog))
  )
}

export async function addIncident(title: string, description?: string, recordedAt?: Timestamp) {
  await addDoc(collection(db, 'incidentLogs'), {
    title,
    recordedAt: recordedAt ?? Timestamp.now(),
    ...(description ? { description } : {}),
  })
}

export async function updateIncident(id: string, data: Partial<IncidentLog>) {
  await updateDoc(doc(db, 'incidentLogs', id), data)
}

export async function deleteIncident(id: string) {
  await deleteDoc(doc(db, 'incidentLogs', id))
}

export type { FeedingLog, DiaperLog, Medicine, MedicineLog, MedicineFor, GrowthLog, WeightLog, BabyProfile, BabySex, AgeFormat, NazarLog, MassageLog, IncidentLog, FeedIntervalSettings, FeedIntervalRule }
