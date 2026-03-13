/**
 * 私信功能工具函数
 */

import { getOrCreateUserProfile, getProfilesByIds } from './user'

function getApiBase(): string {
  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
        const forced =
          (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
        const forcedTrim = String(forced || '').trim()
        if (forcedTrim) return forcedTrim
        return 'https://api.sapboss.com'
      }
    }
  } catch {
    // ignore
  }

  const fromEnv =
    (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
  if (fromEnv) return String(fromEnv)

  return 'https://api.sapboss.com'
}

const API_BASE = getApiBase()
const API_TOKEN_KEY = 'sapboss_api_token'

function getStoredToken(): string {
  try {
    const u: any = typeof uni !== 'undefined' ? (uni as any) : null
    if (u && typeof u.getStorageSync === 'function') {
      return String(u.getStorageSync(API_TOKEN_KEY) || '').trim()
    }
  } catch {}

  try {
    if (typeof window !== 'undefined' && (window as any).localStorage) {
      return String((window as any).localStorage.getItem(API_TOKEN_KEY) || '').trim()
    }
  } catch {}

  return ''
}

function requestJson<T = any>(opts: {
  url: string
  method?: 'GET' | 'POST'
  data?: any
  header?: any
}): Promise<T> {
  return new Promise((resolve, reject) => {
    const storedToken = getStoredToken()
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

/**
 * 发送私信
 */
export async function sendMessage(
  toUserId: string,
  content: string,
  demandId?: string
): Promise<void> {
  const user = await getOrCreateUserProfile()

  const resp: any = await requestJson({
    url: `${API_BASE}/messages/send`,
    method: 'POST',
    data: {
      toUserId,
      content: String(content || '').trim(),
      demandId: demandId || '',
    },
    header: {
      'x-uid': String(user.uid || ''),
      'x-nickname': encodeURIComponent(String(user.nickname || '')),
    },
  })

  if (!resp || !resp.ok) {
    throw new Error((resp && resp.error) || 'SEND_MESSAGE_FAILED')
  }
}

/**
 * 获取对话列表（当前用户的所有对话）
 */
export async function getConversations(): Promise<any[]> {
  const user = await getOrCreateUserProfile()

  const resp: any = await requestJson({
    url: `${API_BASE}/messages/conversations`,
    method: 'GET',
    header: {
      'x-uid': String(user.uid || ''),
      'x-nickname': encodeURIComponent(String(user.nickname || '')),
    },
  })

  if (!resp || !resp.ok || !Array.isArray(resp.conversations)) {
    throw new Error((resp && resp.error) || 'GET_CONVERSATIONS_FAILED')
  }

  const conversations = resp.conversations as any[]

  // 获取对方用户信息
  const userIds = conversations.map((c) => String(c && c.other_user_id ? c.other_user_id : '').trim()).filter(Boolean)
  if (userIds.length > 0) {
    const profilesById = await getProfilesByIds(userIds)
    conversations.forEach((conv) => {
      const pid = String(conv.other_user_id || '').trim()
      conv.other_user = (pid && profilesById[pid]) || {
        nickname: '未知用户',
        uid: conv.other_user_id,
      }
    })
  }

  return conversations
}

/**
 * 获取与指定用户的对话消息
 */
export async function getMessagesWithUser(otherUserId: string): Promise<any[]> {
  const user = await getOrCreateUserProfile()

  const resp: any = await requestJson({
    url: `${API_BASE}/messages/with?otherUserId=${encodeURIComponent(String(otherUserId || '').trim())}`,
    method: 'GET',
    header: {
      'x-uid': String(user.uid || ''),
      'x-nickname': encodeURIComponent(String(user.nickname || '')),
    },
  })

  if (!resp || !resp.ok || !Array.isArray(resp.messages)) {
    throw new Error((resp && resp.error) || 'GET_MESSAGES_FAILED')
  }

  return resp.messages as any[]
}

/**
 * 获取未读消息数量
 */
export async function getUnreadCount(): Promise<number> {
  try {
    const user = await getOrCreateUserProfile()

    const resp: any = await requestJson({
      url: `${API_BASE}/messages/unread_count`,
      method: 'GET',
      header: {
        'x-uid': String(user.uid || ''),
        'x-nickname': encodeURIComponent(String(user.nickname || '')),
      },
    })

    if (!resp || !resp.ok) return 0
    return Number(resp.count || 0)
  } catch (e) {
    console.error('获取未读消息数量失败:', e)
    return 0
  }
}





























