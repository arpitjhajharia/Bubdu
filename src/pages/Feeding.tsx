import { useEffect, useState } from 'react'
import { Milk, Trash2, Pencil, Plus, X, Clock } from 'lucide-react'
import {
  subscribeFeedings, addFeeding, updateFeeding, deleteFeeding,
  formatTime, formatDate, feedCountdownLabel,
  makeTimestamp, todayInputDate, nowInputTime,
} from '@/lib/firestore'
import type { FeedingLog, FeedType, BreastSide } from '@/lib/types'
import type { Timestamp } from 'firebase/firestore'

function tsToDate(ts: Timestamp): string {
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tsToTime(ts: Timestamp): string {
  const d = ts.toDate()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function logEndTime(log: FeedingLog): string {
  const endMs = log.startedAt.toDate().getTime() + (log.durationMin ?? 0) * 60000
  const d = new Date(endMs)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Feeding() {
  const [logs, setLogs] = useState<FeedingLog[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingLog, setEditingLog] = useState<FeedingLog | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const unsub = subscribeFeedings(30, setLogs)
    const timer = setInterval(() => setTick(t => t + 1), 30000)
    return () => { unsub(); clearInterval(timer) }
  }, [])

  void tick

  const lastFeed = logs[0] ?? null
  const countdown = lastFeed ? feedCountdownLabel(lastFeed) : null

  const grouped = logs.reduce<Record<string, FeedingLog[]>>((acc, log) => {
    const day = formatDate(log.startedAt)
    if (!acc[day]) acc[day] = []
    acc[day].push(log)
    return acc
  }, {})

  return (
    <div className="px-4 py-4">
      {countdown && (
        <div className={`rounded-2xl p-3 mb-3 flex items-center gap-2.5 ${
          countdown.overdue ? 'bg-red-50 border border-red-200' :
          countdown.urgent ? 'bg-orange-50 border border-orange-200' :
          'bg-purple-50 border border-purple-100'
        }`}>
          <Clock size={18} className={countdown.overdue ? 'text-red-500' : countdown.urgent ? 'text-orange-500' : 'text-purple-600'} />
          <div>
            <p className="text-xs text-gray-500">Next feed in</p>
            <p className={`text-lg font-bold tabular-nums ${countdown.overdue ? 'text-red-600' : countdown.urgent ? 'text-orange-600' : 'text-purple-800'}`}>
              {countdown.overdue ? `⚠ ${countdown.label}` : countdown.label}
            </p>
          </div>
          <p className="ml-auto text-xs text-gray-400">2h from last feed</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-purple-900">Feeding</h1>
          <p className="text-sm text-purple-400">{logs.length} logs</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="bg-purple-600 text-white rounded-full p-2.5 shadow-lg active:scale-95 transition-transform">
          <Plus size={20} />
        </button>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <Milk size={36} className="mx-auto mb-2.5 opacity-30" />
          <p>No feeds logged yet</p>
        </div>
      )}

      {Object.entries(grouped).map(([day, dayLogs]) => (
        <div key={day} className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{day}</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {dayLogs.map((log, i) => {
              const icon = log.type === 'breast' ? '🤱' : log.type === 'bottle' ? '🍼' : '🥛'
              const detail = log.type === 'breast'
                ? `${log.side ?? ''} · ${log.durationMin ?? 0} min`
                : `${log.amountMl ?? '?'} ml`
              return (
                <div key={log.id} className={`flex items-center px-3 py-2.5 gap-2.5 ${i < dayLogs.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <p className="text-xs font-medium text-gray-400 w-14 shrink-0">{formatTime(log.startedAt)}</p>
                  <span className="text-base shrink-0">{icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 capitalize">{log.type}</p>
                    <p className="text-xs text-gray-400">{detail}</p>
                  </div>
                  <button onClick={() => setEditingLog(log)} className="text-gray-300 active:text-purple-500 transition-colors shrink-0">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteFeeding(log.id)} className="text-gray-300 active:text-red-500 transition-colors shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {showModal && <FeedModal onClose={() => setShowModal(false)} />}
      {editingLog && <FeedModal existing={editingLog} onClose={() => setEditingLog(null)} />}
    </div>
  )
}

function FeedModal({ onClose, existing }: { onClose: () => void; existing?: FeedingLog }) {
  const [type, setType] = useState<FeedType>(existing?.type ?? 'breast')
  const [side, setSide] = useState<BreastSide>(existing?.side ?? 'left')
  const [amountMl, setAmountMl] = useState(existing?.amountMl ? String(existing.amountMl) : '')
  const [date, setDate] = useState(existing ? tsToDate(existing.startedAt) : todayInputDate())
  const [startTime, setStartTime] = useState(existing ? tsToTime(existing.startedAt) : nowInputTime())
  const [endTime, setEndTime] = useState(existing ? logEndTime(existing) : nowInputTime())
  const [saving, setSaving] = useState(false)

  function durationMins(): number {
    const [sh, sm] = startTime.split(':').map(Number)
    const [eh, em] = endTime.split(':').map(Number)
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm))
  }

  async function handleSave() {
    setSaving(true)
    const dur = durationMins()
    const data = {
      type,
      ...(type === 'breast' ? { side } : {}),
      ...(type !== 'breast' && amountMl ? { amountMl: Number(amountMl) } : {}),
      startedAt: makeTimestamp(date, startTime),
      ...(dur > 0 ? { durationMin: dur } : {}),
    }
    if (existing) {
      await updateFeeding(existing.id, data)
    } else {
      await addFeeding(data)
    }
    onClose()
  }

  const inputCls = 'w-full border border-purple-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-500'

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-5 pb-8"
        onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-purple-900">{existing ? 'Edit Feeding' : 'Log Feeding'}</h2>
          <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>

        {/* Feed type */}
        <div className="flex gap-2 mb-3">
          {(['breast', 'bottle', 'formula'] as FeedType[]).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                type === t ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
              }`}>
              {t === 'breast' ? '🤱' : t === 'bottle' ? '🍼' : '🥛'} {t}
            </button>
          ))}
        </div>

        {/* Side (breast only) */}
        {type === 'breast' && (
          <>
            <p className="text-xs text-gray-500 mb-1.5">Side</p>
            <div className="flex gap-2 mb-3">
              {(['left', 'right', 'both'] as BreastSide[]).map(s => (
                <button key={s} onClick={() => setSide(s)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${
                    side === s ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
                  }`}>{s}</button>
              ))}
            </div>
          </>
        )}

        {/* Amount (bottle / formula only) */}
        {(type === 'bottle' || type === 'formula') && (
          <div className="mb-3">
            <label className="text-xs text-gray-500 block mb-1">Amount (ml)</label>
            <input type="number" value={amountMl} onChange={e => setAmountMl(e.target.value)}
              placeholder="e.g. 90" className={`${inputCls} text-lg`} />
          </div>
        )}

        {/* Date */}
        <div className="mb-2.5">
          <label className="text-xs text-gray-500 block mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inputCls} />
        </div>

        {/* Start & end time */}
        <div className="flex gap-2.5 mb-2.5">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Start time</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">End time</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inputCls} />
          </div>
        </div>

        {durationMins() > 0 && (
          <p className="text-sm text-purple-600 text-center font-medium mb-2">Duration: {durationMins()} min</p>
        )}

        <button onClick={handleSave} disabled={saving}
          className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-semibold mt-1 disabled:opacity-50">
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Save Feed'}
        </button>
      </div>
    </div>
  )
}
