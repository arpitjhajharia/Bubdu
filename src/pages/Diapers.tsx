import { useEffect, useState } from 'react'
import { Baby, Trash2, Pencil, Plus, X } from 'lucide-react'
import {
  subscribeDiapers, addDiaper, updateDiaper, deleteDiaper,
  formatTime, formatDate,
  makeTimestamp, todayInputDate, nowInputTime,
} from '@/lib/firestore'
import type { DiaperLog, DiaperType } from '@/lib/types'
import type { Timestamp } from 'firebase/firestore'

function tsToDate(ts: Timestamp): string {
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tsToTime(ts: Timestamp): string {
  const d = ts.toDate()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const DIAPER_OPTIONS: { type: DiaperType; emoji: string; label: string; color: string }[] = [
  { type: 'wet',   emoji: '💧', label: 'Wet',      color: 'bg-blue-100 text-blue-700' },
  { type: 'dirty', emoji: '💩', label: 'Dirty',    color: 'bg-yellow-100 text-yellow-700' },
  { type: 'both',  emoji: '🔄', label: 'Both',     color: 'bg-orange-100 text-orange-700' },
  { type: 'dry',   emoji: '✅', label: 'Dry/Clean', color: 'bg-green-100 text-green-700' },
]

export default function Diapers() {
  const [logs, setLogs] = useState<DiaperLog[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingLog, setEditingLog] = useState<DiaperLog | null>(null)

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
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-purple-900">Diapers</h1>
          <p className="text-sm text-purple-400">{todayCount} changes today</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-purple-600 text-white rounded-full p-2.5 shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {DIAPER_OPTIONS.map(o => {
          const count = logs.filter(l => l.changedAt.toDate().toDateString() === today && l.type === o.type).length
          return (
            <div key={o.type} className={`rounded-2xl p-2.5 text-center ${o.color}`}>
              <p className="text-lg">{o.emoji}</p>
              <p className="text-base font-bold">{count}</p>
              <p className="text-xs">{o.label}</p>
            </div>
          )
        })}
      </div>

      {logs.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <Baby size={36} className="mx-auto mb-2.5 opacity-30" />
          <p>No diaper changes logged yet</p>
        </div>
      )}

      {Object.entries(grouped).map(([day, dayLogs]) => (
        <div key={day} className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{day}</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {dayLogs.map((log, i) => {
              const opt = DIAPER_OPTIONS.find(o => o.type === log.type)!
              return (
                <div key={log.id} className={`flex items-center px-3 py-2.5 gap-2.5 ${i < dayLogs.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <p className="text-xs font-medium text-gray-400 w-14 shrink-0">{formatTime(log.changedAt)}</p>
                  <span className="text-base shrink-0">{opt.emoji}</span>
                  <p className="text-sm font-medium text-gray-800 flex-1">
                    {opt.label}
                    {log.notes && <span className="text-xs text-gray-400 font-normal ml-1">· {log.notes}</span>}
                  </p>
                  <button onClick={() => setEditingLog(log)} className="text-gray-300 active:text-purple-500 transition-colors shrink-0">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteDiaper(log.id)} className="text-gray-300 active:text-red-500 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {showModal && <DiaperModal onClose={() => setShowModal(false)} />}
      {editingLog && <DiaperModal existing={editingLog} onClose={() => setEditingLog(null)} />}
    </div>
  )
}

function DiaperModal({ onClose, existing }: { onClose: () => void; existing?: DiaperLog }) {
  const [selected, setSelected] = useState<DiaperType>(existing?.type ?? 'wet')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [date, setDate] = useState(existing ? tsToDate(existing.changedAt) : todayInputDate())
  const [time, setTime] = useState(existing ? tsToTime(existing.changedAt) : nowInputTime())
  const [saving, setSaving] = useState(false)

  const inputCls = 'w-full border border-purple-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-500'

  async function handleSave() {
    setSaving(true)
    const ts = makeTimestamp(date, time)
    if (existing) {
      await updateDiaper(existing.id, {
        type: selected,
        changedAt: ts,
        ...(notes ? { notes } : {}),
      })
    } else {
      await addDiaper(selected, notes || undefined, ts)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-purple-900">{existing ? 'Edit Diaper Change' : 'Log Diaper Change'}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          {DIAPER_OPTIONS.map(o => (
            <button
              key={o.type}
              onClick={() => setSelected(o.type)}
              className={`flex items-center gap-2.5 p-3 rounded-2xl border-2 transition-all ${
                selected === o.type ? 'border-purple-500 bg-purple-50' : 'border-transparent bg-gray-50'
              }`}
            >
              <span className="text-xl">{o.emoji}</span>
              <span className="font-medium text-sm text-gray-800">{o.label}</span>
            </button>
          ))}
        </div>

        <input
          type="text" value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className={`${inputCls} mb-3`}
        />

        <div className="flex gap-2.5 mb-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Time</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className={inputCls} />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Save Change'}
        </button>
      </div>
    </div>
  )
}
