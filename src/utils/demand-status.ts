import { getOrCreateUserProfile } from './user'

function getApiBase(): string {
  const fromEnv =
    (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
  if (fromEnv) return String(fromEnv)

  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
        return 'https://api.sapboss.com'
      }
    }
  } catch {
    // ignore
  }

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
 * 标记需求状态
 * @param demandId 需求ID
 * @param status 状态：'applied' | 'interviewed' | 'onboarded' | 'closed'
 * @param nickname 用户昵称
 */
export async function markDemandStatus(
  demandId: string,
  status: 'applied' | 'interviewed' | 'onboarded' | 'closed',
  nickname: string
): Promise<void> {
  const user = await getOrCreateUserProfile()

  const resp: any = await requestJson({
    url: `${API_BASE}/demand_status/mark`,
    method: 'POST',
    data: {
      demandId,
      status,
      nickname,
    },
    header: {
      'x-uid': String(user.uid || ''),
      'x-nickname': encodeURIComponent(String(user.nickname || '')),
    },
  })

  if (!resp || !resp.ok) {
    throw new Error((resp && resp.error) || 'DEMAND_STATUS_MARK_FAILED')
  }
}

/**
 * 取消状态标记（可选功能）
 */
export async function unmarkDemandStatus(
  demandId: string,
  status: 'applied' | 'interviewed' | 'onboarded' | 'closed',
  userId: string
): Promise<void> {
  const user = await getOrCreateUserProfile()
  const uid = String(user.uid || '').trim()
  if (uid && userId && String(userId || '').trim() !== uid) {
    throw new Error('FORBIDDEN')
  }

  const resp: any = await requestJson({
    url: `${API_BASE}/demand_status/unmark`,
    method: 'POST',
    data: {
      demandId,
      status,
      userId: uid || userId,
    },
    header: {
      'x-uid': String(user.uid || ''),
      'x-nickname': encodeURIComponent(String(user.nickname || '')),
    },
  })

  if (!resp || !resp.ok) {
    throw new Error((resp && resp.error) || 'DEMAND_STATUS_UNMARK_FAILED')
  }
}

/**
 * 获取需求各状态的标记数量
 */
export async function getDemandStatusCounts(
  demandId: string
): Promise<{
  applied: number
  interviewed: number
  onboarded: number
  closed: number
}> {
  const resp: any = await requestJson({
    url: `${API_BASE}/demand_status/counts?demandId=${encodeURIComponent(String(demandId || '').trim())}`,
    method: 'GET',
  })

  if (!resp || !resp.ok || !resp.counts) {
    return { applied: 0, interviewed: 0, onboarded: 0, closed: 0 }
  }

  return {
    applied: Number(resp.counts.applied || 0),
    interviewed: Number(resp.counts.interviewed || 0),
    onboarded: Number(resp.counts.onboarded || 0),
    closed: Number(resp.counts.closed || 0),
  }
}

/**
 * 获取指定状态的最新标记昵称（按时间倒序取最新一条）
 */
export async function getLatestStatusNicknames(
  demandId: string,
  statuses: Array<'onboarded' | 'closed'>
): Promise<Record<'onboarded' | 'closed', string | undefined>> {
  const qs = encodeURIComponent(statuses.join(','))
  const resp: any = await requestJson({
    url: `${API_BASE}/demand_status/latest_nicknames?demandId=${encodeURIComponent(String(demandId || '').trim())}&statuses=${qs}`,
    method: 'GET',
  })

  const result: Record<'onboarded' | 'closed', string | undefined> = { onboarded: undefined, closed: undefined }
  if (!resp || !resp.ok || !resp.nicknames) return result
  if (resp.nicknames.onboarded) result.onboarded = String(resp.nicknames.onboarded)
  if (resp.nicknames.closed) result.closed = String(resp.nicknames.closed)
  return result
}

/**
 * 获取当前用户已标记的状态列表
 */
export async function getUserDemandStatuses(
  demandId: string,
  userId: string
): Promise<string[]> {
  const token = getStoredToken()
  if (!token) return []

  const resp: any = await requestJson({
    url: `${API_BASE}/demand_status/user?demandId=${encodeURIComponent(String(demandId || '').trim())}&userId=${encodeURIComponent(
      String(userId || '').trim(),
    )}`,
    method: 'GET',
  })

  if (!resp || !resp.ok || !Array.isArray(resp.statuses)) return []
  return resp.statuses.map((x: any) => String(x || '').trim()).filter(Boolean)
}

/**
 * 标记需求评价（靠谱/不靠谱）
 */
export async function markDemandReliability(
  demandId: string,
  reliable: boolean,
  nickname: string
): Promise<void> {
  const user = await getOrCreateUserProfile()

  const resp: any = await requestJson({
    url: `${API_BASE}/demand_reliability/mark`,
    method: 'POST',
    data: {
      demandId,
      reliable,
      nickname,
    },
    header: {
      'x-uid': String(user.uid || ''),
      'x-nickname': encodeURIComponent(String(user.nickname || '')),
    },
  })

  if (!resp || !resp.ok) {
    throw new Error((resp && resp.error) || 'DEMAND_RELIABILITY_MARK_FAILED')
  }
}

/**
 * 取消需求评价（如果已有相同评价则删除）
 */
export async function unmarkDemandReliability(
  demandId: string,
  userId: string
): Promise<void> {
  const user = await getOrCreateUserProfile()
  const uid = String(user.uid || '').trim()
  if (uid && userId && String(userId || '').trim() !== uid) {
    throw new Error('FORBIDDEN')
  }

  const resp: any = await requestJson({
    url: `${API_BASE}/demand_reliability/unmark`,
    method: 'POST',
    data: {
      demandId,
      userId: uid || userId,
    },
    header: {
      'x-uid': String(user.uid || ''),
      'x-nickname': encodeURIComponent(String(user.nickname || '')),
    },
  })

  if (!resp || !resp.ok) {
    throw new Error((resp && resp.error) || 'DEMAND_RELIABILITY_UNMARK_FAILED')
  }
}

/**
 * 获取需求评价数量
 */
export async function getDemandReliabilityCounts(
  demandId: string
): Promise<{
  reliable: number
  unreliable: number
}> {
  const resp: any = await requestJson({
    url: `${API_BASE}/demand_reliability/counts?demandId=${encodeURIComponent(String(demandId || '').trim())}`,
    method: 'GET',
  })

  if (!resp || !resp.ok || !resp.counts) {
    return { reliable: 0, unreliable: 0 }
  }

  return {
    reliable: Number(resp.counts.reliable || 0),
    unreliable: Number(resp.counts.unreliable || 0),
  }
}

/**
 * 获取当前用户的评价（如果有）
 */
export async function getUserDemandReliability(
  demandId: string,
  userId: string
): Promise<boolean | null> {
  const token = getStoredToken()
  if (!token) return null

  const resp: any = await requestJson({
    url: `${API_BASE}/demand_reliability/user?demandId=${encodeURIComponent(String(demandId || '').trim())}&userId=${encodeURIComponent(
      String(userId || '').trim(),
    )}`,
    method: 'GET',
  })

  if (!resp || !resp.ok) return null
  if (resp.reliable === true) return true
  if (resp.reliable === false) return false
  return null
}
