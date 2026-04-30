import { useEffect, useState } from 'react'
import { Pill, Plus, Trash2, X, Check, Clock } from 'lucide-react'
import {
  subscribeMedicines, subscribeMedicineLogs,
  addMedicine, deleteMedicine, updateMedicine,
  logMedicine, deleteMedicineLog,
  timeAgo, nextDueTime, formatTime, formatDate,
} from '@/lib/firestore'
import type { Medicine, MedicineLog, MedicineFor } from '@/lib/types'

export default function Medicines() {
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [logs, setLogs] = useState<MedicineLog[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [tab, setTab] = useState<MedicineFor>('baby')

  useEffect(() => {
    const unsubs = [
      subscribeMedicines(setMedicines),
      subscribeMedicineLogs(100, setLogs),
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  function lastLogFor(medId: string): MedicineLog | undefined {
    return logs.find(l => l.medicineId === medId)
  }

  const filtered = medicines.filter(m => m.for === tab)

  return (
    <div className="px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-purple-900">Medicines</h1>
        </div>
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
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-purple-600 text-white' : 'bg-white text-purple-600 border border-purple-200'
            }`}
          >
            {t === 'baby' ? '👶' : '👩'} {t === 'baby' ? 'Bubdu' : 'Mother'}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <Pill size={40} className="mx-auto mb-3 opacity-30" />
          <p>No medicines added for {tab === 'baby' ? 'Bubdu' : 'mother'}</p>
          <p className="text-sm mt-1">Tap + to add one</p>
        </div>
      )}

      <div className="space-y-3 mb-8">
        {filtered.map(med => {
          const lastLog = lastLogFor(med.id)
          const due = lastLog ? nextDueTime(lastLog.givenAt, med.frequencyHours) : 'Due now'
          const overdue = due === 'OVERDUE' || !lastLog

          return (
            <MedicineCard
              key={med.id}
              medicine={med}
              lastLog={lastLog}
              due={due}
              overdue={overdue}
              onGive={() => logMedicine(med)}
              onDelete={() => deleteMedicine(med.id)}
              onToggle={() => updateMedicine(med.id, { active: !med.active })}
            />
          )
        })}
      </div>

      {logs.filter(l => l.medicineFor === tab).length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">History</h2>
          <div className="space-y-2">
            {logs.filter(l => l.medicineFor === tab).slice(0, 20).map(log => (
              <div key={log.id} className="bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                <Check size={16} className="text-green-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">{log.medicineName}</p>
                  <p className="text-xs text-gray-400">{formatDate(log.givenAt)} · {formatTime(log.givenAt)}</p>
                </div>
                <p className="text-xs text-gray-400 mr-2">{timeAgo(log.givenAt)}</p>
                <button
                  onClick={() => deleteMedicineLog(log.id)}
                  className="text-gray-300 active:text-red-500"
                >
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
          onAdd={async data => {
            await addMedicine(data)
            setShowAddModal(false)
          }}
        />
      )}
    </div>
  )
}

function MedicineCard({
  medicine, lastLog, due, overdue, onGive, onDelete, onToggle,
}: {
  medicine: Medicine
  lastLog?: MedicineLog
  due: string
  overdue: boolean
  onGive: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  const [giving, setGiving] = useState(false)

  async function handleGive() {
    setGiving(true)
    await onGive()
    setGiving(false)
  }

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${
      overdue && medicine.active ? 'border-red-400' : medicine.active ? 'border-purple-400' : 'border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-xl mt-0.5 ${overdue && medicine.active ? 'bg-red-50' : 'bg-purple-50'}`}>
          <Pill size={18} className={overdue && medicine.active ? 'text-red-500' : 'text-purple-600'} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-semibold text-gray-900 ${!medicine.active ? 'opacity-50' : ''}`}>
              {medicine.name}
            </p>
            {!medicine.active && (
              <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">paused</span>
            )}
          </div>
          <p className="text-sm text-gray-500">{medicine.dosage} {medicine.unit} · every {medicine.frequencyHours}h</p>
          {lastLog && (
            <p className="text-xs text-gray-400 mt-0.5">Last: {formatTime(lastLog.givenAt)} · {timeAgo(lastLog.givenAt)}</p>
          )}
          {medicine.active && (
            <div className="flex items-center gap-1 mt-1">
              <Clock size={12} className={overdue ? 'text-red-500' : 'text-green-500'} />
              <p className={`text-xs font-medium ${overdue ? 'text-red-600' : 'text-green-600'}`}>
                {due}
              </p>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button onClick={onDelete} className="text-gray-300 active:text-red-500">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {medicine.active && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleGive}
            disabled={giving}
            className="flex-1 bg-purple-600 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50 active:scale-95 transition-transform"
          >
            {giving ? '✓ Done' : '✓ Mark given'}
          </button>
          <button
            onClick={onToggle}
            className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm"
          >
            Pause
          </button>
        </div>
      )}
      {!medicine.active && (
        <button
          onClick={onToggle}
          className="w-full mt-3 py-2 bg-purple-50 text-purple-600 rounded-xl text-sm font-medium"
        >
          Resume
        </button>
      )}
    </div>
  )
}

function AddMedicineModal({
  defaultFor, onClose, onAdd,
}: {
  defaultFor: MedicineFor
  onClose: () => void
  onAdd: (data: Omit<Medicine, 'id'>) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [dosage, setDosage] = useState('')
  const [unit, setUnit] = useState('ml')
  const [forWho, setForWho] = useState<MedicineFor>(defaultFor)
  const [freqHours, setFreqHours] = useState('8')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name || !dosage) return
    setSaving(true)
    await onAdd({
      name,
      dosage,
      unit,
      for: forWho,
      frequencyHours: Number(freqHours),
      active: true,
      ...(notes ? { notes } : {}),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end" onClick={onClose}>
      <div
        className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6 pb-10 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-purple-900">Add Medicine</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <div className="flex gap-2 mb-4">
          {(['baby', 'mother'] as MedicineFor[]).map(t => (
            <button
              key={t}
              onClick={() => setForWho(t)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${
                forWho === t ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700'
              }`}
            >
              {t === 'baby' ? '👶 Bubdu' : '👩 Mother'}
            </button>
          ))}
        </div>

        <Field label="Medicine name">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Vitamin D drops"
            className="w-full border border-purple-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500"
          />
        </Field>

        <div className="flex gap-2 mb-3">
          <Field label="Dosage" className="flex-1">
            <input
              value={dosage}
              onChange={e => setDosage(e.target.value)}
              placeholder="e.g. 0.5"
              className="w-full border border-purple-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500"
            />
          </Field>
          <Field label="Unit" className="w-28">
            <select
              value={unit}
              onChange={e => setUnit(e.target.value)}
              className="w-full border border-purple-200 rounded-xl px-3 py-3 focus:outline-none focus:border-purple-500"
            >
              {['ml', 'mg', 'drops', 'tablet', 'sachet'].map(u => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Every (hours)">
          <input
            type="number"
            value={freqHours}
            onChange={e => setFreqHours(e.target.value)}
            className="w-full border border-purple-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500"
          />
        </Field>

        <Field label="Notes (optional)">
          <input
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="e.g. With food"
            className="w-full border border-purple-200 rounded-xl px-4 py-3 focus:outline-none focus:border-purple-500"
          />
        </Field>

        <button
          onClick={handleSave}
          disabled={saving || !name || !dosage}
          className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold mt-2 disabled:opacity-50"
        >
          {saving ? 'Adding…' : 'Add Medicine'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children, className = '' }: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={`mb-3 ${className}`}>
      <label className="text-sm text-gray-500 block mb-1">{label}</label>
      {children}
    </div>
  )
}
