import { useEffect, useState, useMemo } from 'react'
import { TrendingUp, Trash2, Pencil, Plus, X, Ruler, Scale, Baby } from 'lucide-react'
import {
  subscribeGrowth, addGrowth, updateGrowth, deleteGrowth,
  subscribeBabyProfile, saveBabyProfile, DEFAULT_BABY_PROFILE, birthMs, ageLabel,
  formatTime, formatDate, makeTimestamp, todayInputDate, nowInputTime,
} from '@/lib/firestore'
import type { GrowthLog, BabyProfile } from '@/lib/types'
import {
  ageInMonths, evaluate, percentileCurves, percentileLabel,
  MAX_AGE_MONTHS, type GrowthMetric,
} from '@/lib/whoGrowth'
import { deleteField, type Timestamp } from 'firebase/firestore'

function tsToDate(ts: Timestamp): string {
  const d = ts.toDate()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function tsToTime(ts: Timestamp): string {
  const d = ts.toDate()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const METRICS: { key: GrowthMetric; label: string; unit: string; field: 'weightKg' | 'lengthCm'; decimals: number }[] = [
  { key: 'weight', label: 'Weight for age', unit: 'kg', field: 'weightKg', decimals: 3 },
  { key: 'length', label: 'Length for age', unit: 'cm', field: 'lengthCm', decimals: 1 },
]

export default function Growth() {
  const [logs, setLogs] = useState<GrowthLog[]>([])
  const [profile, setProfile] = useState<BabyProfile>(DEFAULT_BABY_PROFILE)
  const [showModal, setShowModal] = useState(false)
  const [editingLog, setEditingLog] = useState<GrowthLog | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    const unsubs = [subscribeGrowth(setLogs), subscribeBabyProfile(setProfile)]
    return () => unsubs.forEach(u => u())
  }, [])

  const latest = logs[0] ?? null
  const latestAge = ageInMonths(birthMs(profile), Date.now())

  return (
    <div className="px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-purple-900">Growth</h1>
          <button onClick={() => setShowProfile(true)} className="text-sm text-purple-400 active:text-purple-600 flex items-center gap-1">
            <Baby size={13} /> {profile.name} · {ageLabel(profile)} old
          </button>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-purple-600 text-white rounded-full p-2.5 shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Latest summary with WHO percentile */}
      {latest && (
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          {METRICS.map(m => {
            const withVal = logs.find(l => l[m.field] != null)
            const val = withVal?.[m.field] as number | undefined
            if (val == null) return <SummaryCard key={m.key} metric={m} value={null} percentile={null} />
            const age = ageInMonths(birthMs(profile), (withVal!.recordedAt).toDate().getTime())
            const { percentile } = evaluate(m.key, age, val)
            return <SummaryCard key={m.key} metric={m} value={val} percentile={profile.sex === 'boy' ? percentile : null} />
          })}
        </div>
      )}

      {profile.sex !== 'boy' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-3">
          <p className="text-xs text-amber-700">WHO reference curves bundled are for boys only — showing measurements without percentile bands.</p>
        </div>
      )}

      {METRICS.map(m => (
        <GrowthChart key={m.key} metric={m} logs={logs} profile={profile} latestAge={latestAge} />
      ))}

      {logs.length === 0 && (
        <div className="text-center py-10 text-gray-400">
          <TrendingUp size={36} className="mx-auto mb-2.5 opacity-30" />
          <p>No measurements yet</p>
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mt-1">
          <div className="flex items-center px-3 py-2 bg-gray-50 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-400 flex-1">Date</p>
            <p className="text-xs font-semibold text-gray-400 w-20 text-right">Weight</p>
            <p className="text-xs font-semibold text-gray-400 w-20 text-right pr-14">Length</p>
          </div>
          {logs.map((log, i) => (
            <div key={log.id} className={`flex items-center px-3 py-2.5 ${i < logs.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800">{formatDate(log.recordedAt)} · {formatTime(log.recordedAt)}</p>
                <p className="text-[11px] text-purple-300">{ageLabel(profile, log.recordedAt.toDate().getTime())}</p>
                {log.notes && <p className="text-xs text-gray-400 truncate">{log.notes}</p>}
              </div>
              <p className="text-sm font-bold text-purple-900 w-20 text-right">{log.weightKg != null ? `${log.weightKg.toFixed(3)}` : '—'}</p>
              <p className="text-sm font-bold text-purple-900 w-20 text-right">{log.lengthCm != null ? `${log.lengthCm.toFixed(1)}` : '—'}</p>
              <button onClick={() => setEditingLog(log)} className="ml-2 text-gray-300 active:text-purple-500 transition-colors shrink-0"><Pencil size={14} /></button>
              <button onClick={() => deleteGrowth(log.id)} className="ml-1.5 text-gray-300 active:text-red-500 transition-colors shrink-0"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}

      {showModal && <GrowthModal profile={profile} onClose={() => setShowModal(false)} />}
      {editingLog && <GrowthModal profile={profile} existing={editingLog} onClose={() => setEditingLog(null)} />}
      {showProfile && <ProfileModal existing={profile} onClose={() => setShowProfile(false)} />}
    </div>
  )
}

function SummaryCard({ metric, value, percentile }: {
  metric: typeof METRICS[number]; value: number | null; percentile: number | null
}) {
  const Icon = metric.key === 'weight' ? Scale : Ruler
  const inBand = percentile != null && percentile >= 3 && percentile <= 97
  return (
    <div className="bg-white rounded-2xl shadow-sm p-3">
      <div className="flex items-center gap-1.5 text-purple-400 mb-1">
        <Icon size={13} />
        <p className="text-[11px] font-semibold uppercase tracking-wide">{metric.key}</p>
      </div>
      {value == null ? (
        <p className="text-gray-300 text-lg font-bold">—</p>
      ) : (
        <>
          <p className="text-2xl font-bold text-purple-900 leading-tight">
            {value.toFixed(metric.decimals)}<span className="text-sm font-medium text-purple-300 ml-1">{metric.unit}</span>
          </p>
          {percentile != null && (
            <span className={`inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${inBand ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {percentileLabel(percentile)} pct
            </span>
          )}
        </>
      )}
    </div>
  )
}

function GrowthChart({ metric, logs, profile, latestAge }: {
  metric: typeof METRICS[number]; logs: GrowthLog[]; profile: BabyProfile; latestAge: number
}) {
  const data = useMemo(() => {
    const birth = birthMs(profile)
    return logs
      .filter(l => l[metric.field] != null)
      .map(l => ({
        months: ageInMonths(birth, l.recordedAt.toDate().getTime()),
        value: l[metric.field] as number,
      }))
      .filter(d => d.months >= 0 && d.months <= MAX_AGE_MONTHS)
      .sort((a, b) => a.months - b.months)
  }, [logs, profile, metric.field])

  // x window: zoom into the relevant early period
  const lastMonths = data.length ? data[data.length - 1].months : 0
  const xMax = Math.min(MAX_AGE_MONTHS, Math.max(3, Math.ceil(Math.max(latestAge, lastMonths)) + 1))

  const showCurves = profile.sex === 'boy'
  const curves = useMemo(
    () => showCurves ? percentileCurves(metric.key).map(c => ({ ...c, points: c.points.filter(p => p.months <= xMax) })) : [],
    [metric.key, xMax, showCurves]
  )

  if (data.length === 0) return null

  const W = 340, H = 190
  const PAD = { top: 10, right: 26, bottom: 20, left: 32 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  // y window from curves within view + data, padded
  const yVals: number[] = [...data.map(d => d.value)]
  curves.forEach(c => c.points.forEach(p => yVals.push(p.value)))
  let yMin = Math.min(...yVals), yMax = Math.max(...yVals)
  const padY = (yMax - yMin) * 0.08 || 1
  yMin -= padY; yMax += padY

  const x = (m: number) => PAD.left + (m / xMax) * innerW
  const y = (v: number) => PAD.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH

  const line = (pts: { months: number; value: number }[]) => pts.map(p => `${x(p.months).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const xTickStep = xMax <= 6 ? 1 : xMax <= 12 ? 2 : 3
  const xTicks: number[] = []
  for (let m = 0; m <= xMax; m += xTickStep) xTicks.push(m)
  const yTicks = [yMin + (yMax - yMin) * 0.15, (yMin + yMax) / 2, yMax - (yMax - yMin) * 0.15]

  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 mb-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{metric.label} ({metric.unit})</p>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="overflow-visible">
        {/* y gridlines + labels */}
        {yTicks.map((v, i) => (
          <g key={`y${i}`}>
            <line x1={PAD.left} y1={y(v)} x2={PAD.left + innerW} y2={y(v)} stroke="#f3e8ff" strokeWidth="1" />
            <text x={PAD.left - 4} y={y(v) + 3} textAnchor="end" fill="#c4b5fd" fontSize="8">{v.toFixed(metric.key === 'weight' ? 1 : 0)}</text>
          </g>
        ))}
        {/* x labels */}
        {xTicks.map((m, i) => (
          <text key={`x${i}`} x={x(m)} y={H - 6} textAnchor="middle" fill="#9ca3af" fontSize="8">{m}m</text>
        ))}

        {/* WHO percentile curves */}
        {curves.map(c => {
          const isMedian = c.label === '50'
          return (
            <g key={c.label}>
              <polyline
                points={line(c.points)} fill="none"
                stroke={isMedian ? '#a78bfa' : '#ddd6fe'}
                strokeWidth={isMedian ? 1.4 : 1}
                strokeDasharray={isMedian ? '' : '3 2'}
              />
              <text x={x(xMax) + 3} y={y(c.points[c.points.length - 1].value) + 3} fill="#a78bfa" fontSize="7.5" fontWeight={isMedian ? 'bold' : 'normal'}>{c.label}</text>
            </g>
          )
        })}

        {/* Baby's measurements */}
        <polyline points={line(data)} fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) => (
          <circle key={i} cx={x(d.months)} cy={y(d.value)} r="3" fill="#7c3aed" />
        ))}
        {(() => {
          const last = data[data.length - 1]
          return (
            <text x={x(last.months)} y={y(last.value) - 7} textAnchor="middle" fill="#6d28d9" fontSize="8.5" fontWeight="bold">
              {last.value.toFixed(metric.decimals)}
            </text>
          )
        })()}
      </svg>
    </div>
  )
}

function GrowthModal({ profile, onClose, existing }: { profile: BabyProfile; onClose: () => void; existing?: GrowthLog }) {
  const [weight, setWeight] = useState(existing?.weightKg != null ? String(existing.weightKg) : '')
  const [length, setLength] = useState(existing?.lengthCm != null ? String(existing.lengthCm) : '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [date, setDate] = useState(existing ? tsToDate(existing.recordedAt) : todayInputDate())
  const [time, setTime] = useState(existing ? tsToTime(existing.recordedAt) : nowInputTime())
  const [saving, setSaving] = useState(false)

  const inputCls = 'w-full border border-purple-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-500'
  const kg = parseFloat(weight)
  const cm = parseFloat(length)
  const hasWeight = weight !== '' && !isNaN(kg) && kg > 0
  const hasLength = length !== '' && !isNaN(cm) && cm > 0
  const canSave = hasWeight || hasLength

  // Live WHO percentile preview (boys only)
  const ageM = ageInMonths(birthMs(profile), makeTimestamp(date, time).toDate().getTime())
  const wPct = profile.sex === 'boy' && hasWeight ? evaluate('weight', ageM, kg).percentile : null
  const lPct = profile.sex === 'boy' && hasLength ? evaluate('length', ageM, cm).percentile : null

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    const ts = makeTimestamp(date, time)
    const payload = {
      ...(hasWeight ? { weightKg: +kg.toFixed(3) } : {}),
      ...(hasLength ? { lengthCm: +cm.toFixed(1) } : {}),
      ...(notes ? { notes } : {}),
    }
    if (existing) {
      // deleteField() clears a measurement that was removed during the edit
      await updateGrowth(existing.id, {
        weightKg: hasWeight ? +kg.toFixed(3) : (deleteField() as unknown as undefined),
        lengthCm: hasLength ? +cm.toFixed(1) : (deleteField() as unknown as undefined),
        recordedAt: ts,
        notes: notes || (deleteField() as unknown as undefined),
      } as Partial<GrowthLog>)
    } else {
      await addGrowth({ ...payload, recordedAt: ts })
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-purple-900">{existing ? 'Edit Measurement' : 'Log Measurement'}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="flex gap-2.5 mb-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Weight (kg)</label>
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="3.450" step="0.001" min="0"
              autoFocus={!existing} className={`${inputCls} text-xl font-bold text-purple-900`} />
            {wPct != null && <p className="text-[11px] text-purple-400 mt-1">≈ {percentileLabel(wPct)} pct</p>}
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Length (cm)</label>
            <input type="number" value={length} onChange={e => setLength(e.target.value)} placeholder="52.0" step="0.1" min="0"
              className={`${inputCls} text-xl font-bold text-purple-900`} />
            {lPct != null && <p className="text-[11px] text-purple-400 mt-1">≈ {percentileLabel(lPct)} pct</p>}
          </div>
        </div>

        <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className={`${inputCls} mb-3`} />

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

        <button onClick={handleSave} disabled={saving || !canSave}
          className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : existing ? 'Save Changes' : 'Save Measurement'}
        </button>
      </div>
    </div>
  )
}

function ProfileModal({ existing, onClose }: { existing: BabyProfile; onClose: () => void }) {
  const [name, setName] = useState(existing.name)
  const [sex, setSex] = useState(existing.sex)
  const [birthDate, setBirthDate] = useState(existing.birthDate)
  const [birthTime, setBirthTime] = useState(existing.birthTime ?? '')
  const [saving, setSaving] = useState(false)
  const inputCls = 'w-full border border-purple-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-purple-500'

  async function handleSave() {
    if (!name || !birthDate) return
    setSaving(true)
    await saveBabyProfile({ name, sex, birthDate, ...(birthTime ? { birthTime } : {}) })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end" onClick={onClose}>
      <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-5 pb-8" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-base font-bold text-purple-900">Baby Profile</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <label className="text-xs text-gray-500 block mb-1">Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className={`${inputCls} mb-3`} />

        <label className="text-xs text-gray-500 block mb-1">Sex</label>
        <div className="flex gap-2 mb-3">
          {(['boy', 'girl'] as const).map(s => (
            <button key={s} onClick={() => setSex(s)}
              className={`flex-1 py-2.5 rounded-xl font-medium capitalize border ${sex === s ? 'bg-purple-600 text-white border-purple-600' : 'border-purple-200 text-purple-500'}`}>
              {s}
            </button>
          ))}
        </div>
        {sex === 'girl' && <p className="text-[11px] text-amber-600 mb-3">Note: only boys WHO curves are bundled; percentiles won't be shown for girls.</p>}

        <div className="flex gap-2.5 mb-4">
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Birth date</label>
            <input type="date" value={birthDate} onChange={e => setBirthDate(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">Birth time</label>
            <input type="time" value={birthTime} onChange={e => setBirthTime(e.target.value)} className={inputCls} />
          </div>
        </div>

        <button onClick={handleSave} disabled={saving || !name || !birthDate}
          className="w-full bg-purple-600 text-white py-2.5 rounded-xl font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Save Profile'}
        </button>
      </div>
    </div>
  )
}
