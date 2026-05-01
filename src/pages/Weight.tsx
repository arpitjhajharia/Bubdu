import { useEffect, useState, useMemo } from 'react'
import { Scale, Trash2, Pencil, Plus, X, TrendingUp } from 'lucide-react'
import {
  subscribeWeights, addWeight, updateWeight, deleteWeight,
  formatTime, formatDate, makeTimestamp, todayInputDate, nowInputTime,
} from '@/lib/firestore'
import type { WeightLog } from '@/lib/types'
import type { Timestamp } from 'firebase/firestore'

function tsToDate(ts: Timestamp): string {
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function tsToTime(ts: Timestamp): string {
  const d = ts.toDate()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function Weight() {
  const [logs, setLogs] = useState<WeightLog[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingLog, setEditingLog] = useState<WeightLog | null>(null)

  useEffect(() => {
    return subscribeWeights(setLogs)
  }, [])

  const chronological = useMemo(() => [...logs].reverse(), [logs])

  const latest = logs[0] ?? null
  const first = chronological[0] ?? null
  const gainKg = latest && first && latest.id !== first.id
    ? +(latest.weightKg - first.weightKg).toFixed(3)
    : null

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-purple-900">Weight</h1>
          <p className="text-sm text-purple-400">
            {latest ? `Latest: ${latest.weightKg.toFixed(3)} kg` : 'No entries yet'}
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-purple-600 text-white rounded-full p-2.5 shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      {gainKg !== null && (
        <div className={`rounded-2xl px-3 py-2.5 mb-3 flex items-center gap-2.5 ${gainKg >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <TrendingUp size={16} className={gainKg >= 0 ? 'text-green-600' : 'text-red-500'} />
          <p className={`text-sm font-medium ${gainKg >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            {gainKg >= 0 ? '+' : ''}{gainKg.toFixed(3)} kg since first entry
          </p>
        </div>
      )}

      {chronological.length >= 2 && <WeightChart logs={chronological} />}

      {logs.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <Scale size={36} className="mx-auto mb-2.5 opacity-30" />
          <p>No weight entries yet</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="flex items-center px-3 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 flex-1">Date & Time</p>
            <p className="text-xs font-semibold text-gray-400 w-24 text-right pr-14">Weight</p>
          </div>
          {logs.map((log, i) => (
            <div key={log.id} className={`flex items-center px-3 py-2.5 ${i < logs.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">
                  {formatDate(log.recordedAt)} · {formatTime(log.recordedAt)}
                </p>
                {log.notes && <p className="text-xs text-gray-400 truncate">{log.notes}</p>}
              </div>
              <p className="text-sm font-bold text-purple-900 w-24 text-right">
                {log.weightKg.toFixed(3)} kg
              </p>
              <button onClick={() => setEditingLog(log)} className="ml-2 text-gray-300 active:text-purple-500 transition-colors shrink-0">
                <Pencil size={14} />
              </button>
              <button onClick={() => deleteWeight(log.id)} className="ml-1.5 text-gray-300 active:text-red-500 transition-colors shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showModal && <WeightModal onClose={() => setShowModal(false)} />}
      {editingLog && <WeightModal existing={editingLog} onClose={() => setEditingLog(null)} />}
    </div>
  )
}

function WeightChart({ logs }: { logs: WeightLog[] }) {
  const W = 320
  const H = 130
  const PAD = { top: 10, right: 14, bottom: 22, left: 38 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const weights = logs.map(l => l.weightKg)
  const minW = Math.min(...weights)
  const maxW = Math.max(...weights)
  const range = maxW - minW || 0.1

  const times = logs.map(l => l.recordedAt.toDate().getTime())
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const timeRange = maxT - minT || 1

  function x(t: number) { return PAD.left + ((t - minT) / timeRange) * innerW }
  function y(w: number) { return PAD.top + innerH - ((w - minW) / range) * innerH }

  const points = logs.map(l => `${x(l.recordedAt.toDate().getTime())},${y(l.weightKg)}`).join(' ')
  const yTicks = [minW, minW + range / 2, maxW].map(v => +v.toFixed(3))
  const fmtX = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 mb-4 overflow-x-auto">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Weight trend (kg)</p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
        {yTicks.map((v, i) => (
          <line key={i} x1={PAD.left} y1={y(v)} x2={PAD.left + innerW} y2={y(v)} stroke="#e9d5ff" strokeWidth="1" />
        ))}
        {yTicks.map((v, i) => (
          <text key={i} x={PAD.left - 5} y={y(v) + 4} textAnchor="end" fill="#9ca3af" fontSize="9">{v}</text>
        ))}
        <text x={PAD.left} y={H - 3} textAnchor="start" fill="#9ca3af" fontSize="9">{fmtX(minT)}</text>
        <text x={PAD.left + innerW} y={H - 3} textAnchor="end" fill="#9ca3af" fontSize="9">{fmtX(maxT)}</text>
        <polyline points={points} fill="none" stroke="#9333ea" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {logs.map((l, i) => (
          <circle key={i} cx={x(l.recordedAt.toDate().getTime())} cy={y(l.weightKg)} r="3" fill="#9333ea" />
        ))}
        {(() => {
          const last = logs[logs.length - 1]
          return (
            <text x={x(last.recordedAt.toDate().getTime())} y={y(last.weightKg) - 7}
              textAnchor="middle" fill="#7e22ce" fontSize="9" fontWeight="bold">
              {last.weightKg.toFixed(3)}
            </text>
          )
        })()}
      </svg>
    </div>
  )
}

function WeightModal({ onClose, existing }: { onClose: () => void; existing?: WeightLog }) {
  const [weight, setWeight] = useState(existing ? String(existing.weightKg) : '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [date, setDate] = useState(existing ? tsToDate(existing.recordedAt) : todayInputDate())
  const [time, setTime] = useState(existing ? tsToTime(existing.recordedAt) : nowInputTime())
  const [saving, setSaving] = useState(false)

  const inputCls = 'w-full border border-purple-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-500'

  async function handleSave() {
    const kg = parseFloat(weight)
    if (!weight || isNaN(kg) || kg <= 0) return
    setSaving(true)
    const ts = makeTimestamp(date, time)
    if (existing) {
      await updateWeight(existing.id, {
        weightKg: +kg.toFixed(3),
        recordedAt: ts,
        ...(notes ? { notes } : {}),
      })
    } else {
      await addWeight(+kg.toFixed(3), notes || undefined, ts)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-purple-900">{existing ? 'Edit Weight' : 'Log Weight'}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <label className="text-xs text-gray-500 block mb-1">Weight (kg)</label>
        <input
          type="number" value={weight} onChange={e => setWeight(e.target.value)}
          placeholder="e.g. 3.450" step="0.001" min="0"
          autoFocus={!existing}
          className={`${inputCls} text-2xl font-bold text-purple-900 mb-3`}
        />

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

        <button onClick={handleSave} disabled={saving || !weight || parseFloat(weight) <= 0}
          className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Save Weight'}
        </button>
      </div>
    </div>
  )
}
