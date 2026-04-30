import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Milk, Baby, Pill, Clock, AlertCircle } from 'lucide-react'
import { subscribeFeedings, subscribeDiapers, subscribeMedicines, subscribeMedicineLogs, timeAgo, nextDueTime } from '@/lib/firestore'
import type { FeedingLog, Medicine, MedicineLog } from '@/lib/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [lastFeed, setLastFeed] = useState<FeedingLog | null>(null)
  const [todayDiapers, setTodayDiapers] = useState(0)
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [medLogs, setMedLogs] = useState<MedicineLog[]>([])

  useEffect(() => {
    const unsubs = [
      subscribeFeedings(1, logs => setLastFeed(logs[0] ?? null)),
      subscribeDiapers(50, logs => {
        const today = new Date().toDateString()
        setTodayDiapers(logs.filter(l => l.changedAt.toDate().toDateString() === today).length)
      }),
      subscribeMedicines(meds => setMedicines(meds.filter(m => m.active))),
      subscribeMedicineLogs(100, setMedLogs),
    ]
    return () => unsubs.forEach(u => u())
  }, [])

  function lastLogForMed(medId: string): MedicineLog | undefined {
    return medLogs.find(l => l.medicineId === medId)
  }

  const overdueMeds = medicines.filter(m => {
    const last = lastLogForMed(m.id)
    if (!last) return true
    const nextMs = last.givenAt.toDate().getTime() + m.frequencyHours * 3600000
    return Date.now() > nextMs
  })

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-4 py-6">
      <div className="mb-6">
        <p className="text-purple-500 text-sm">{greeting}</p>
        <h1 className="text-2xl font-bold text-purple-900">Bubdu's Day 🍼</h1>
      </div>

      {overdueMeds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-start gap-3">
          <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={20} />
          <div>
            <p className="font-semibold text-red-700 text-sm">Medicine overdue</p>
            {overdueMeds.map(m => (
              <p key={m.id} className="text-red-600 text-sm">
                {m.name} ({m.for})
              </p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-6">
        <SummaryCard
          icon={<Milk size={20} />}
          label="Last feed"
          value={lastFeed ? timeAgo(lastFeed.startedAt) : '—'}
          sub={lastFeed ? `${lastFeed.type}${lastFeed.side ? ` · ${lastFeed.side}` : ''}` : 'No feeds yet'}
          color="blue"
          onClick={() => navigate('/feeding')}
        />
        <SummaryCard
          icon={<Baby size={20} />}
          label="Diapers today"
          value={String(todayDiapers)}
          sub="changes"
          color="green"
          onClick={() => navigate('/diapers')}
        />
        <SummaryCard
          icon={<Pill size={20} />}
          label="Medicines"
          value={String(overdueMeds.length)}
          sub="overdue"
          color={overdueMeds.length > 0 ? 'red' : 'purple'}
          onClick={() => navigate('/medicines')}
        />
        <SummaryCard
          icon={<Clock size={20} />}
          label="Next feed"
          value={lastFeed ? nextDueTime(lastFeed.startedAt, 2.5) : '—'}
          sub="~2.5h interval"
          color="orange"
          onClick={() => navigate('/feeding')}
        />
      </div>

      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Log</h2>
      <div className="grid grid-cols-3 gap-2">
        <QuickButton emoji="🤱" label="Breast" onClick={() => navigate('/feeding')} />
        <QuickButton emoji="🍼" label="Bottle" onClick={() => navigate('/feeding')} />
        <QuickButton emoji="💧" label="Wet" onClick={() => navigate('/diapers')} />
        <QuickButton emoji="💩" label="Dirty" onClick={() => navigate('/diapers')} />
        <QuickButton emoji="💊" label="Medicine" onClick={() => navigate('/medicines')} />
      </div>
    </div>
  )
}

function SummaryCard({
  icon, label, value, sub, color, onClick,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: 'blue' | 'green' | 'purple' | 'red' | 'orange'
  onClick: () => void
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-4 text-left shadow-sm active:scale-95 transition-transform"
    >
      <div className={`inline-flex p-2 rounded-xl mb-2 ${colors[color]}`}>{icon}</div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </button>
  )
}

function QuickButton({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl py-3 flex flex-col items-center gap-1 shadow-sm active:scale-95 transition-transform"
    >
      <span className="text-2xl">{emoji}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </button>
  )
}
