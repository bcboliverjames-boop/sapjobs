const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({
  env: tcb.SYMBOL_CURRENT_ENV,
})

const db = app.database()

const COMMENT_POINTS = 1
const COMMENT_LIKED_POINTS = 1

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

function sanitizeText(input, maxLen) {
  const s = String(input || '').replace(/\u0000/g, '').trim()
  if (!s) return ''
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

function containsForbiddenContent(text) {
  const s = String(text || '')
  if (!s) return false

  // URL
  if (/https?:\/\//i.test(s)) return true

  // Phone number (CN)
  if (/\b1[3-9]\d{9}\b/.test(s)) return true

  // WeChat / vx patterns
  const hasWeChatHint = /(微信|vx|v信|wechat|加v|加V|加微)/i.test(s)
  const wechatIdLike = /[a-zA-Z][a-zA-Z0-9_-]{4,}/.test(s)
  if (hasWeChatHint && wechatIdLike) return true

  // QQ number patterns
  const hasQqHint = /(qq|Qq|QQ群|加群)/.test(s)
  const qqNumLike = /\b[1-9]\d{4,11}\b/.test(s)
  if (hasQqHint && qqNumLike) return true

  return false
}

async function enforceInterval(uid, key, minIntervalMs) {
  const id = `rate_${uid}_${key}`
  const coll = db.collection('sap_rate_limits')
  const now = Date.now()

  try {
    const r = await coll.doc(id).get()
    const doc = r && r.data && r.data[0]
    const last = doc && doc.last_ts ? Number(doc.last_ts) : 0
    if (last && now - last < minIntervalMs) {
      throw new Error('TOO_FREQUENT')
    }
  } catch (e) {
    const msg = String(e && e.message ? e.message : '')
    if (msg === 'TOO_FREQUENT') throw e
    // ignore missing doc
  }

  await coll.doc(id).set({
    _id: id,
    uid,
    key,
    last_ts: now,
    updatedAt: new Date(),
  })
}

async function getNickname(uid) {
  try {
    const r = await db.collection('users').doc(uid).get()
    const u = r && r.data && r.data[0]
    const name = String((u && (u.nickname || u.nickName || u.username)) || '').trim()
    return name || '匿名用户'
  } catch {
    return '匿名用户'
  }
}

async function addPointsToUser(targetUid, delta) {
  const duid = String(targetUid || '').trim()
  const d = Number(delta || 0)
  if (!duid || !Number.isFinite(d) || d <= 0) return

  try {
    const coll = db.collection('users')
    const res = await coll.doc(duid).get()
    const existed = res && res.data && res.data[0]
    if (!existed) return
    const current = Number(existed.points || 0)
    const next = Math.max(0, current + d)
    await coll.doc(duid).update({
      points: next,
      updatedAt: new Date(),
    })
  } catch {
    // ignore
  }
}

exports.main = async (event, context) => {
  try {
    const action = String((event && event.action) || '').trim()
    const uid = pickUid(event, context)
    if (!uid) {
      return { success: false, error: 'UNAUTHENTICATED' }
    }

    if (action === 'comment_add') {
      const demandId = String((event && event.demand_id) || '').trim()
      const content = sanitizeText(event && event.content, 200)
      if (!demandId || !content) return { success: false, error: 'INVALID_PARAMS' }
      if (containsForbiddenContent(content)) return { success: false, error: 'FORBIDDEN_CONTENT' }

      await enforceInterval(uid, 'comment_add', 15 * 1000)

      const nickname = await getNickname(uid)
      const result = await db.collection('sap_demand_comments').add({
        demand_id: demandId,
        content,
        nickname,
        user_id: uid,
        likes: 0,
        dislikes: 0,
        createdAt: new Date(),
      })

      await addPointsToUser(uid, COMMENT_POINTS)

      return { success: true, result }
    }

    if (action === 'reply_add') {
      const demandId = String((event && event.demand_id) || '').trim()
      const commentId = String((event && event.comment_id) || '').trim()
      const content = sanitizeText(event && event.content, 200)
      if (!demandId || !commentId || !content) return { success: false, error: 'INVALID_PARAMS' }
      if (containsForbiddenContent(content)) return { success: false, error: 'FORBIDDEN_CONTENT' }

      await enforceInterval(uid, 'reply_add', 8 * 1000)

      const nickname = await getNickname(uid)
      const result = await db.collection('sap_comment_replies').add({
        comment_id: commentId,
        demand_id: demandId,
        content,
        nickname,
        user_id: uid,
        createdAt: new Date(),
      })

      return { success: true, result }
    }

    if (action === 'reaction_toggle') {
      const commentId = String((event && event.comment_id) || '').trim()
      const demandId = String((event && event.demand_id) || '').trim()
      const field = String((event && event.field) || '').trim()

      if (!commentId || !demandId) return { success: false, error: 'INVALID_PARAMS' }
      if (field !== 'likes' && field !== 'dislikes') return { success: false, error: 'INVALID_PARAMS' }

      await enforceInterval(uid, 'reaction_toggle', 1500)

      const commentDoc = await db.collection('sap_demand_comments').doc(commentId).get()
      const commentData = commentDoc && commentDoc.data && commentDoc.data[0]
      if (!commentData) return { success: false, error: 'NOT_FOUND' }

      const currentLikes = Number(commentData.likes || 0)
      const currentDislikes = Number(commentData.dislikes || 0)

      const reactionsColl = db.collection('sap_comment_reactions')
      const uniqueKey = `${commentId}_${uid}`
      const existingRes = await reactionsColl.where({ unique_key: uniqueKey }).get()
      const existing = existingRes && existingRes.data && existingRes.data[0]
      const existingField = existing && existing.reaction ? String(existing.reaction) : ''

      let newLikes = currentLikes
      let newDislikes = currentDislikes
      if (!existingField) {
        if (field === 'likes') newLikes = currentLikes + 1
        else newDislikes = currentDislikes + 1
      } else if (existingField === field) {
        if (field === 'likes') newLikes = Math.max(0, currentLikes - 1)
        else newDislikes = Math.max(0, currentDislikes - 1)
      } else {
        if (field === 'likes') {
          newLikes = currentLikes + 1
          newDislikes = Math.max(0, currentDislikes - 1)
        } else {
          newLikes = Math.max(0, currentLikes - 1)
          newDislikes = currentDislikes + 1
        }
      }

      await db.collection('sap_demand_comments').doc(commentId).update({
        likes: newLikes,
        dislikes: newDislikes,
        updatedAt: new Date(),
      })

      if (!existingField) {
        await reactionsColl.add({
          unique_key: uniqueKey,
          comment_id: commentId,
          demand_id: demandId,
          user_id: uid,
          reaction: field,
          createdAt: new Date(),
        })
      } else if (existingField === field) {
        await reactionsColl.where({ unique_key: uniqueKey }).remove()
      } else {
        await reactionsColl.where({ unique_key: uniqueKey }).update({
          reaction: field,
          updatedAt: new Date(),
        })
      }

      const shouldReward = field === 'likes' && (!existingField || existingField === 'dislikes')

      if (shouldReward && commentData.user_id && String(commentData.user_id).trim() !== uid) {
        await addPointsToUser(commentData.user_id, COMMENT_LIKED_POINTS)
      }

      return {
        success: true,
        likes: newLikes,
        dislikes: newDislikes,
        comment_user_id: commentData.user_id || null,
        should_reward: shouldReward,
      }
    }

    return { success: false, error: 'UNKNOWN_ACTION' }
  } catch (e) {
    const msg = String(e && e.message ? e.message : 'UNKNOWN_ERROR')
    if (msg === 'TOO_FREQUENT') return { success: false, error: 'TOO_FREQUENT' }
    return { success: false, error: msg }
  }
}
