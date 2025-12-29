const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const db = app.database()

const VIEW_CONTACT_THRESHOLD = 30
const DAILY_LIMIT = 20

function pickUid(event, context) {
  try {
    const raw = process.env.TCB_CONTEXT || process.env._SCF_TCB_CONTEXT
    if (raw) {
      const parsed = JSON.parse(String(raw))
      const auth = (parsed && parsed.auth) || {}
      const v = String(auth.uid || auth.openid || auth.openId || auth.unionid || '').trim()
      if (v) return v
    }
  } catch {
    // ignore
  }

  const candidates = [
    context && context.auth && context.auth.uid,
    context && context.auth && context.auth.openid,
    event && event.userInfo && event.userInfo.uid,
    event && event.userInfo && event.userInfo.openId,
    event && event.uid,
  ]

  for (const c of candidates) {
    const v = String(c || '').trim()
    if (v) return v
  }

  return ''
}

function dayKey(ts) {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${da}`
}

async function getUserPoints(uid) {
  try {
    const r = await db.collection('users').doc(uid).get()
    const u = r && r.data && r.data[0]
    return Number((u && u.points) || 0)
  } catch {
    return 0
  }
}

exports.main = async (event, context) => {
  try {
    const action = String((event && event.action) || '').trim()
    if (action !== 'unlock') return { success: false, error: 'UNKNOWN_ACTION' }

    const uid = pickUid(event, context)
    if (!uid) return { success: false, error: 'UNAUTHENTICATED' }

    const demandId = String((event && event.demand_id) || '').trim()
    const targetProvider = String((event && event.target_provider_user_id) || '').trim()
    const targetRawId = String((event && event.target_raw_id) || '').trim()

    if (!demandId || !targetProvider) return { success: false, error: 'INVALID_PARAMS' }

    const points = await getUserPoints(uid)
    if (points < VIEW_CONTACT_THRESHOLD) {
      return { success: false, error: 'INSUFFICIENT_POINTS', points, threshold: VIEW_CONTACT_THRESHOLD }
    }

    const now = Date.now()
    const dkey = dayKey(now)

    const logKey = `unlock_${dkey}_${uid}_${demandId}_${targetProvider}`
    const dailyKey = `daily_${dkey}_${uid}`

    const dailyColl = db.collection('sap_contact_unlock_limits')
    const logColl = db.collection('sap_contact_unlock_logs')

    let dailyCount = 0
    try {
      const r = await dailyColl.doc(dailyKey).get()
      const doc = r && r.data && r.data[0]
      dailyCount = Number((doc && doc.count) || 0)
    } catch {
      dailyCount = 0
    }

    if (dailyCount >= DAILY_LIMIT) {
      return { success: false, error: 'DAILY_LIMIT', limit: DAILY_LIMIT, count: dailyCount }
    }

    try {
      const existed = await logColl.doc(logKey).get()
      const d = existed && existed.data && existed.data[0]
      if (d) {
        return { success: true, already: true, key: logKey }
      }
    } catch {
      // ignore
    }

    await logColl.doc(logKey).set({
      _id: logKey,
      uid,
      demand_id: demandId,
      target_provider_user_id: targetProvider,
      target_raw_id: targetRawId || null,
      day: dkey,
      createdAt: new Date(),
    })

    await dailyColl.doc(dailyKey).set({
      _id: dailyKey,
      uid,
      day: dkey,
      count: dailyCount + 1,
      updatedAt: new Date(),
    })

    return { success: true, key: logKey, count: dailyCount + 1, limit: DAILY_LIMIT }
  } catch (e) {
    const msg = String(e && e.message ? e.message : 'UNKNOWN_ERROR')
    return { success: false, error: msg }
  }
}
