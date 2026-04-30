import { useEffect, useState, useRef } from 'react'
import { Milk, Trash2, Timer, Plus, X, Clock } from 'lucide-react'
import { subscribeFeedings, addFeeding, deleteFeeding, formatTime, timeAgo, feedCountdownLabel } from '@/lib/firestore'
import type { FeedingLog, FeedType, BreastSide } from '@/lib/types'

export default function Feeding() {
  const [logs, setLogs] = useState<FeedingLog[]>([])
  const [showModal, setShowModal] = useState(false)
  const [type, setType] = useState<FeedType>('breast')
  const [side, setSide] = useState<BreastSide>('left')
  const [amountMl, setAmountMl] = useState('')
  const [timerActive, setTimerActive] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [saving, setSaving] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const unsub = subscribeFeedings(30, setLogs)
    const timer = setInterval(() => setTick(t => t + 1), 30000)
    return () => { unsub(); clearInterval(timer) }
  }, [])

  // tick forces countdown to re-render every 30s
  void tick

  const lastFeed = logs[0] ?? null
  const countdown = lastFeed ? feedCountdownLabel(lastFeed) : null

  useEffect(() => {
    if (timerActive) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerActive])

  function resetModal() {
    setType('breast')
    setSide('left')
    setAmountMl('')
    setTimerActive(false)
    setElapsed(0)
    setSaving(false)
  }

  function openModal() {
    resetModal()
    setShowModal(true)
  }

  async function handleSave() {
    setSaving(true)
    await addFeeding({
      type,
      ...(type === 'breast' ? { side, durationMin: Math.round(elapsed / 60) } : {}),
      ...(type !== 'breast' && amountMl ? { amountMl: Number(amountMl) } : {}),
    })
    setShowModal(false)
    resetModal()
  }

  function formatElapsed(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  }

  return (
    <div className="px-4 py-6">
      {/* Live countdown banner */}
      {countdown && (
        <div className={`rounded-2xl p-4 mb-4 flex items-center gap-3 ${
          countdown.overdue ? 'bg-red-50 border border-red-200' :
          countdown.urgent ? 'bg-orange-50 border border-orange-200' :
          'bg-purple-50 border border-purple-100'
        }`}>
          <Clock size={20} className={
            countdown.overdue ? 'text-red-500' :
            countdown.urgent ? 'text-orange-500' :
            'text-purple-600'
          } />
          <div>
            <p className="text-xs text-gray-500">Next feed in</p>
            <p className={`text-xl font-bold tabular-nums ${
              countdown.overdue ? 'text-red-600' :
              countdown.urgent ? 'text-orange-600' :
              'text-purple-800'
            }`}>
              {countdown.overdue ? `⚠ ${countdown.label}` : countdown.label}
            </p>
          </div>
          <p className="ml-auto text-xs text-gray-400">2.5h from last feed</p>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-purple-900">Feeding</h1>
          <p className="text-sm text-purple-400">{logs.length} logs</p>
        </div>
        <button
          onClick={openModal}
          className="bg-purple-600 text-white rounded-full p-3 shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={22} />
        </button>
      </div>

      {logs.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Milk size={40} className="mx-auto mb-3 opacity-30" />
          <p>No feeds logged yet</p>
        </div>
      )}

      <div className="space-y-3">
        {logs.map(log => (
          <LogCard
            key={log.id}
            log={log}
            onDelete={() => deleteFeeding(log.id)}
          />
        ))}
      </div>

      {showModal && (
        <Modal onClose={() => { setShowModal(false); resetModal() }}>
          <h2 className="text-lg font-bold text-purple-900 mb-4">Log Feeding</h2>

          <div className="flex gap-2 mb-4">
            {(['breast', 'bottle', 'formula'] as FeedType[]).map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                  type === t ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
                }`}
              >
                {t === 'breast' ? '🤱' : t === 'bottle' ? '🍼' : '🥛'} {t}
              </button>
            ))}
          </div>

          {type === 'breast' && (
            <div className="mb-4">
              <p className="text-sm text-gray-500 mb-2">Side</p>
              <div className="flex gap-2">
                {(['left', 'right', 'both'] as BreastSide[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSide(s)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${
                      side === s ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>

              <div className="mt-4 bg-purple-50 rounded-2xl p-4 flex flex-col items-center">
                <p className="text-4xl font-mono font-bold text-purple-800 mb-3">
                  {formatElapsed(elapsed)}
                </p>
                <button
                  onClick={() => setTimerActive(a => !a)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-semibold transition-colors ${
                    timerActive
                      ? 'bg-red-100 text-red-600'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  <Timer size={16} />
                  {timerActive ? 'Stop' : elapsed > 0 ? 'Resume' : 'Start Timer'}
                </button>
              </div>
            </div>
          )}

          {(type === 'bottle' || type === 'formula') && (
            <div className="mb-4">
              <label className="text-sm text-gray-500 block mb-1">Amount (ml)</label>
              <input
                type="number"
                value={amountMl}
                onChange={e => setAmountMl(e.target.value)}
                placeholder="e.g. 90"
                className="w-full border border-purple-200 rounded-xl px-4 py-3 text-lg focus:outline-none focus:border-purple-500"
              />
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold mt-2 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save Feed'}
          </button>
        </Modal>
      )}
    </div>
  )
}

function LogCard({ log, onDelete }: { log: FeedingLog; onDelete: () => void }) {
  const icon = log.type === 'breast' ? '🤱' : log.type === 'bottle' ? '🍼' : '🥛'
  const detail = log.type === 'breast'
    ? `${log.side ?? ''} · ${log.durationMin ?? 0} min`
    : `${log.amountMl ?? '?'} ml`

  return (
    <div className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
      <span className="text-2xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="font-semibold capitalize text-gray-900">{log.type}</p>
        <p className="text-sm text-gray-500">{detail}</p>
      </div>
      <div className="text-right mr-2">
        <p className="text-sm font-medium text-gray-700">{formatTime(log.startedAt)}</p>
        <p className="text-xs text-gray-400">{timeAgo(log.startedAt)}</p>
      </div>
      <button
        onClick={onDelete}
        className="text-gray-300 active:text-red-500 transition-colors"
      >
        <Trash2 size={16} />
      </button>
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6 pb-10"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-1">
          <div />
          <button onClick={onClose} className="text-gray-400"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
