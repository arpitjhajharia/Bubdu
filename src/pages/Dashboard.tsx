import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, AlertCircle, Scale } from 'lucide-react'
import {
  subscribeFeedings, subscribeDiapers, subscribeMedicines, subscribeMedicineLogs,
  subscribeWeights, subscribeNazar, subscribeMassage, subscribeFeedSettings,
  feedCountdownLabel, feedIntervalLabel, hasMedicineOverdue, DEFAULT_FEED_SETTINGS,
  todayInputDate,
} from '@/lib/firestore'
import type { FeedingLog, Medicine, MedicineLog, WeightLog, NazarLog, MassageLog, FeedIntervalSettings } from '@/lib/types'

export default function Dashboard() {
  const navigate = useNavigate()
  const [lastFeed, setLastFeed] = useState<FeedingLog | null>(null)
  const [todayFeeds, setTodayFeeds] = useState<FeedingLog[]>([])
  const [feedSettings, setFeedSettings] = useState<FeedIntervalSettings>(DEFAULT_FEED_SETTINGS)
  const [diaperCounts, setDiaperCounts] = useState({ total: 0, wet: 0, dirty: 0, both: 0, dry: 0 })
  const [medicines, setMedicines] = useState<Medicine[]>([])
  const [medLogs, setMedLogs] = useState<MedicineLog[]>([])
  const [latestWeight, setLatestWeight] = useState<WeightLog | null>(null)
  const [nazarLogs, setNazarLogs] = useState<NazarLog[]>([])
  const [massageLogs, setMassageLogs] = useState<MassageLog[]>([])
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const unsubs = [
      subscribeFeedSettings(setFeedSettings),
      subscribeFeedings(50, logs => {
        setLastFeed(logs[0] ?? null)
        const todayStr = new Date().toDateString()
        setTodayFeeds(logs.filter(l => l.startedAt.toDate().toDateString() === todayStr))
      }),
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
      subscribeWeights(logs => setLatestWeight(logs.find(l => l.weightKg != null) ?? null)),
      subscribeNazar(setNazarLogs),
      subscribeMassage(setMassageLogs),
    ]
    const timer = setInterval(() => setTick(t => t + 1), 30000)
    return () => { unsubs.forEach(u => u()); clearInterval(timer) }
  }, [])

  void tick

  const today = todayInputDate()
  const isNazarDoneToday = nazarLogs.some(l => l.date === today)
  const isMassageDoneToday = massageLogs.some(l => l.date === today)
  const overdueMeds = medicines.filter(m => hasMedicineOverdue(medLogs, m))
  const feedCountdown = lastFeed ? feedCountdownLabel(lastFeed, feedSettings) : null

  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div className="px-4 py-4">
      <div className="mb-4">
        <p className="text-purple-500 text-xs">{greeting}</p>
        <h1 className="text-xl font-bold text-purple-900">Bubdu's Day 🍼</h1>
      </div>

      {/* Next feed countdown + Weight */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => navigate('/feeding')}
          className={`flex-1 rounded-2xl p-3 flex items-center gap-3 shadow-sm active:scale-95 transition-transform ${
            !feedCountdown ? 'bg-white' :
            feedCountdown.overdue ? 'bg-red-50 border border-red-200' :
            feedCountdown.urgent ? 'bg-orange-50 border border-orange-200' :
            'bg-purple-50 border border-purple-100'
          }`}
        >
          <div className={`p-2.5 rounded-xl shrink-0 ${
            !feedCountdown ? 'bg-gray-100 text-gray-400' :
            feedCountdown.overdue ? 'bg-red-100 text-red-600' :
            feedCountdown.urgent ? 'bg-orange-100 text-orange-600' :
            'bg-purple-100 text-purple-700'
          }`}>
            <Clock size={20} />
          </div>
          <div className="flex-1 text-left min-w-0">
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
                   `${lastFeed ? feedIntervalLabel(lastFeed, feedSettings) : '2.5h'} from end of last feed`}
                </p>
              </>
            ) : (
              <p className="text-base font-bold text-gray-400">No feeds logged yet</p>
            )}
          </div>
        </button>

        <button
          onClick={() => navigate('/growth')}
          className="w-[68px] shrink-0 bg-white rounded-2xl p-2 shadow-sm flex flex-col items-center justify-center gap-0.5 active:scale-95 transition-transform"
        >
          <Scale size={18} className="text-purple-500" />
          <p className="text-base font-bold text-gray-900 tabular-nums leading-tight">
            {latestWeight?.weightKg != null ? latestWeight.weightKg.toFixed(3) : '—'}
          </p>
          <p className="text-[10px] text-gray-400">kg</p>
        </button>
      </div>

      {(() => {
        const bottleMl = todayFeeds.filter(l => l.type === 'bottle').reduce((s, l) => s + (l.amountMl ?? 0), 0)
        const formulaMl = todayFeeds.filter(l => l.type === 'formula').reduce((s, l) => s + (l.amountMl ?? 0), 0)
        const grandMl = bottleMl + formulaMl
        const breastFeeds = todayFeeds.filter(l => l.type === 'breast')
        const breastMins = breastFeeds.reduce((s, l) => s + (l.durationMin ?? 0), 0)
        if (grandMl === 0 && breastFeeds.length === 0) return null
        const mlParts: string[] = []
        if (bottleMl > 0) mlParts.push(`🍼 ${bottleMl}ml`)
        if (formulaMl > 0) mlParts.push(`🥛 ${formulaMl}ml`)
        return (
          <button onClick={() => navigate('/feeding')} className="w-full bg-purple-50 rounded-xl px-3 py-2.5 mb-3 flex flex-wrap gap-x-5 gap-y-1 active:bg-purple-100 transition-colors text-left">
            {grandMl > 0 && (
              <span className="text-sm text-purple-900 font-bold">
                {mlParts.join(' + ')}{mlParts.length > 1 ? ` = ${grandMl}ml` : ''}
              </span>
            )}
            {breastFeeds.length > 0 && (
              <span className="text-sm text-purple-900 font-bold">
                🤱 Breast ({breastFeeds.length} {breastFeeds.length === 1 ? 'time' : 'times'}{breastMins > 0 ? ` · ${breastMins} mins` : ''})
              </span>
            )}
          </button>
        )
      })()}

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

      {/* Diapers + Nazar + Massage row */}
      <div className="bg-white rounded-2xl shadow-sm mb-4">
        <div className="grid grid-cols-5 divide-x divide-gray-100">
          <button
            onClick={() => navigate('/diapers', { state: { openModal: true, type: 'wet' } })}
            className="flex flex-col items-center gap-0.5 py-3 active:bg-gray-50 rounded-l-2xl transition-colors"
          >
            <span className="text-xl">💧</span>
            <span className="text-sm font-bold text-gray-800">{diaperCounts.wet}</span>
          </button>
          <button
            onClick={() => navigate('/diapers', { state: { openModal: true, type: 'dirty' } })}
            className="flex flex-col items-center gap-0.5 py-3 active:bg-gray-50 transition-colors"
          >
            <span className="text-xl">💩</span>
            <span className="text-sm font-bold text-gray-800">{diaperCounts.dirty}</span>
          </button>
          <button
            onClick={() => navigate('/diapers')}
            className="flex flex-col items-center gap-0.5 py-3 active:bg-gray-50 transition-colors"
          >
            <span className="text-xl">🔄</span>
            <span className="text-sm font-bold text-gray-800">{diaperCounts.both}</span>
          </button>
          <button
            onClick={() => navigate('/nazar')}
            className="flex flex-col items-center gap-0.5 py-3 active:bg-gray-50 transition-colors"
          >
            <span className="text-xl">🧿</span>
            <span className={`text-xs font-semibold ${isNazarDoneToday ? 'text-green-600' : 'text-red-500'}`}>
              {isNazarDoneToday ? 'Done' : 'Pending'}
            </span>
          </button>
          <button
            onClick={() => navigate('/nazar')}
            className="flex flex-col items-center gap-0.5 py-3 active:bg-gray-50 rounded-r-2xl transition-colors"
          >
            <span className="text-xl">💆</span>
            <span className={`text-xs font-semibold ${isMassageDoneToday ? 'text-green-600' : 'text-red-500'}`}>
              {isMassageDoneToday ? 'Done' : 'Pending'}
            </span>
          </button>
        </div>
      </div>

      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Quick Log</h2>
      <div className="grid grid-cols-6 gap-1.5">
        <QuickButton emoji="🤱" label="Breast"   onClick={() => navigate('/feeding', { state: { openModal: true, type: 'breast' } })} />
        <QuickButton emoji="🍼" label="Bottle"   onClick={() => navigate('/feeding', { state: { openModal: true, type: 'bottle' } })} />
        <QuickButton emoji="🥛" label="Formula"  onClick={() => navigate('/feeding', { state: { openModal: true, type: 'formula' } })} />
        <QuickButton emoji="💧" label="Wet"      onClick={() => navigate('/diapers', { state: { openModal: true, type: 'wet' } })} />
        <QuickButton emoji="💩" label="Dirty"    onClick={() => navigate('/diapers', { state: { openModal: true, type: 'dirty' } })} />
        <QuickButton emoji="💊" label="Meds"     onClick={() => navigate('/medicines')} />
      </div>
    </div>
  )
}

function QuickButton({ emoji, label, onClick }: { emoji: string; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-xl py-2 flex flex-col items-center gap-0.5 shadow-sm active:scale-95 transition-transform"
    >
      <span className="text-lg">{emoji}</span>
      <span className="text-[10px] text-gray-600 leading-tight">{label}</span>
    </button>
  )
}
