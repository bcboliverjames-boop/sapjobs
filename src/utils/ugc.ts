import { requireNonGuest } from './cloudbase'
import { getOrCreateUserProfile } from './user'

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL || 'https://api.sapboss.com'

const API_TOKEN_KEY = 'sapboss_api_token'

function requestJson<T = any>(opts: {
  url: string
  method?: 'GET' | 'POST'
  data?: any
  header?: any
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const storedToken = (() => {
      try {
        return String(uni.getStorageSync(API_TOKEN_KEY) || '').trim()
      } catch {
        return ''
      }
    })()

    uni.request({
      url: opts.url,
      method: opts.method || 'GET',
      data: opts.data,
      header: {
        'Content-Type': 'application/json',
        ...(storedToken ? { Authorization: `Bearer ${storedToken}` } : {}),
        ...(opts.header || {}),
      },
      success: (res) => resolve((res as any)?.data as T),
      fail: (err) => reject(err),
    })
  })
}

export async function ugcCommentAdd(params: { demand_id: string; content: string }) {
  await requireNonGuest()
  const profile = await getOrCreateUserProfile()
  return requestJson({
    url: `${API_BASE}/ugc`,
    method: 'POST',
    data: {
      action: 'comment_add',
      demandId: params.demand_id,
      content: params.content,
    },
    header: {
      'x-uid': String(profile.uid || ''),
      'x-nickname': String(profile.nickname || ''),
    },
  })
}

export async function ugcReplyAdd(params: { demand_id: string; comment_id: string; content: string }) {
  await requireNonGuest()
  const profile = await getOrCreateUserProfile()
  return requestJson({
    url: `${API_BASE}/ugc`,
    method: 'POST',
    data: {
      action: 'reply_add',
      demandId: params.demand_id,
      commentId: params.comment_id,
      content: params.content,
    },
    header: {
      'x-uid': String(profile.uid || ''),
      'x-nickname': String(profile.nickname || ''),
    },
  })
}

export async function ugcReactionToggle(params: { demand_id: string; comment_id: string; field: 'likes' | 'dislikes' }) {
  await requireNonGuest()
  const profile = await getOrCreateUserProfile()
  return requestJson({
    url: `${API_BASE}/ugc`,
    method: 'POST',
    data: {
      action: 'reaction_toggle',
      demandId: params.demand_id,
      commentId: params.comment_id,
      reaction: params.field === 'likes' ? 'like' : 'dislike',
    },
    header: {
      'x-uid': String(profile.uid || ''),
      'x-nickname': String(profile.nickname || ''),
    },
  })
}

export async function unlockContact(params: {
  demand_id: string
  target_provider_user_id: string
  target_raw_id?: string
}) {
  await requireNonGuest()
  const profile = await getOrCreateUserProfile()

  const token = (() => {
    try {
      return String(uni.getStorageSync('sapboss_api_token') || '').trim()
    } catch {
      return ''
    }
  })()

  return new Promise((resolve, reject) => {
    uni.request({
      url: `${API_BASE}/contact_unlock`,
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
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success: (res) => resolve((res as any)?.data),
      fail: (err) => reject(err),
    })
  })
}
