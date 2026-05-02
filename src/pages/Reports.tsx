import { useEffect, useState } from 'react'
import { ClipboardList, Trash2, Pencil, Plus, X } from 'lucide-react'
import {
  subscribeIncidents, addIncident, updateIncident, deleteIncident,
  formatTime, formatDate, makeTimestamp, todayInputDate, nowInputTime,
} from '@/lib/firestore'
import type { IncidentLog } from '@/lib/types'
import type { Timestamp } from 'firebase/firestore'

function tsToDate(ts: Timestamp): string {
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tsToTime(ts: Timestamp): string {
  const d = ts.toDate()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Reports() {
  const [logs, setLogs] = useState<IncidentLog[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingLog, setEditingLog] = useState<IncidentLog | null>(null)

  useEffect(() => subscribeIncidents(setLogs), [])

  const grouped = logs.reduce<Record<string, IncidentLog[]>>((acc, log) => {
    const day = formatDate(log.recordedAt)
    if (!acc[day]) acc[day] = []
    acc[day].push(log)
    return acc
  }, {})

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-purple-900">Reports</h1>
          <p className="text-sm text-purple-400">{logs.length} incident{logs.length !== 1 ? 's' : ''} logged</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-purple-600 text-white rounded-full p-2.5 shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <ClipboardList size={36} className="mx-auto mb-2.5 opacity-30" />
          <p>No incidents recorded yet</p>
          <p className="text-xs mt-1 text-gray-300">Log doctor visits, symptoms, tests…</p>
        </div>
      )}

      {Object.entries(grouped).map(([day, dayLogs]) => (
        <div key={day} className="mb-3">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{day}</p>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {dayLogs.map((log, i) => (
              <div
                key={log.id}
                className={`px-3 py-2.5 ${i < dayLogs.length - 1 ? 'border-b border-gray-50' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <p className="text-xs font-medium text-gray-400 w-14 shrink-0 pt-0.5">
                    {formatTime(log.recordedAt)}
                  </p>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800">{log.title}</p>
                    {log.description && (
                      <p className="text-xs text-gray-400 mt-0.5 whitespace-pre-wrap">{log.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                    <button onClick={() => setEditingLog(log)} className="text-gray-300 active:text-purple-500 transition-colors">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => deleteIncident(log.id)} className="text-gray-300 active:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {showModal && <IncidentModal onClose={() => setShowModal(false)} />}
      {editingLog && <IncidentModal existing={editingLog} onClose={() => setEditingLog(null)} />}
    </div>
  )
}

function IncidentModal({ onClose, existing }: { onClose: () => void; existing?: IncidentLog }) {
  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [date, setDate] = useState(existing ? tsToDate(existing.recordedAt) : todayInputDate())
  const [time, setTime] = useState(existing ? tsToTime(existing.recordedAt) : nowInputTime())
  const [saving, setSaving] = useState(false)

  const inputCls = 'w-full border border-purple-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-500'

  async function handleSave() {
    if (!title.trim()) return
    setSaving(true)
    const ts = makeTimestamp(date, time)
    if (existing) {
      await updateIncident(existing.id, {
        title: title.trim(),
        recordedAt: ts,
        ...(description.trim() ? { description: description.trim() } : { description: undefined }),
      })
    } else {
      await addIncident(title.trim(), description.trim() || undefined, ts)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-purple-900">
            {existing ? 'Edit Incident' : 'Log Incident'}
          </h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <label className="text-xs text-gray-500 block mb-1">Title</label>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="e.g. Doctor visit, Blood test, Vomited…"
          autoFocus={!existing}
          className={`${inputCls} mb-3`}
        />

        <label className="text-xs text-gray-500 block mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Notes, observations, doctor's advice…"
          rows={3}
          className={`${inputCls} mb-3 resize-none`}
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

        <button
          onClick={handleSave}
          disabled={saving || !title.trim()}
          className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50"
        >
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Save Incident'}
        </button>
      </div>
    </div>
  )
}
