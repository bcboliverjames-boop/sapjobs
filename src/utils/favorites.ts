/**
 * 收藏功能工具函数
 */

import { getOrCreateUserProfile } from './user'

function getApiBase(): string {
  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
        const forced = (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || ''
        return forced ? String(forced) : 'http://127.0.0.1:3001'
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

/**
 * 收藏需求
 */
export async function addFavorite(demandId: string): Promise<void> {
  const user = await getOrCreateUserProfile()

  const resp: any = await requestJson({
    url: `${API_BASE}/favorites/add`,
    method: 'POST',
    data: { demandId },
    header: {
      'x-uid': String(user.uid || ''),
      'x-nickname': String(user.nickname || ''),
    },
  })

  if (!resp || !resp.ok) {
    throw new Error((resp && resp.error) || 'FAVORITE_ADD_FAILED')
  }
}

/**
 * 取消收藏
 */
export async function removeFavorite(demandId: string): Promise<void> {
  const user = await getOrCreateUserProfile()

  const resp: any = await requestJson({
    url: `${API_BASE}/favorites/remove`,
    method: 'POST',
    data: { demandId },
    header: {
      'x-uid': String(user.uid || ''),
      'x-nickname': String(user.nickname || ''),
    },
  })

  if (!resp || !resp.ok) {
    throw new Error((resp && resp.error) || 'FAVORITE_REMOVE_FAILED')
  }
}

/**
 * 检查是否已收藏
 */
export async function isFavorite(demandId: string): Promise<boolean> {
  try {
    const storedToken = (() => {
      try {
        return String(uni.getStorageSync(API_TOKEN_KEY) || '').trim()
      } catch {
        return ''
      }
    })()

    const header = storedToken
      ? undefined
      : (() => {
          // Local auth (x-uid) fallback
          return undefined
        })()

    const uidHeader = !storedToken
      ? (() => {
          return null
        })()
      : null

    const url = `${API_BASE}/favorites/check?demandId=${encodeURIComponent(String(demandId || '').trim())}`

    // First try with stored token (if any)
    const resp1: any = await requestJson({
      url,
      method: 'GET',
    })

    if (resp1 && resp1.ok) return !!resp1.favorited

    const err1 = String((resp1 && resp1.error) || '').trim()
    const shouldRetryLocal = !storedToken || err1 === 'UNAUTHORIZED'
    if (!shouldRetryLocal) return false

    // Retry with local auth headers (x-uid)
    const user = await getOrCreateUserProfile()
    const resp2: any = await requestJson({
      url,
      method: 'GET',
      header: {
        'x-uid': String(user.uid || ''),
        'x-nickname': String(user.nickname || ''),
      },
    })

    if (!resp2 || !resp2.ok) return false
    return !!resp2.favorited
  } catch (e) {
    console.error('Failed to check favorite status:', e)
    return false
  }
}

/**
 * 批量检查收藏状态
 */
export async function checkFavoritesStatus(demandIds: string[]): Promise<Set<string>> {
  try {
    const storedToken = (() => {
      try {
        return String(uni.getStorageSync(API_TOKEN_KEY) || '').trim()
      } catch {
        return ''
      }
    })()

    if (demandIds.length === 0) {
      return new Set()
    }

    const url = `${API_BASE}/favorites/check_batch`

    // First try with stored token (if any)
    const resp1: any = await requestJson({
      url,
      method: 'POST',
      data: { demandIds },
    })

    if (resp1 && resp1.ok && Array.isArray(resp1.favorites)) {
      return new Set(resp1.favorites.map((x: any) => String(x || '').trim()).filter(Boolean))
    }

    const err1 = String((resp1 && resp1.error) || '').trim()
    const shouldRetryLocal = !storedToken || err1 === 'UNAUTHORIZED'
    if (!shouldRetryLocal) return new Set()

    const user = await getOrCreateUserProfile()
    const resp2: any = await requestJson({
      url,
      method: 'POST',
      data: { demandIds },
      header: {
        'x-uid': String(user.uid || ''),
        'x-nickname': String(user.nickname || ''),
      },
    })

    if (!resp2 || !resp2.ok || !Array.isArray(resp2.favorites)) return new Set()
    return new Set(resp2.favorites.map((x: any) => String(x || '').trim()).filter(Boolean))
  } catch (e) {
    console.error('Failed to check favorites status:', e)
    return new Set()
  }
}

/**
 * 
 */
// ... (rest of the code remains the same)


























