import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { subscribeNazar, markNazarDone, unmarkNazar, todayInputDate } from '@/lib/firestore'
import type { NazarLog } from '@/lib/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function Nazar() {
  const [logs, setLogs] = useState<NazarLog[]>([])
  const today = todayInputDate()
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  useEffect(() => subscribeNazar(setLogs), [])

  const doneSet = new Set(logs.map(l => l.date))
  const isDoneToday = doneSet.has(today)

  async function toggle(date: string) {
    if (doneSet.has(date)) await unmarkNazar(date)
    else await markNazarDone(date)
  }

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth())) return
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  const firstDay = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7  // Monday = 0

  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  function toYMD(d: number): string {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-purple-900">🧿 Nazar</h1>
          <p className={`text-sm ${isDoneToday ? 'text-green-500' : 'text-purple-400'}`}>
            {isDoneToday ? 'Done today ✓' : 'Not done today'}
          </p>
        </div>
        <button
          onClick={() => toggle(today)}
          className={`px-4 py-2 rounded-full text-sm font-semibold active:scale-95 transition-transform ${
            isDoneToday
              ? 'bg-green-100 text-green-700'
              : 'bg-purple-600 text-white shadow-lg'
          }`}
        >
          {isDoneToday ? '✓ Done' : 'Mark Done'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="p-1.5 text-gray-400 active:text-purple-600 transition-colors">
            <ChevronLeft size={18} />
          </button>
          <p className="font-semibold text-gray-800 text-sm">{MONTHS[viewMonth]} {viewYear}</p>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1.5 text-gray-400 active:text-purple-600 transition-colors disabled:opacity-20"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map(d => (
            <p key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</p>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className="h-10" />
            const ymd = toYMD(day)
            const isFuture = ymd > today
            const isToday = ymd === today
            const isDone = doneSet.has(ymd)

            if (isFuture) {
              return (
                <div key={ymd} className="h-10 flex items-center justify-center">
                  <span className="text-sm text-gray-300">{day}</span>
                </div>
              )
            }

            return (
              <button key={ymd} onClick={() => toggle(ymd)} className="h-10 flex items-center justify-center">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                  ${isDone ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
                  ${isToday ? 'ring-2 ring-offset-1 ring-purple-500' : ''}
                `}>
                  {isDone ? <Check size={13} strokeWidth={3} /> : day}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-5 mt-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          <span className="text-xs text-gray-400">Done</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          <span className="text-xs text-gray-400">Missed</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-gray-300 font-medium leading-none">7</span>
          <span className="text-xs text-gray-400">Upcoming</span>
        </div>
      </div>
    </div>
  )
}
