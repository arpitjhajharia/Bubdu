import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Bell, BellOff } from 'lucide-react'
import PinScreen from '@/components/PinScreen'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Feeding from '@/pages/Feeding'
import Diapers from '@/pages/Diapers'
import Medicines from '@/pages/Medicines'
import Weight from '@/pages/Weight'
import Nazar from '@/pages/Nazar'
import Reports from '@/pages/Reports'
import { ensureAuth } from '@/lib/firebase'
import {
  registerForNotifications, onForegroundMessage, getInitialNotifStatus,
  type NotifStatus,
} from '@/lib/fcm'

const CORRECT_PIN = import.meta.env.VITE_APP_PIN || '260426'
const AUTH_KEY = 'bubdu_authed'

interface Toast { title: string; body: string }

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === '1')
  const [toast, setToast] = useState<Toast | null>(null)
  const [notifStatus, setNotifStatus] = useState<NotifStatus>(() => getInitialNotifStatus())
  const [notifPending, setNotifPending] = useState(false)

  // For already-authed users (skip PIN), try registration on mount.
  // We still need a user gesture for iOS — so we only do this silently for
  // already-granted permission; otherwise the bell button provides the gesture.
  useEffect(() => {
    if (!authed) return
    ensureAuth()

    if (Notification.permission === 'granted') {
      // Re-register silently to refresh token — already granted, no popup needed
      registerForNotifications().then(setNotifStatus)
    }

    const unsub = onForegroundMessage((title, body) => {
      setToast({ title, body })
      setTimeout(() => setToast(null), 5000)
    })
    return unsub
  }, [authed])

  async function handlePin(pin: string) {
    if (pin !== CORRECT_PIN) return false
    await ensureAuth()
    localStorage.setItem(AUTH_KEY, '1')
    setAuthed(true)
    // Called here — within the user's tap gesture — which iOS requires
    const status = await registerForNotifications()
    setNotifStatus(status)
    return true
  }

  async function handleEnableNotifications() {
    setNotifPending(true)
    const status = await registerForNotifications()
    setNotifStatus(status)
    setNotifPending(false)
  }

  if (!authed) return <PinScreen onSubmit={handlePin} />

  return (
    <BrowserRouter>
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-purple-800 text-white px-5 py-3 rounded-2xl shadow-xl max-w-sm w-[90vw] cursor-pointer"
          onClick={() => setToast(null)}
        >
          <p className="font-semibold text-sm">{toast.title}</p>
          <p className="text-xs text-purple-200 mt-0.5">{toast.body}</p>
        </div>
      )}

      {/* Notification status bar — shown when not OK */}
      {notifStatus !== 'ok' && notifStatus !== 'unsupported' && (
        <div className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-md z-40 px-4 pt-3">
          <button
            onClick={handleEnableNotifications}
            disabled={notifPending || notifStatus === 'denied'}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shadow-md transition-opacity ${
              notifStatus === 'denied'
                ? 'bg-gray-100 text-gray-500'
                : 'bg-orange-50 border border-orange-200 text-orange-700 active:opacity-70'
            }`}
          >
            {notifStatus === 'denied'
              ? <BellOff size={14} className="shrink-0" />
              : <Bell size={14} className="shrink-0 text-orange-500" />
            }
            <span className="flex-1 text-left">
              {notifPending ? 'Enabling notifications…' :
               notifStatus === 'denied' ? 'Notifications blocked — enable in Settings › Safari' :
               'Tap to enable notifications'}
            </span>
          </button>
        </div>
      )}

      <Routes>
        <Route element={<Layout hasNotifBanner={notifStatus !== 'ok' && notifStatus !== 'unsupported'} />}>
          <Route index element={<Dashboard />} />
          <Route path="feeding" element={<Feeding />} />
          <Route path="diapers" element={<Diapers />} />
          <Route path="medicines" element={<Medicines />} />
          <Route path="weight" element={<Weight />} />
          <Route path="nazar" element={<Nazar />} />
          <Route path="reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
