import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Bell, BellOff, X } from 'lucide-react'
import PinScreen from '@/components/PinScreen'
import Layout from '@/components/Layout'
import Dashboard from '@/pages/Dashboard'
import Feeding from '@/pages/Feeding'
import Diapers from '@/pages/Diapers'
import Medicines from '@/pages/Medicines'
import Growth from '@/pages/Growth'
import Nazar from '@/pages/Nazar'
import Reports from '@/pages/Reports'
import { ensureAuth } from '@/lib/firebase'
import {
  registerForNotifications, onForegroundMessage, getInitialNotifStatus,
  type NotifStatus,
} from '@/lib/fcm'
import type { NotifResult } from '@/lib/fcm'

const CORRECT_PIN = import.meta.env.VITE_APP_PIN || '260426'
const AUTH_KEY = 'bubdu_authed'

interface Toast { title: string; body: string }

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === '1')
  const [toast, setToast] = useState<Toast | null>(null)
  const [notifStatus, setNotifStatus] = useState<NotifStatus>(() => getInitialNotifStatus())
  const [notifError, setNotifError] = useState<string | undefined>(undefined)
  const [notifPending, setNotifPending] = useState(false)
  const [showNotifHelp, setShowNotifHelp] = useState(false)

  function applyNotifResult(r: NotifResult) {
    setNotifStatus(r.status)
    if (r.error) setNotifError(r.error)
  }

  // For already-authed users (skip PIN), try registration on mount.
  // We still need a user gesture for iOS — so we only do this silently for
  // already-granted permission; otherwise the bell button provides the gesture.
  useEffect(() => {
    if (!authed) return
    ensureAuth()

    if (Notification.permission === 'granted') {
      // Re-register silently to refresh token — already granted, no popup needed
      registerForNotifications().then(applyNotifResult)
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
    applyNotifResult(await registerForNotifications())
    return true
  }

  async function handleEnableNotifications() {
    setNotifPending(true)
    applyNotifResult(await registerForNotifications())
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
            onClick={(notifStatus === 'denied' || notifError) ? () => setShowNotifHelp(true) : handleEnableNotifications}
            disabled={notifPending}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shadow-md transition-opacity ${
              notifStatus === 'denied'
                ? 'bg-red-50 border border-red-200 text-red-700 active:opacity-70'
                : 'bg-orange-50 border border-orange-200 text-orange-700 active:opacity-70'
            }`}
          >
            {notifStatus === 'denied'
              ? <BellOff size={14} className="shrink-0" />
              : <Bell size={14} className="shrink-0 text-orange-500" />
            }
            <span className="flex-1 text-left">
              {notifPending ? 'Enabling notifications…' :
               notifStatus === 'denied' ? 'Notifications blocked — tap for fix steps' :
               notifStatus === 'error' && notifError ? 'Notification setup failed — tap for details' :
               'Tap to enable notifications'}
            </span>
          </button>
        </div>
      )}

      {/* Help modal for denied / error state */}
      {showNotifHelp && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-end" onClick={() => setShowNotifHelp(false)}>
          <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-5 pb-10" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-base font-bold text-gray-900">Fix notifications (iOS)</h2>
              <button onClick={() => setShowNotifHelp(false)} className="text-gray-400"><X size={20} /></button>
            </div>

            {notifError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
                <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">Error detail</p>
                <p className="text-xs text-red-700 break-all font-mono">{notifError}</p>
              </div>
            )}

            <p className="text-xs text-gray-500 mb-4">
              {notifStatus === 'denied'
                ? 'iOS has blocked notifications at the browser level. System Settings being ON is not enough — you need to reset the app\'s permission.'
                : 'The permission was granted but FCM token registration failed. This usually means APNs is not configured in Firebase Console.'}
            </p>
            {[
              'Long press the Bubdu icon → Remove App → Delete',
              'Open Settings → Safari → Advanced → Website Data → find your app domain → swipe → Delete',
              'Open Safari and go to the app URL',
              'Tap Share → Add to Home Screen',
              'Open Bubdu from home screen → enter PIN',
              'Tap Allow when the notification dialog appears',
            ].map((step, i) => (
              <div key={i} className="flex gap-2.5 mb-2.5">
                <span className="w-5 h-5 rounded-full bg-purple-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                <p className="text-sm text-gray-700">{step}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <Routes>
        <Route element={<Layout hasNotifBanner={notifStatus !== 'ok' && notifStatus !== 'unsupported'} />}>
          <Route index element={<Dashboard />} />
          <Route path="feeding" element={<Feeding />} />
          <Route path="diapers" element={<Diapers />} />
          <Route path="medicines" element={<Medicines />} />
          <Route path="growth" element={<Growth />} />
          <Route path="weight" element={<Navigate to="/growth" replace />} />
          <Route path="nazar" element={<Nazar />} />
          <Route path="reports" element={<Reports />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
