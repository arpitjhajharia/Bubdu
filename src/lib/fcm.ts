import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { app, db } from './firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

// Lazy so module load never throws in unsupported environments (regular Safari, SSR, etc.)
let _messaging: ReturnType<typeof getMessaging> | null = null
function messaging() {
  if (!_messaging) _messaging = getMessaging(app)
  return _messaging
}

export type NotifStatus = 'ok' | 'denied' | 'unsupported' | 'error'

export async function registerForNotifications(): Promise<NotifStatus> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return 'denied'

    const swReg = await navigator.serviceWorker.ready
    const token = await getToken(messaging(), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg,
    })

    if (!token) {
      await saveDebugError('getToken returned null — check VAPID key in Firebase console')
      return 'error'
    }

    await setDoc(doc(db, 'fcmTokens', token), {
      token,
      updatedAt: Timestamp.now(),
      ua: navigator.userAgent.substring(0, 200),
    })
    return 'ok'
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err)
    console.error('FCM registration failed:', err)
    await saveDebugError(msg)
    return 'error'
  }
}

async function saveDebugError(error: string) {
  try {
    await setDoc(doc(db, 'fcmDebug', 'lastError'), {
      error,
      ua: navigator.userAgent.substring(0, 200),
      at: Timestamp.now(),
    })
  } catch (_) { /* best-effort */ }
}

export function getInitialNotifStatus(): NotifStatus {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported'
  if (Notification.permission === 'granted') return 'ok'
  if (Notification.permission === 'denied') return 'denied'
  return 'error'  // 'default' = not yet asked
}

export type ForegroundMessageHandler = (title: string, body: string) => void

export function onForegroundMessage(handler: ForegroundMessageHandler) {
  try {
    return onMessage(messaging(), payload => {
      handler(
        payload.notification?.title ?? 'Bubdu',
        payload.notification?.body ?? ''
      )
    })
  } catch (_) {
    return () => {}
  }
}
