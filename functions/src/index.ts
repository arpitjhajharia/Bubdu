import * as admin from 'firebase-admin'
import { onSchedule } from 'firebase-functions/v2/scheduler'

admin.initializeApp()
const db = admin.firestore()

async function getTokens(): Promise<string[]> {
  const snap = await db.collection('fcmTokens').get()
  return snap.docs.map(d => d.data().token as string).filter(Boolean)
}

async function sendNotification(title: string, body: string): Promise<void> {
  const tokens = await getTokens()
  if (tokens.length === 0) {
    console.log('No FCM tokens registered, skipping:', title)
    return
  }
  const response = await admin.messaging().sendEachForMulticast({ tokens, notification: { title, body } })
  // Remove expired/invalid tokens
  const toDelete = response.responses
    .map((r, i) => (!r.success && r.error?.code === 'messaging/registration-token-not-registered' ? tokens[i] : null))
    .filter((t): t is string => t !== null)
  await Promise.all(toDelete.map(t => db.collection('fcmTokens').doc(t).delete()))
}

// Runs every 15 minutes — checks overdue medicines and late feeds
export const checkAlerts = onSchedule('every 15 minutes', async () => {
  const now = Date.now()

  // ── Medicine dose alerts ─────────────────────────────────────────────────
  const medsSnap = await db.collection('medicines').where('active', '==', true).get()

  // Current time as HH:MM for comparison
  const nowDate = new Date(now)
  const nowHHMM = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`
  const todayStr = nowDate.toDateString()

  // Load today's medicine logs once
  const todayStart = new Date(nowDate); todayStart.setHours(0, 0, 0, 0)
  const todayLogsSnap = await db.collection('medicineLogs')
    .where('givenAt', '>=', admin.firestore.Timestamp.fromDate(todayStart))
    .get()
  const todayLogs = todayLogsSnap.docs.map(d => d.data())

  for (const medDoc of medsSnap.docs) {
    const med = medDoc.data()
    const doseTimes = (med.doseTimes ?? []) as Array<{ label: string; time: string }>
    const who = med.for === 'baby' ? 'Bubdu 👶' : 'Mother 👩'

    for (const dose of doseTimes) {
      // Check if this dose was already given today
      const alreadyGiven = todayLogs.some(
        l => l.medicineId === medDoc.id && l.doseLabel === dose.label && l.givenAt.toDate().toDateString() === todayStr
      )
      if (alreadyGiven) continue

      // Parse dose time
      const [dh, dm] = dose.time.split(':').map(Number)
      const [nh, nm] = nowHHMM.split(':').map(Number)
      const doseMinutes = dh * 60 + dm
      const nowMinutes = nh * 60 + nm
      const diff = doseMinutes - nowMinutes

      // Alert 15 min before (window: 14–16 min to avoid double-alerting)
      if (diff >= 14 && diff <= 16) {
        await sendNotification(
          `💊 ${dose.label} medicine due in 15 min`,
          `${med.name as string} for ${who} — ${med.dosage as string} ${med.unit as string}`
        )
      }

      // Alert when overdue by 15 min (window: 14–16 min past due)
      if (diff >= -16 && diff <= -14) {
        await sendNotification(
          `🚨 ${dose.label} medicine overdue`,
          `${med.name as string} for ${who} was due at ${dose.time}. Please give now.`
        )
      }
    }
  }

  // ── Feeding late alert (no feed in 3 hours) ─────────────────────────────
  const feedSnap = await db.collection('feedingLogs').orderBy('startedAt', 'desc').limit(1).get()
  if (!feedSnap.empty) {
    const lastFeedMs: number = feedSnap.docs[0].data().startedAt.toMillis()
    const diffMins = Math.floor((now - lastFeedMs) / 60000)
    // Alert once in the 3.5h–3h45m window
    if (diffMins >= 210 && diffMins < 225) {
      await sendNotification(
        '🍼 Time to Feed Bubdu',
        `No feed in ${Math.floor(diffMins / 60)}h ${diffMins % 60}m. Bubdu might be hungry!`
      )
    }
  }
})

// Runs every morning at 7 AM IST (01:30 UTC)
export const dailySummary = onSchedule('30 1 * * *', async () => {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  yesterday.setHours(0, 0, 0, 0)
  const startTs = admin.firestore.Timestamp.fromDate(yesterday)
  const endTs = admin.firestore.Timestamp.fromDate(new Date(yesterday.getTime() + 86400000))

  const [feedSnap, diaperSnap] = await Promise.all([
    db.collection('feedingLogs').where('startedAt', '>=', startTs).where('startedAt', '<', endTs).get(),
    db.collection('diaperLogs').where('changedAt', '>=', startTs).where('changedAt', '<', endTs).get(),
  ])

  const totalFeeds = feedSnap.size
  const breastFeeds = feedSnap.docs.filter(d => d.data().type === 'breast').length
  const bottleFeeds = totalFeeds - breastFeeds
  const nursingMin = feedSnap.docs
    .filter(d => d.data().type === 'breast')
    .reduce((sum, d) => sum + ((d.data().durationMin as number) ?? 0), 0)

  const wetDiapers = diaperSnap.docs.filter(d => ['wet', 'both'].includes(d.data().type as string)).length
  const dirtyDiapers = diaperSnap.docs.filter(d => ['dirty', 'both'].includes(d.data().type as string)).length

  const dateStr = yesterday.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })

  const lines = [
    `Feeds: ${totalFeeds} (${breastFeeds} breast · ${bottleFeeds} bottle)`,
    breastFeeds > 0 ? `Nursing: ${nursingMin} min` : null,
    `Diapers: ${wetDiapers} wet · ${dirtyDiapers} dirty`,
  ].filter(Boolean).join(' • ')

  await sendNotification(`🌅 Bubdu's summary — ${dateStr}`, lines)
})
