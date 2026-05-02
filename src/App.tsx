import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import { registerForNotifications, onForegroundMessage } from '@/lib/fcm'

const CORRECT_PIN = import.meta.env.VITE_APP_PIN || '260426'
const AUTH_KEY = 'bubdu_authed'

interface Toast { title: string; body: string }

export default function App() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(AUTH_KEY) === '1')
  const [toast, setToast] = useState<Toast | null>(null)

  async function handlePin(pin: string) {
    if (pin !== CORRECT_PIN) return false
    await ensureAuth()
    localStorage.setItem(AUTH_KEY, '1')
    setAuthed(true)
    return true
  }

  useEffect(() => {
    if (!authed) return
    ensureAuth()
    registerForNotifications()

    const unsub = onForegroundMessage((title, body) => {
      setToast({ title, body })
      setTimeout(() => setToast(null), 5000)
    })
    return unsub
  }, [authed])

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
      <Routes>
        <Route element={<Layout />}>
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
