import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Milk, Baby, Clock, AlertCircle, Scale, Eye } from 'lucide-react'
import {
  subscribeFeedings, subscribeDiapers, subscribeMedicines, subscribeMedicineLogs,
  subscribeWeights, subscribeNazar, markNazarDone, feedCountdownLabel, hasMedicineOverdue,
  todayInputDate,
} from '@/lib/firestore'
import type { FeedingLog, Medicine, MedicineLog, WeightLog, NazarLog } from '@/lib/types'

function feedEndAgo(log: FeedingLog): string {
  const endMs = log.startedAt.toDate().getTime() + (log.durationMin ?? 0) * 60000
  const diffMs = Date.now() - endMs
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [lastFeed, setLastFeed] = useState<FeedingLog | null>(null)
  const [diaperCounts, setDiaperCounts] = useState({ total: 0, wet: 0, dirty: 0, both: 0, dry: 0 })
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [medLogs, setMedLogs] = useState<MedicineLog[]>([])
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null)
  const [nazarLogs, setNazarLogs] = useState<NazarLog[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const unsubs = [
      subscribeFeedings(1, logs => setLastFeed(logs[0] ?? null)),
      subscribeDiapers(50, logs => {
        const today = new Date().toDateString()
        const t = logs.filter(l => l.changedAt.toDate().toDateString() === today)
        setDiaperCounts({
          total: t.length,
          wet:   t.filter(l => l.type === 'wet').length,
          dirty: t.filter(l => l.type === 'dirty').length,
          both:  t.filter(l => l.type === 'both').length,
          dry:   t.filter(l => l.type === 'dry').length,
        })
      }),
      subscribeMedicines(meds => setMedicines(meds.filter(m => m.active))),
      subscribeMedicineLogs(setMedLogs),
      subscribeWeights(logs => setLatestWeight(logs[0] ?? null)),
      subscribeNazar(setNazarLogs),
    ]
    const timer = setInterval(() => setTick(t => t + 1), 30000)
    return () => { unsubs.forEach(u => u()); clearInterval(timer) }
  }, [])

  void tick

  const today = todayInputDate()
  const isNazarDoneToday = nazarLogs.some(l => l.date === today)
  const overdueMeds = medicines.filter(m => hasMedicineOverdue(medLogs, m))
  const feedCountdown = lastFeed ? feedCountdownLabel(lastFeed) : null

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <p className="text-purple-500 text-xs">{greeting}</p>
        <h1 className="text-xl font-bold text-purple-900">Bubdu's Day 🍼</h1>
      </div>

      {/* Next feed countdown */}
      <button
        onClick={() => navigate('/feeding')}
        className={`w-full rounded-2xl p-3 mb-3 flex items-center gap-3 shadow-sm active:scale-95 transition-transform ${
          !feedCountdown ? 'bg-white' :
          feedCountdown.overdue ? 'bg-red-50 border border-red-200' :
          feedCountdown.urgent ? 'bg-orange-50 border border-orange-200' :
          'bg-purple-50 border border-purple-100'
        }`}
      >
        <div className={`p-2.5 rounded-xl ${
          !feedCountdown ? 'bg-gray-100 text-gray-400' :
          feedCountdown.overdue ? 'bg-red-100 text-red-600' :
          feedCountdown.urgent ? 'bg-orange-100 text-orange-600' :
          'bg-purple-100 text-purple-700'
        }`}>
          <Clock size={20} />
        </div>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Next feed</p>
          {feedCountdown ? (
            <>
              <p className={`text-xl font-bold tabular-nums ${
                feedCountdown.overdue ? 'text-red-600' :
                feedCountdown.urgent ? 'text-orange-600' :
                'text-purple-900'
              }`}>
                {feedCountdown.overdue ? `⚠ ${feedCountdown.label}` : feedCountdown.label}
              </p>
              <p className="text-xs text-gray-400">
                {feedCountdown.overdue ? 'Feed Bubdu now!' :
                 feedCountdown.urgent ? 'Almost time to feed' :
                 `${lastFeed?.type === 'formula' ? '2h' : '2.5h'} from end of last feed`}
              </p>
            </>
          ) : (
            <p className="text-base font-bold text-gray-400">No feeds logged yet</p>
          )}
        </div>
      </button>

      {overdueMeds.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3 mb-3 flex items-start gap-2.5">
          <AlertCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
          <div className="flex-1">
            <p className="font-semibold text-red-700 text-sm mb-1.5">Medicine overdue</p>
            {(['baby', 'mother'] as const).map(who => {
              const group = overdueMeds.filter(m => m.for === who)
              if (group.length === 0) return null
              return (
                <div key={who} className="mb-1 last:mb-0">
                  <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-0.5">
                    {who === 'baby' ? '👶 Bubdu' : '👩 Aaru'}
                  </p>
                  {group.map(m => (
                    <p key={m.id} className="text-red-600 text-sm">• {m.name}</p>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-4">
        {/* Last Feed */}
        <SummaryCard
          icon={<Milk size={16} />}
          label="Last Feed"
          value={lastFeed ? feedEndAgo(lastFeed) : '—'}
          sub={lastFeed ? `${lastFeed.type}${lastFeed.side ? ` · ${lastFeed.side}` : ''}` : 'No feeds yet'}
          color="blue"
          onClick={() => navigate('/feeding')}
        />

        {/* Weight */}
        <SummaryCard
          icon={<Scale size={16} />}
          label="Weight"
          value={latestWeight ? `${latestWeight.weightKg.toFixed(3)} kg` : '—'}
          sub={latestWeight ? 'latest' : 'Not recorded'}
          color="purple"
          onClick={() => navigate('/weight')}
        />

        {/* Diapers — full width with breakdown */}
        <button
          onClick={() => navigate('/diapers')}
          className="col-span-2 bg-white rounded-2xl p-3 text-left shadow-sm active:scale-95 transition-transform"
        >
          <div className="flex items-center gap-1.5 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 text-green-600 shrink-0"><Baby size={16} /></div>
            <p className="text-xs font-semibold text-gray-500">Diapers Today</p>
            <p className="text-lg font-bold text-gray-900 ml-auto">{diaperCounts.total}</p>
          </div>
          {diaperCounts.total > 0 ? (
            <div className="flex gap-3 flex-wrap">
              {diaperCounts.wet   > 0 && <span className="text-xs text-gray-600">💧 {diaperCounts.wet} wet</span>}
              {diaperCounts.dirty > 0 && <span className="text-xs text-gray-600">💩 {diaperCounts.dirty} dirty</span>}
              {diaperCounts.both  > 0 && <span className="text-xs text-gray-600">🔄 {diaperCounts.both} both</span>}
              {diaperCounts.dry   > 0 && <span className="text-xs text-gray-600">✅ {diaperCounts.dry} dry</span>}
            </div>
          ) : (
            <p className="text-xs text-gray-400">None logged today</p>
          )}
        </button>

        {/* Nazar */}
        <div className={`col-span-2 rounded-2xl p-3 shadow-sm flex items-center gap-3 ${isNazarDoneToday ? 'bg-green-50' : 'bg-white'}`}>
          <button onClick={() => navigate('/nazar')} className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`p-1.5 rounded-lg shrink-0 ${isNazarDoneToday ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600'}`}>
              <Eye size={16} />
            </div>
            <div className="text-left">
              <p className="text-xs font-semibold text-gray-500">Nazar</p>
              <p className={`text-sm font-bold ${isNazarDoneToday ? 'text-green-700' : 'text-gray-800'}`}>
                {isNazarDoneToday ? '✓ Done today' : 'Not done yet'}
              </p>
            </div>
          </button>
          {!isNazarDoneToday && (
            <button
              onClick={() => markNazarDone(today)}
              className="bg-purple-600 text-white px-3 py-1.5 rounded-full text-xs font-semibold active:scale-95 transition-transform shrink-0"
            >
              Mark Done
            </button>
          )}
        </div>
      </div>

      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Log</h2>
      <div className="grid grid-cols-3 gap-2">
        <QuickButton emoji="🤱" label="Breast"   onClick={() => navigate('/feeding', { state: { openModal: true, type: 'breast' } })} />
        <QuickButton emoji="🍼" label="Bottle"   onClick={() => navigate('/feeding', { state: { openModal: true, type: 'bottle' } })} />
        <QuickButton emoji="🥛" label="Formula"  onClick={() => navigate('/feeding', { state: { openModal: true, type: 'formula' } })} />
        <QuickButton emoji="💧" label="Wet"      onClick={() => navigate('/diapers', { state: { openModal: true, type: 'wet' } })} />
        <QuickButton emoji="💩" label="Dirty"    onClick={() => navigate('/diapers', { state: { openModal: true, type: 'dirty' } })} />
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
    blue:   'bg-blue-50 text-blue-600',
    green:  'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red:    'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-600',
  }
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl p-3 text-left shadow-sm active:scale-95 transition-transform"
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`p-1.5 rounded-lg shrink-0 ${colors[color]}`}>{icon}</div>
        <p className="text-xs font-semibold text-gray-500 leading-tight">{label}</p>
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-400">{sub}</p>
    </button>
  )
}

function QuickButton({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl py-2.5 flex flex-col items-center gap-0.5 shadow-sm active:scale-95 transition-transform"
    >
      <span className="text-xl">{emoji}</span>
      <span className="text-xs text-gray-600">{label}</span>
    </button>
  )
}
