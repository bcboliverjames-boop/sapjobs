import { getOrCreateUserProfile } from './user'

function getApiBase(): string {
  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
        const forced =
          (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
        const forcedTrim = String(forced || '').trim()
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\b/i.test(forcedTrim)) return forcedTrim
        return 'http://127.0.0.1:3001'
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

const USER_BULK_TTL_MS = 8000
const userStatusesBulkCache = new Map<string, { ts: number; data: Record<string, string[]> }>()
const userStatusesBulkInflight = new Map<string, Promise<Record<string, string[]>>>()
const userReliabilityBulkCache = new Map<string, { ts: number; data: Record<string, boolean | null> }>()
const userReliabilityBulkInflight = new Map<string, Promise<Record<string, boolean | null>>>()

function buildDemandIdsKey(demandIds: string[]): string {
  const uniq = Array.from(new Set((demandIds || []).map((x) => String(x || '').trim()).filter(Boolean))).slice(0, 200)
  uniq.sort()
  return uniq.join(',')
}

function isLocalhostRuntime(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const hostname = String(window.location && (window.location as any).hostname || '')
    const host = String(window.location && (window.location as any).host || '')
    const href = String(window.location && (window.location as any).href || '')
    if (/^(localhost|127\.0\.0\.1)$/i.test(hostname)) return true
    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) return true
    if (/\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(href)) return true
    return false
  } catch {
    return false
  }
}

function getStoredToken(): string {
  try {
    const base = String(API_BASE || '')
    if (/\b(localhost|127\.0\.0\.1)\b/i.test(base)) return ''
  } catch {}

  if (isLocalhostRuntime()) return ''
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

export const statusOptions = [
  { value: 'applied', label: '已投递', icon: '📤', confirmMessage: '确认已投递该需求？' },
  { value: 'interviewed', label: '已面试', icon: '💼', confirmMessage: '确认已参加该需求面试？' },
  { value: 'onboarded', label: '已到岗', icon: '✅', confirmMessage: '确认已到岗？\n\n标记“已到岗”后，其他用户将看到此需求已有顾问入职，这有助于大家了解岗位实时状态。' },
  { value: 'closed', label: '已关闭', icon: '🔒', confirmMessage: '确认需求已关闭？\n\n标记“已关闭”后，其他用户将看到此需求已停止招人。' },
]

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

  if (!resp || resp.ok !== true || !resp.counts) {
    throw new Error((resp && resp.error) || 'DEMAND_STATUS_COUNTS_FAILED')
  }

  return {
    applied: Number(resp.counts.applied || 0),
    interviewed: Number(resp.counts.interviewed || 0),
    onboarded: Number(resp.counts.onboarded || 0),
    closed: Number(resp.counts.closed || 0),
  }
}

export async function getDemandStatusCountsBulk(
  demandIds: string[]
): Promise<Record<string, { applied: number; interviewed: number; onboarded: number; closed: number }>> {
  const uniq = Array.from(new Set((demandIds || []).map((x) => String(x || '').trim()).filter(Boolean))).slice(0, 200)
  if (!uniq.length) return {}

  const resp: any = await requestJson({
    url: `${API_BASE}/demand_status/counts_bulk`,
    method: 'POST',
    data: {
      demandIds: uniq,
    },
  })

  if (!resp || resp.ok !== true || !resp.counts) {
    throw new Error((resp && resp.error) || 'DEMAND_STATUS_COUNTS_BULK_FAILED')
  }

  const out: Record<string, any> = {}
  uniq.forEach((id) => {
    const row = resp.counts[id]
    out[id] = {
      applied: Number(row?.applied || 0),
      interviewed: Number(row?.interviewed || 0),
      onboarded: Number(row?.onboarded || 0),
      closed: Number(row?.closed || 0),
    }
  })
  return out as any
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
  const resp: any = await requestJson({
    url: `${API_BASE}/demand_status/user?demandId=${encodeURIComponent(String(demandId || '').trim())}&userId=${encodeURIComponent(
      String(userId || '').trim(),
    )}`,
    method: 'GET',
    header: {
      'x-uid': String(userId || ''),
    },
  })

  if (!resp || !resp.ok || !Array.isArray(resp.statuses)) return []
  return resp.statuses.map((x: any) => String(x || '').trim()).filter(Boolean)
}

export async function getUserDemandStatusesBulk(
  demandIds: string[],
  userId: string
): Promise<Record<string, string[]>> {
  const uid = String(userId || '').trim()
  if (!uid) return {}

  const key = `${uid}|${buildDemandIdsKey(demandIds)}`
  if (key.endsWith('|')) return {}

  const now = Date.now()
  const cached = userStatusesBulkCache.get(key)
  if (cached && now - cached.ts <= USER_BULK_TTL_MS) return cached.data

  const inflight = userStatusesBulkInflight.get(key)
  if (inflight) return inflight

  const promise = (async () => {
    const uniq = Array.from(new Set((demandIds || []).map((x) => String(x || '').trim()).filter(Boolean))).slice(0, 200)
    if (!uniq.length) return {}

    const resp: any = await requestJson({
      url: `${API_BASE}/demand_status/user_bulk`,
      method: 'POST',
      data: {
        demandIds: uniq,
        userId: uid,
      },
      header: {
        'x-uid': String(uid || ''),
      },
    })

    const data: Record<string, string[]> = resp && resp.ok && resp.statuses ? (resp.statuses as any) : {}
    userStatusesBulkCache.set(key, { ts: Date.now(), data })
    return data
  })()

  userStatusesBulkInflight.set(key, promise)
  try {
    return await promise
  } finally {
    userStatusesBulkInflight.delete(key)
  }
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

  if (!resp || resp.ok !== true || !resp.counts) {
    throw new Error((resp && resp.error) || 'DEMAND_RELIABILITY_COUNTS_FAILED')
  }

  return {
    reliable: Number(resp.counts.reliable || 0),
    unreliable: Number(resp.counts.unreliable || 0),
  }
}

export async function getDemandReliabilityCountsBulk(
  demandIds: string[]
): Promise<Record<string, { reliable: number; unreliable: number }>> {
  const uniq = Array.from(new Set((demandIds || []).map((x) => String(x || '').trim()).filter(Boolean))).slice(0, 200)
  if (!uniq.length) return {}

  const resp: any = await requestJson({
    url: `${API_BASE}/demand_reliability/counts_bulk`,
    method: 'POST',
    data: {
      demandIds: uniq,
    },
  })

  if (!resp || resp.ok !== true || !resp.counts) {
    throw new Error((resp && resp.error) || 'DEMAND_RELIABILITY_COUNTS_BULK_FAILED')
  }

  const out: Record<string, any> = {}
  uniq.forEach((id) => {
    const row = resp.counts[id]
    out[id] = {
      reliable: Number(row?.reliable || 0),
      unreliable: Number(row?.unreliable || 0),
    }
  })
  return out as any
}

/**
 * 获取当前用户的评价（如果有）
 */
export async function getUserDemandReliability(
  demandId: string,
  userId: string
): Promise<boolean | null> {
  const resp: any = await requestJson({
    url: `${API_BASE}/demand_reliability/user?demandId=${encodeURIComponent(String(demandId || '').trim())}&userId=${encodeURIComponent(
      String(userId || '').trim(),
    )}`,
    method: 'GET',
    header: {
      'x-uid': String(userId || ''),
    },
  })

  if (!resp || !resp.ok) return null
  if (resp.reliable === true) return true
  if (resp.reliable === false) return false
  return null
}

export async function getUserDemandReliabilityBulk(
  demandIds: string[],
  userId: string
): Promise<Record<string, boolean | null>> {
  const uid = String(userId || '').trim()
  if (!uid) return {}

  const key = `${uid}|${buildDemandIdsKey(demandIds)}`
  if (key.endsWith('|')) return {}

  const now = Date.now()
  const cached = userReliabilityBulkCache.get(key)
  if (cached && now - cached.ts <= USER_BULK_TTL_MS) return cached.data

  const inflight = userReliabilityBulkInflight.get(key)
  if (inflight) return inflight

  const promise = (async () => {
    const uniq = Array.from(new Set((demandIds || []).map((x) => String(x || '').trim()).filter(Boolean))).slice(0, 200)
    if (!uniq.length) return {}

    const resp: any = await requestJson({
      url: `${API_BASE}/demand_reliability/user_bulk`,
      method: 'POST',
      data: {
        demandIds: uniq,
        userId: uid,
      },
      header: {
        'x-uid': String(uid || ''),
      },
    })

    const data: Record<string, boolean | null> = resp && resp.ok && resp.reliability ? (resp.reliability as any) : {}
    userReliabilityBulkCache.set(key, { ts: Date.now(), data })
    return data
  })()

  userReliabilityBulkInflight.set(key, promise)
  try {
    return await promise
  } finally {
    userReliabilityBulkInflight.delete(key)
  }
}
