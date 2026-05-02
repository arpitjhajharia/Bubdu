import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, Check } from 'lucide-react'
import {
  subscribeNazar, markNazarDone, unmarkNazar,
  subscribeMassage, markMassageDone, unmarkMassage,
  todayInputDate,
} from '@/lib/firestore'
import type { NazarLog, MassageLog } from '@/lib/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

export default function Daily() {
  const [nazarLogs, setNazarLogs] = useState<NazarLog[]>([])
  const [massageLogs, setMassageLogs] = useState<MassageLog[]>([])
  const today = todayInputDate()

  useEffect(() => {
    const unsubs = [
      subscribeNazar(setNazarLogs),
      subscribeMassage(setMassageLogs),
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  const nazarDoneSet = new Set(nazarLogs.map(l => l.date))
  const massageDoneSet = new Set(massageLogs.map(l => l.date))

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold text-purple-900 mb-4">Daily Routines</h1>

      <DailyCalendar
        title="Nazar"
        emoji="🧿"
        today={today}
        doneSet={nazarDoneSet}
        onToggle={async date => {
          if (nazarDoneSet.has(date)) await unmarkNazar(date)
          else await markNazarDone(date)
        }}
      />

      <DailyCalendar
        title="Massage"
        emoji="💆"
        today={today}
        doneSet={massageDoneSet}
        onToggle={async date => {
          if (massageDoneSet.has(date)) await unmarkMassage(date)
          else await markMassageDone(date)
        }}
      />

      <div className="flex gap-5 mt-1 px-1">
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

function DailyCalendar({ title, emoji, today, doneSet, onToggle }: {
  title: string
  emoji: string
  today: string
  doneSet: Set<string>
  onToggle: (date: string) => Promise<void>
}) {
  const now = new Date()
  const [viewYear, setViewYear] = useState(now.getFullYear())
  const [viewMonth, setViewMonth] = useState(now.getMonth())

  const isDoneToday = doneSet.has(today)
  const isCurrentMonth = viewYear === now.getFullYear() && viewMonth === now.getMonth()

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (isCurrentMonth) return
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function toYMD(d: number): string {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const firstDay = new Date(viewYear, viewMonth, 1)
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const startOffset = (firstDay.getDay() + 6) % 7

  const cells: (number | null)[] = [
    ...Array<null>(startOffset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <div>
            <p className="font-bold text-gray-800 text-sm">{title}</p>
            <p className={`text-xs ${isDoneToday ? 'text-green-500' : 'text-gray-400'}`}>
              {isDoneToday ? 'Done today ✓' : 'Not done today'}
            </p>
          </div>
        </div>
        <button
          onClick={() => onToggle(today)}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform ${
            isDoneToday ? 'bg-green-100 text-green-700' : 'bg-purple-600 text-white shadow'
          }`}
        >
          {isDoneToday ? '✓ Done' : 'Mark Done'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-3">
        <div className="flex items-center justify-between mb-2">
          <button onClick={prevMonth} className="p-1.5 text-gray-400 active:text-purple-600 transition-colors">
            <ChevronLeft size={17} />
          </button>
          <p className="font-semibold text-gray-800 text-sm">{MONTHS[viewMonth]} {viewYear}</p>
          <button
            onClick={nextMonth}
            disabled={isCurrentMonth}
            className="p-1.5 text-gray-400 active:text-purple-600 transition-colors disabled:opacity-20"
          >
            <ChevronRight size={17} />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {DAY_LABELS.map(d => (
            <p key={d} className="text-center text-[10px] font-semibold text-gray-400 py-0.5">{d}</p>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) return <div key={`e${i}`} className="h-9" />
            const ymd = toYMD(day)
            const isFuture = ymd > today
            const isToday = ymd === today
            const isDone = doneSet.has(ymd)

            if (isFuture) {
              return (
                <div key={ymd} className="h-9 flex items-center justify-center">
                  <span className="text-xs text-gray-300">{day}</span>
                </div>
              )
            }

            return (
              <button key={ymd} onClick={() => onToggle(ymd)} className="h-9 flex items-center justify-center">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors
                  ${isDone ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
                  ${isToday ? 'ring-2 ring-offset-1 ring-purple-500' : ''}
                `}>
                  {isDone ? <Check size={12} strokeWidth={3} /> : day}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
