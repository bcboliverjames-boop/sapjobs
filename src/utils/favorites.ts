/**
 * 收藏功能工具函数
 */

import { getOrCreateUserProfile } from './user'

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

const FAVORITES_BULK_TTL_MS = 8000
const favoritesBulkCache = new Map<string, { ts: number; data: Set<string> }>()
const favoritesBulkInflight = new Map<string, Promise<Set<string>>>()

function buildDemandIdsKey(demandIds: string[]): string {
  const uniq = Array.from(new Set((demandIds || []).map((x) => String(x || '').trim()).filter(Boolean))).slice(0, 200)
  uniq.sort()
  return uniq.join(',')
}

function safeReadToken(): string {
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
    const storedToken = safeReadToken()

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
      'x-nickname': encodeURIComponent(String(user.nickname || '')),
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
      'x-nickname': encodeURIComponent(String(user.nickname || '')),
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
    const storedToken = safeReadToken()

    if (!storedToken) return false

    const url = `${API_BASE}/favorites/check?demandId=${encodeURIComponent(String(demandId || '').trim())}`

    // First try with stored token (if any)
    const resp1: any = await requestJson({
      url,
      method: 'GET',
    })

    if (resp1 && resp1.ok) return !!resp1.favorited

    return false
  } catch (e) {
    return false
  }
}

/**
 * 批量检查收藏状态
 */
export async function checkFavoritesStatus(demandIds: string[]): Promise<Set<string>> {
  try {
    const storedToken = safeReadToken()

    if (!storedToken) return new Set<string>()

    if (demandIds.length === 0) {
      return new Set<string>()
    }

    const key = buildDemandIdsKey(demandIds)
    if (!key) return new Set<string>()

    const now = Date.now()
    const cached = favoritesBulkCache.get(key)
    if (cached && now - cached.ts <= FAVORITES_BULK_TTL_MS) return cached.data

    const inflight = favoritesBulkInflight.get(key)
    if (inflight) return inflight

    const url = `${API_BASE}/favorites/check_batch`

    const promise: Promise<Set<string>> = (async () => {
      const uniq = Array.from(new Set((demandIds || []).map((x) => String(x || '').trim()).filter(Boolean))).slice(0, 200)
      if (!uniq.length) return new Set<string>()

      // First try with stored token (if any)
      const resp1: any = await requestJson({
        url,
        method: 'POST',
        data: { demandIds: uniq },
      })

      const out: Set<string> =
        resp1 && resp1.ok && Array.isArray(resp1.favorites)
          ? new Set<string>(resp1.favorites.map((x: any) => String(x || '').trim()).filter(Boolean))
          : new Set<string>()
      favoritesBulkCache.set(key, { ts: Date.now(), data: out })
      return out
    })()

    favoritesBulkInflight.set(key, promise)
    try {
      return await promise
    } finally {
      favoritesBulkInflight.delete(key)
    }
  } catch (e) {
    return new Set()
  }
}

/**
 * 
 */
// ... (rest of the code remains the same)


























