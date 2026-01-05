import { ensureLogin, requireNonGuest } from './cloudbase'

export type UserProfile = {
  _id?: string // 使用 auth uid 作为主键
  uid: string
  nickname?: string
  expertise_modules?: string // 逗号分隔的模块，如 "FICO,MM,SD"
  years_of_exp?: number
  avatar_url?: string
  wechat_id?: string
  qq_id?: string
  occupation?: string
  can_share_contact?: boolean
  points: number
  createdAt?: any
  updatedAt?: any
}

export type AccountInfo = {
  identifier_type?: string
  identifier_masked?: string
  phone?: string
  email?: string
  username?: string
}

const API_BASE = (import.meta as any)?.env?.VITE_API_BASE_URL || 'https://api.sapboss.com'
const API_TOKEN_KEY = 'sapboss_api_token'
const LAST_LOGIN_IDENTIFIER_KEY = 'sapboss_last_login_identifier'
const LAST_LOGIN_IDENTIFIER_TYPE_KEY = 'sapboss_last_login_identifier_type'

function detectIdentifierTypeClient(raw: string): { type: string; norm: string } {
  const s = String(raw || '').trim()
  if (!s) return { type: '', norm: '' }

  const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s)
  if (isEmail) return { type: 'email', norm: s.toLowerCase() }

  const isCnPhone = /^1[3-9]\d{9}$/.test(s)
  if (isCnPhone) return { type: 'phone', norm: s }

  const isUsername = /^[a-zA-Z0-9_]{3,20}$/.test(s)
  if (isUsername) return { type: 'username', norm: s.toLowerCase() }

  if (s.length >= 3) return { type: 'username', norm: s.toLowerCase() }
  return { type: '', norm: '' }
}

function persistLastLoginIdentifier(identifier: string) {
  const { type, norm } = detectIdentifierTypeClient(identifier)
  if (!type || !norm) return
  try {
    uni.setStorageSync(LAST_LOGIN_IDENTIFIER_KEY, norm)
    uni.setStorageSync(LAST_LOGIN_IDENTIFIER_TYPE_KEY, type)
  } catch {}
}

export function getLastLoginIdentifier(): { type: string; value: string } | null {
  try {
    const value = String(uni.getStorageSync(LAST_LOGIN_IDENTIFIER_KEY) || '').trim()
    const type = String(uni.getStorageSync(LAST_LOGIN_IDENTIFIER_TYPE_KEY) || '').trim()
    if (value && type) return { type, value }
    if (value) {
      const detected = detectIdentifierTypeClient(value)
      if (detected.type && detected.norm) return { type: detected.type, value: detected.norm }
    }
  } catch {}
  return null
}

function clearApiTokenCache() {
  try {
    ;(uni as any).removeStorageSync(API_TOKEN_KEY)
    return
  } catch {}

  try {
    uni.setStorageSync(API_TOKEN_KEY, '')
  } catch {}
}

function requestJson<T = any>(opts: {
  url: string
  method?: 'GET' | 'POST'
  data?: any
  header?: any
  __attempt?: number
  __skipAuthRefresh?: boolean
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
      success: async (res) => {
        const statusCode = Number((res as any)?.statusCode || 0)
        const url = String(opts.url || '')
        const isAuthExchange = /\/get_auth_token\b/.test(url) || /\/auth\/exchange\b/.test(url)

        if (
          statusCode === 401 &&
          !opts.__skipAuthRefresh &&
          !isAuthExchange &&
          (opts.__attempt || 0) < 1
        ) {
          try {
            clearApiTokenCache()
            await ensureApiToken()

            const next = await requestJson<T>({
              ...opts,
              __attempt: (opts.__attempt || 0) + 1,
              __skipAuthRefresh: true,
            })
            resolve(next)
            return
          } catch (e) {
            reject(e)
            return
          }
        }

        resolve((res as any)?.data as T)
      },
      fail: (err) => reject(err),
    })
  })
}

export async function ensureApiToken(): Promise<string> {
  try {
    const existed = String(uni.getStorageSync(API_TOKEN_KEY) || '').trim()
    if (existed) return existed
  } catch {}

  // CloudBase exchange is disabled: token must be obtained via self-hosted login (/auth/login or /auth/register)
  await requireNonGuest()
  throw new Error('JWT_REQUIRED')
}

export async function loginWithPassword(identifier: string, password: string): Promise<{ uid: string; token: string }> {
  const resp: any = await requestJson({
    url: `${API_BASE}/auth/login`,
    method: 'POST',
    data: {
      identifier: String(identifier || '').trim(),
      password: String(password || ''),
    },
    __skipAuthRefresh: true,
  })

  const token = String((resp && resp.token) || '').trim()
  const uid = String((resp && resp.uid) || '').trim()
  if (!resp || !resp.ok || !token || !uid) {
    throw new Error((resp && resp.error) || 'LOGIN_FAILED')
  }

  try {
    uni.setStorageSync(API_TOKEN_KEY, token)
  } catch {}

  persistLastLoginIdentifier(identifier)

  return { uid, token }
}

export async function registerWithPassword(
  identifier: string,
  password: string,
  profile: { occupation: string; wechat_id?: string; qq_id?: string } | undefined = undefined,
): Promise<{ uid: string; token: string }> {
  const resp: any = await requestJson({
    url: `${API_BASE}/auth/register`,
    method: 'POST',
    data: {
      identifier: String(identifier || '').trim(),
      password: String(password || ''),
      occupation: String(profile?.occupation || '').trim(),
      wechat_id: String(profile?.wechat_id || '').trim(),
      qq_id: String(profile?.qq_id || '').trim(),
    },
    __skipAuthRefresh: true,
  })

  const token = String((resp && resp.token) || '').trim()
  const uid = String((resp && resp.uid) || '').trim()
  if (!resp || !resp.ok || !token || !uid) {
    throw new Error((resp && resp.error) || 'REGISTER_FAILED')
  }

  try {
    uni.setStorageSync(API_TOKEN_KEY, token)
  } catch {}

  persistLastLoginIdentifier(identifier)

  return { uid, token }
}

// 获取当前登录用户的 auth 信息（没有则抛错）
export async function getCurrentAuthUser() {
  const state = await ensureLogin()
  if (!state || !state.user) {
    throw new Error('当前未登录')
  }
  return state.user
}

async function getAuthHeaders() {
  const user = await getCurrentAuthUser()
  const uid = user.uid as string
  const nickname = String((user as any).nickName || (user as any).nickname || '')

  if (!(user as any)?._isGuest) {
    try {
      await ensureApiToken()
    } catch {}
  }

  return {
    'x-uid': String(uid || ''),
    'x-nickname': String(nickname || ''),
  }
}

export async function getProfilesByIds(ids: string[]): Promise<Record<string, UserProfile>> {
  await ensureLogin()
  const headers = await getAuthHeaders()

  const safeIds = (Array.isArray(ids) ? ids : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)

  if (!safeIds.length) return {}

  const resp: any = await requestJson({
    url: `${API_BASE}/get_profiles`,
    method: 'POST',
    data: { ids: safeIds },
    header: headers,
  })

  if (!resp || !resp.ok || !Array.isArray(resp.profiles)) {
    throw new Error((resp && resp.error) || 'GET_PROFILES_FAILED')
  }

  const map: Record<string, UserProfile> = {}
  for (const p of resp.profiles) {
    if (!p) continue
    const uid = String((p as any).uid || (p as any)._id || '').trim()
    if (uid) map[uid] = p as UserProfile

    const _id = String((p as any)._id || '').trim()
    if (_id) map[_id] = p as UserProfile

    if (uid && uid.startsWith('prov_')) {
      const raw = uid.slice('prov_'.length)
      if (raw) map[raw] = p as UserProfile
    }
  }

  return map
}

export async function getMyAccountInfo(): Promise<AccountInfo | null> {
  await ensureLogin()

  try {
    const headers = await getAuthHeaders()
    const resp: any = await requestJson({
      url: `${API_BASE}/get_profile`,
      method: 'GET',
      header: headers,
    })

    if (resp && resp.ok && resp.account) return resp.account as AccountInfo
    return null
  } catch {
    return null
  }
}

// 获取或创建用户档案
export async function getOrCreateUserProfile(): Promise<UserProfile> {
  await requireNonGuest()

  const headers = await getAuthHeaders()
  const resp: any = await requestJson({
    url: `${API_BASE}/get_or_create_profile`,
    method: 'POST',
    data: {},
    header: headers,
  })

  if (resp && resp.ok && resp.profile) return resp.profile as UserProfile
  throw new Error((resp && resp.error) || 'GET_OR_CREATE_PROFILE_FAILED')
}

// 更新用户档案（同时可调整积分）
export async function updateUserProfile(
  patch: Partial<UserProfile>,
  options: { addPoints?: number; account?: { phone?: string; email?: string } } = {},
): Promise<UserProfile> {
  await requireNonGuest()
  const headers = await getAuthHeaders()

  const resp: any = await requestJson({
    url: `${API_BASE}/update_profile`,
    method: 'POST',
    data: {
      patch,
      addPoints: typeof options.addPoints === 'number' ? options.addPoints : 0,
      account: options.account || undefined,
    },
    header: headers,
  })

  if (resp && resp.ok && resp.profile) return resp.profile as UserProfile
  throw new Error((resp && resp.error) || 'UPDATE_PROFILE_FAILED')
}

// 仅读取当前档案（不存在则返回 null）
export async function getUserProfileOnly(): Promise<UserProfile | null> {
  await ensureLogin()

  try {
    const headers = await getAuthHeaders()
    const resp: any = await requestJson({
      url: `${API_BASE}/get_profile`,
      method: 'GET',
      header: headers,
    })

    if (resp && resp.ok && resp.profile) return resp.profile as UserProfile
    return null
  } catch {
    return null
  }
}



