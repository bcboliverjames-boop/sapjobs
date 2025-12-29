import { app, ensureLogin } from './cloudbase'
import { getOrCreateUserProfile } from './user'

async function callFn<T = any>(name: string, data: Record<string, any>): Promise<T> {
  await ensureLogin()
  const r: any = await app.callFunction({
    name,
    data,
  })

  const result = r && r.result
  if (result !== undefined && result !== null) return result as T

  const err = String((r && (r.error || r.errMsg || r.message)) || '').trim()
  if (err) {
    return { success: false, error: err } as any as T
  }

  return { success: false, error: 'CALL_FUNCTION_FAILED' } as any as T
}

export async function ugcCommentAdd(params: { demand_id: string; content: string }) {
  return callFn('ugc', {
    action: 'comment_add',
    demand_id: params.demand_id,
    content: params.content,
  })
}

export async function ugcReplyAdd(params: { demand_id: string; comment_id: string; content: string }) {
  return callFn('ugc', {
    action: 'reply_add',
    demand_id: params.demand_id,
    comment_id: params.comment_id,
    content: params.content,
  })
}

export async function ugcReactionToggle(params: { demand_id: string; comment_id: string; field: 'likes' | 'dislikes' }) {
  return callFn('ugc', {
    action: 'reaction_toggle',
    demand_id: params.demand_id,
    comment_id: params.comment_id,
    field: params.field,
  })
}

export async function unlockContact(params: {
  demand_id: string
  target_provider_user_id: string
  target_raw_id?: string
}) {
  await ensureLogin()
  const profile = await getOrCreateUserProfile()

  return new Promise((resolve, reject) => {
    uni.request({
      url: 'https://api.sapboss.com/contact_unlock',
      method: 'POST',
      data: {
        action: 'unlock',
        demand_id: params.demand_id,
        target_provider_user_id: params.target_provider_user_id,
        target_raw_id: params.target_raw_id || '',
      },
      header: {
        'Content-Type': 'application/json',
        'x-uid': String(profile.uid || ''),
        'x-nickname': String(profile.nickname || ''),
      },
      success: (res) => {
        resolve((res as any)?.data)
      },
      fail: (err) => {
        reject(err)
      },
    })
  })
}
