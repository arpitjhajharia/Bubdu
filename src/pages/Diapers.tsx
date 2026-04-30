import { useEffect, useState } from 'react'
import { Baby, Trash2, Plus, X, PenLine } from 'lucide-react'
import {
  subscribeDiapers, addDiaper, deleteDiaper,
  formatTime, formatDate, timeAgo,
  makeTimestamp, todayInputDate, nowInputTime,
} from '@/lib/firestore'
import type { DiaperLog, DiaperType } from '@/lib/types'

const DIAPER_OPTIONS: { type: DiaperType; emoji: string; label: string; color: string }[] = [
  { type: 'wet',   emoji: '💧', label: 'Wet',      color: 'bg-blue-100 text-blue-700' },
  { type: 'dirty', emoji: '💩', label: 'Dirty',    color: 'bg-yellow-100 text-yellow-700' },
  { type: 'both',  emoji: '🔄', label: 'Both',     color: 'bg-orange-100 text-orange-700' },
  { type: 'dry',   emoji: '✅', label: 'Dry/Clean', color: 'bg-green-100 text-green-700' },
]

export default function Diapers() {
  const [logs, setLogs] = useState<DiaperLog[]>([])
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    return subscribeDiapers(50, setLogs)
  }, [])

  const today = new Date().toDateString()
  const todayCount = logs.filter(l => l.changedAt.toDate().toDateString() === today).length

  const grouped = logs.reduce<Record<string, DiaperLog[]>>((acc, log) => {
    const day = formatDate(log.changedAt)
    if (!acc[day]) acc[day] = []
    acc[day].push(log)
    return acc
  }, {})

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-purple-900">Diapers</h1>
          <p className="text-sm text-purple-400">{todayCount} changes today</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-purple-600 text-white rounded-full p-3 shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={22} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-6">
        {DIAPER_OPTIONS.map(o => {
          const count = logs.filter(l => l.changedAt.toDate().toDateString() === today && l.type === o.type).length
          return (
            <div key={o.type} className={`rounded-2xl p-3 text-center ${o.color}`}>
              <p className="text-xl">{o.emoji}</p>
              <p className="text-lg font-bold">{count}</p>
              <p className="text-xs">{o.label}</p>
            </div>
          )
        })}
      </div>

      {logs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Baby size={40} className="mx-auto mb-3 opacity-30" />
          <p>No diaper changes logged yet</p>
        </div>
      )}

      {Object.entries(grouped).map(([day, dayLogs]) => (
        <div key={day} className="mb-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{day}</p>
          <div className="space-y-2">
            {dayLogs.map(log => {
              const opt = DIAPER_OPTIONS.find(o => o.type === log.type)!
              return (
                <div key={log.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <span className="text-2xl">{opt.emoji}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{opt.label}</p>
                    {log.notes && <p className="text-xs text-gray-400">{log.notes}</p>}
                  </div>
                  <div className="text-right mr-2">
                    <p className="text-sm font-medium text-gray-700">{formatTime(log.changedAt)}</p>
                    <p className="text-xs text-gray-400">{timeAgo(log.changedAt)}</p>
                  </div>
                  <button onClick={() => deleteDiaper(log.id)} className="text-gray-300 active:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {showModal && <DiaperModal onClose={() => setShowModal(false)} />}
    </div>
  )
}

function DiaperModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<DiaperType>('wet')
  const [notes, setNotes] = useState('')
  const [manual, setManual] = useState(false)
  const [manualDate, setManualDate] = useState(todayInputDate())
  const [manualTime, setManualTime] = useState(nowInputTime())
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const ts = manual ? makeTimestamp(manualDate, manualTime) : undefined
    await addDiaper(selected, notes || undefined, ts)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6 pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-purple-900">Log Diaper Change</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {DIAPER_OPTIONS.map(o => (
            <button
              key={o.type}
              onClick={() => setSelected(o.type)}
              className={`flex items-center gap-3 p-4 rounded-2xl border-2 transition-all ${
                selected === o.type ? 'border-purple-500 bg-purple-50' : 'border-transparent bg-gray-50'
              }`}
            >
              <span className="text-2xl">{o.emoji}</span>
              <span className="font-medium text-gray-800">{o.label}</span>
            </button>
          ))}
        </div>

        <input
          type="text"
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full border border-purple-200 rounded-xl px-4 py-3 mb-3 focus:outline-none focus:border-purple-500"
        />

        {/* Manual time toggle */}
        <button
          onClick={() => setManual(m => !m)}
          className="w-full flex items-center justify-center gap-2 text-sm text-purple-500 py-2 mb-3"
        >
          <PenLine size={15} />
          {manual ? 'Use current time' : 'Missed it? Set the time'}
        </button>

        {manual && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="text-sm text-gray-500 block mb-1">Date</label>
              <input
                type="date"
                value={manualDate}
                onChange={e => setManualDate(e.target.value)}
                className="w-full border border-purple-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500"
              />
            </div>
            <div className="flex-1">
              <label className="text-sm text-gray-500 block mb-1">Time</label>
              <input
                type="time"
                value={manualTime}
                onChange={e => setManualTime(e.target.value)}
                className="w-full border border-purple-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Change'}
        </button>
      </div>
    </div>
  )
}
