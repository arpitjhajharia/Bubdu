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

  // ── Medicine overdue alerts ─────────────────────────────────────────────
  const medsSnap = await db.collection('medicines').where('active', '==', true).get()

  for (const medDoc of medsSnap.docs) {
    const med = medDoc.data()
    const logsSnap = await db.collection('medicineLogs')
      .where('medicineId', '==', medDoc.id)
      .orderBy('givenAt', 'desc')
      .limit(1)
      .get()

    let overdueMins: number | null = null
    if (logsSnap.empty) {
      overdueMins = 0
    } else {
      const lastGiven: number = logsSnap.docs[0].data().givenAt.toMillis()
      const nextDue = lastGiven + (med.frequencyHours as number) * 3600000
      const diff = now - nextDue
      if (diff > 0) overdueMins = Math.floor(diff / 60000)
    }

    // Alert once per cycle when 30+ min overdue
    if (overdueMins !== null && overdueMins >= 30) {
      const alertKey = `alerted_overdue_${medDoc.id}`
      const lastAlerted: number = (med[alertKey] as admin.firestore.Timestamp | undefined)?.toMillis?.() ?? 0
      if (now - lastAlerted > (med.frequencyHours as number) * 3600000) {
        const who = med.for === 'baby' ? 'Bubdu 👶' : 'Mother 👩'
        await sendNotification(
          '🚨 Medicine Overdue',
          `${med.name as string} for ${who} is ${overdueMins} min overdue. Dose: ${med.dosage as string} ${med.unit as string}`
        )
        await medDoc.ref.update({ [alertKey]: admin.firestore.Timestamp.now() })
      }
    }
  }

  // ── Feeding late alert (no feed in 3 hours) ─────────────────────────────
  const feedSnap = await db.collection('feedingLogs').orderBy('startedAt', 'desc').limit(1).get()
  if (!feedSnap.empty) {
    const lastFeedMs: number = feedSnap.docs[0].data().startedAt.toMillis()
    const diffMins = Math.floor((now - lastFeedMs) / 60000)
    // Alert once in the 3h–3h15m window
    if (diffMins >= 180 && diffMins < 195) {
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
