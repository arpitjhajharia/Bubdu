import { useEffect, useState } from 'react'
import { Pill, Plus, Trash2, X, Check, Clock, AlertCircle } from 'lucide-react'
import {
  subscribeMedicines, subscribeMedicineLogs,
  addMedicine, deleteMedicine, updateMedicine,
  logMedicine, deleteMedicineLog,
  getDoseStatus, hasMedicineOverdue,
  formatDoseTime, formatTime, formatDate, timeAgo,
} from '@/lib/firestore'
import type { Medicine, MedicineLog, MedicineFor, DoseTime } from '@/lib/types'

const DOSE_PRESETS: DoseTime[] = [
  { label: 'Morning',   time: '08:00' },
  { label: 'Afternoon', time: '14:00' },
  { label: 'Night',     time: '21:00' },
]

export default function Medicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [logs, setLogs] = useState<MedicineLog[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [tab, setTab] = useState<MedicineFor>('baby')
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const unsubs = [
      subscribeMedicines(setMedicines),
      subscribeMedicineLogs(setLogs),
    ]
    const timer = setInterval(() => setTick(t => t + 1), 60000)
    return () => { unsubs.forEach(u => u()); clearInterval(timer) }
  }, [])

  void tick

  const filtered = medicines.filter(m => m.for === tab)

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-purple-900">Medicines</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-purple-600 text-white rounded-full p-3 shadow-lg active:scale-95 transition-transform"
        >
          <Plus size={22} />
        </button>
      </div>

      <div className="flex gap-2 mb-5">
        {(['baby', 'mother'] as MedicineFor[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              tab === t ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border border-purple-200'
            }`}
          >
            {t === 'baby' ? '👶 Bubdu' : '👩 Mother'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Pill size={40} className="mx-auto mb-3 opacity-30" />
          <p>No medicines for {tab === 'baby' ? 'Bubdu' : 'mother'}</p>
          <p className="text-sm mt-1">Tap + to add one</p>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {filtered.map(med => (
          <MedicineCard
            key={med.id}
            medicine={med}
            logs={logs}
            onGive={(doseLabel) => logMedicine(med, doseLabel)}
            onDelete={() => deleteMedicine(med.id)}
            onToggle={() => updateMedicine(med.id, { active: !med.active })}
          />
        ))}
      </div>

      {logs.filter(l => medicines.find(m => m.id === l.medicineId)?.for === tab).length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">History</h2>
          <div className="space-y-2">
            {logs
              .filter(l => medicines.find(m => m.id === l.medicineId)?.for === tab)
              .slice(0, 20)
              .map(log => (
                <div key={log.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                  <Check size={16} className="text-green-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{log.medicineName}</p>
                    <p className="text-xs text-gray-400">
                      {log.doseLabel} · {formatDate(log.givenAt)} {formatTime(log.givenAt)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-400 mr-2 shrink-0">{timeAgo(log.givenAt)}</p>
                  <button onClick={() => deleteMedicineLog(log.id)} className="text-gray-300 active:text-red-500">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
          </div>
        </>
      )}

      {showAddModal && (
        <AddMedicineModal
          defaultFor={tab}
          onClose={() => setShowAddModal(false)}
          onAdd={async data => { await addMedicine(data); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}

function MedicineCard({ medicine, logs, onGive, onDelete, onToggle }: {
  medicine: Medicine
  logs: MedicineLog[]
  onGive: (doseLabel: string) => Promise<void>
  onDelete: () => void
  onToggle: () => void
}) {
  const overdue = medicine.active && hasMedicineOverdue(logs, medicine)
  const sorted = [...medicine.doseTimes].sort((a, b) => a.time.localeCompare(b.time))

  return (
    <div className={`bg-white rounded-2xl shadow-sm border-l-4 overflow-hidden ${
      overdue ? 'border-red-400' : medicine.active ? 'border-purple-400' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3">
        <div className={`p-2 rounded-xl mt-0.5 shrink-0 ${overdue ? 'bg-red-50' : 'bg-purple-50'}`}>
          <Pill size={18} className={overdue ? 'text-red-500' : 'text-purple-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className={`font-semibold text-gray-900 ${!medicine.active ? 'opacity-50' : ''}`}>
              {medicine.name}
            </p>
            {!medicine.active && (
              <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">paused</span>
            )}
            {overdue && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertCircle size={12} /> overdue
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">{medicine.dosage} {medicine.unit}</p>
          {medicine.notes && <p className="text-xs text-gray-400 mt-0.5">{medicine.notes}</p>}
        </div>
        <button onClick={onDelete} className="text-gray-300 active:text-red-500 mt-1">
          <Trash2 size={16} />
        </button>
      </div>

      {/* Dose slots */}
      {medicine.active && (
        <div className="border-t border-gray-50 divide-y divide-gray-50">
          {sorted.map(dose => (
            <DoseRow
              key={dose.label}
              dose={dose}
              status={getDoseStatus(logs, medicine.id, dose.label, dose.time)}
              onGive={() => onGive(dose.label)}
            />
          ))}
        </div>
      )}

      {/* Pause / Resume */}
      <div className="px-4 pb-4 pt-3">
        <button
          onClick={onToggle}
          className={`w-full py-2 rounded-xl text-sm font-medium transition-colors ${
            medicine.active
              ? 'bg-gray-100 text-gray-500'
              : 'bg-purple-50 text-purple-600'
          }`}
        >
          {medicine.active ? 'Pause medicine' : 'Resume medicine'}
        </button>
      </div>
    </div>
  )
}

function DoseRow({ dose, status, onGive }: {
  dose: DoseTime
  status: 'given' | 'upcoming' | 'overdue' | 'later'
  onGive: () => Promise<void>
}) {
  const [giving, setGiving] = useState(false)

  async function handle() {
    setGiving(true)
    await onGive()
    setGiving(false)
  }

  const statusStyles = {
    given:    { row: 'bg-green-50',  badge: 'bg-green-100 text-green-700',  icon: <Check size={14} className="text-green-600" /> },
    upcoming: { row: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', icon: <Clock size={14} className="text-orange-500" /> },
    overdue:  { row: 'bg-red-50',    badge: 'bg-red-100 text-red-700',      icon: <AlertCircle size={14} className="text-red-500" /> },
    later:    { row: '',             badge: 'bg-gray-100 text-gray-500',     icon: <Clock size={14} className="text-gray-400" /> },
  }

  const s = statusStyles[status]

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${s.row}`}>
      {s.icon}
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-800">{dose.label}</p>
        <p className="text-xs text-gray-500">{formatDoseTime(dose.time)}</p>
      </div>
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.badge}`}>
        {status === 'given' ? 'Given ✓' : status === 'overdue' ? 'Overdue' : status === 'upcoming' ? 'Due soon' : 'Later'}
      </span>
      {status !== 'given' && (
        <button
          onClick={handle}
          disabled={giving}
          className="ml-2 bg-purple-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 active:scale-95 transition-transform"
        >
          {giving ? '✓' : 'Give'}
        </button>
      )}
    </div>
  )
}

function AddMedicineModal({ defaultFor, onClose, onAdd }: {
  defaultFor: MedicineFor
  onClose: () => void
  onAdd: (data: Omit<Medicine, 'id'>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [unit, setUnit] = useState('ml')
  const [forWho, setForWho] = useState<MedicineFor>(defaultFor)
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [doseTimes, setDoseTimes] = useState<DoseTime[]>([
    { label: 'Morning', time: '08:00' },
  ])

  function togglePreset(preset: DoseTime) {
    setDoseTimes(prev => {
      const exists = prev.find(d => d.label === preset.label)
      if (exists) return prev.filter(d => d.label !== preset.label)
      return [...prev, preset].sort((a, b) => a.time.localeCompare(b.time))
    })
  }

  function updateTime(label: string, time: string) {
    setDoseTimes(prev => prev.map(d => d.label === label ? { ...d, time } : d))
  }

  function addCustomSlot() {
    const label = `Dose ${doseTimes.length + 1}`
    setDoseTimes(prev => [...prev, { label, time: '12:00' }])
  }

  function updateLabel(oldLabel: string, newLabel: string) {
    setDoseTimes(prev => prev.map(d => d.label === oldLabel ? { ...d, label: newLabel } : d))
  }

  async function handleSave() {
    if (!name || !dosage || doseTimes.length === 0) return
    setSaving(true)
    await onAdd({ name, dosage, unit, for: forWho, doseTimes, active: true, ...(notes ? { notes } : {}) })
  }

  const isPresetActive = (label: string) => doseTimes.some(d => d.label === label)

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6 pb-10 max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-purple-900">Add Medicine</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        {/* Who */}
        <div className="flex gap-2 mb-4">
          {(['baby', 'mother'] as MedicineFor[]).map(t => (
            <button key={t} onClick={() => setForWho(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium ${forWho === t ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'}`}>
              {t === 'baby' ? '👶 Bubdu' : '👩 Mother'}
            </button>
          ))}
        </div>

        <Field label="Medicine name">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vitamin D drops"
            className="w-full border border-purple-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
        </Field>

        <div className="flex gap-2 mb-3">
          <Field label="Dosage" className="flex-1">
            <input value={dosage} onChange={e => setDosage(e.target.value)} placeholder="e.g. 0.5"
              className="w-full border border-purple-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
          </Field>
          <Field label="Unit" className="w-28">
            <select value={unit} onChange={e => setUnit(e.target.value)}
              className="w-full border border-purple-200 rounded-xl px-3 py-3 focus:outline-none focus:border-purple-500">
              {['ml', 'mg', 'drops', 'tablet', 'sachet'].map(u => <option key={u}>{u}</option>)}
            </select>
          </Field>
        </div>

        {/* Dose times */}
        <p className="text-sm text-gray-500 mb-2">Dose times</p>
        <div className="flex gap-2 mb-3">
          {DOSE_PRESETS.map(p => (
            <button key={p.label} onClick={() => togglePreset(p)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                isPresetActive(p.label) ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
              }`}>
              {p.label}
            </button>
          ))}
        </div>

        {/* Editable dose slots */}
        <div className="space-y-2 mb-3">
          {doseTimes.map(dose => (
            <div key={dose.label} className="flex items-center gap-2 bg-purple-50 rounded-xl px-3 py-2">
              <input
                value={dose.label}
                onChange={e => updateLabel(dose.label, e.target.value)}
                className="flex-1 bg-transparent text-sm font-medium text-purple-900 focus:outline-none"
              />
              <input
                type="time"
                value={dose.time}
                onChange={e => updateTime(dose.label, e.target.value)}
                className="bg-white border border-purple-200 rounded-lg px-2 py-1 text-sm focus:outline-none"
              />
              <button onClick={() => setDoseTimes(prev => prev.filter(d => d.label !== dose.label))}
                className="text-gray-400 active:text-red-500">
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        <button onClick={addCustomSlot}
          className="w-full py-2 border border-dashed border-purple-300 rounded-xl text-sm text-purple-500 mb-4">
          + Add custom time
        </button>

        <Field label="Notes (optional)">
          <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Give with food"
            className="w-full border border-purple-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500" />
        </Field>

        <button onClick={handleSave} disabled={saving || !name || !dosage || doseTimes.length === 0}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold mt-2 disabled:opacity-50">
          {saving ? 'Adding…' : 'Add Medicine'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-3 ${className}`}>
      <label className="text-sm text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  )
}
