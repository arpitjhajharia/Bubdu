import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import { doc, setDoc, Timestamp } from 'firebase/firestore'
import { app, db } from './firebase'

const messaging = getMessaging(app)
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export async function registerForNotifications(): Promise<boolean> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return false
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const swReg = await navigator.serviceWorker.ready
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg })
    if (!token) return false

    await setDoc(doc(db, 'fcmTokens', token), {
      token,
      updatedAt: Timestamp.now(),
      ua: navigator.userAgent.substring(0, 120),
    })
    return true
  } catch (err) {
    console.error('FCM registration failed:', err)
    return false
  }
}

export type ForegroundMessageHandler = (title: string, body: string) => void

export function onForegroundMessage(handler: ForegroundMessageHandler) {
  return onMessage(messaging, payload => {
    handler(
      payload.notification?.title ?? 'Bubdu',
      payload.notification?.body ?? ''
    )
  })
}
