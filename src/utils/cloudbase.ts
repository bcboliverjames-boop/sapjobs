export const isValidEnvId = true

export const app: any = null
export const auth: any = null

const GUEST_UID_KEY = 'sapboss_guest_uid'

const API_TOKEN_KEY = 'sapboss_api_token'
const API_UID_KEY = 'sapboss_api_uid'

const LAST_LOGIN_IDENTIFIER_KEY = 'sapboss_last_login_identifier'
const LAST_LOGIN_IDENTIFIER_TYPE_KEY = 'sapboss_last_login_identifier_type'

function isH5Runtime() {
  try {
    return typeof window !== 'undefined'
  } catch {
    return false
  }
}

function safeReadStorage(key: string): string {
  try {
    return String(uni.getStorageSync(key) || '').trim()
  } catch {
    return ''
  }
}

function safeWriteStorage(key: string, val: string) {
  try {
    uni.setStorageSync(key, String(val || ''))
  } catch {}
}

function decodeBase64Json(b64url: string): any {
  const b64 = String(b64url || '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)

  if (typeof atob === 'function') {
    return JSON.parse(atob(padded))
  }

  try {
    const B: any = (globalThis as any).Buffer
    if (B && typeof B.from === 'function') {
      return JSON.parse(B.from(padded, 'base64').toString('utf8'))
    }
  } catch {}

  return null
}

function getUidFromJwt(token: string): string {
  const t = String(token || '').trim()
  if (!t) return ''
  try {
    const parts = t.split('.')
    if (parts.length < 2) return ''
    const payload = decodeBase64Json(parts[1])
    if (!payload) return ''
    return String((payload as any).uid || (payload as any).sub || '').trim()
  } catch {
    return ''
  }
}

function getOrCreateGuestUser() {
  const read = () => {
    try {
      return String(uni.getStorageSync(GUEST_UID_KEY) || '').trim()
    } catch {
      return ''
    }
  }

  let uid = read()
  if (!uid) {
    uid = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
    try {
      uni.setStorageSync(GUEST_UID_KEY, uid)
    } catch {}
  }

  return {
    uid,
    nickName: '游客',
    nickname: '游客',
    _isGuest: true,
  }
}

export function isGuestUser(user: any) {
  if (!user) return false
  if ((user as any).user || (user as any).isAnonymousAuth || (user as any).isAnonymousAuth) {
    const state: any = user as any
    if (state && (state.isAnonymousAuth || state.isAnonymousAuth)) return true
    return !!(state && state.user && (state.user as any)._isGuest)
  }
  return !!((user as any)._isGuest)
}

let lastGuestPromptAt = 0

function isRestrictedRoute(route: string) {
  return (
    route.includes('pages/demand/publish') ||
    route.includes('pages/message/chat') ||
    route.includes('pages/message/list') ||
    route.includes('pages/profile/profile')
  )
}

async function promptLoginOnce() {
  const now = Date.now()
  if (lastGuestPromptAt && now - lastGuestPromptAt < 1500) return
  lastGuestPromptAt = now

  let route = ''
  try {
    const pages = (uni as any).getCurrentPages ? (uni as any).getCurrentPages() : []
    const last = pages && pages.length ? pages[pages.length - 1] : null
    route = String((last && (last.route || last.__route__)) || '')
    if (route.includes('pages/login')) return
  } catch {}

  const confirmed = await new Promise<boolean>((resolve) => {
    try {
      uni.showModal({
        title: '需要登录',
        content: '登录后才能使用该功能',
        confirmText: '去登录',
        cancelText: '继续浏览',
        success: (res) => resolve(!!(res as any)?.confirm),
        fail: () => resolve(false),
      })
    } catch {
      resolve(false)
    }
  })

  if (confirmed) {
    try {
      uni.navigateTo({ url: '/pages/login/password-login' })
    } catch {}
    return
  }

  if (isRestrictedRoute(route)) {
    try {
      uni.navigateBack({
        delta: 1,
        fail: () => {
          try {
            uni.reLaunch({ url: '/pages/index/index' })
          } catch {}
        },
      })
    } catch {
      try {
        uni.reLaunch({ url: '/pages/index/index' })
      } catch {}
    }
  }
}

export async function requireNonGuest() {
  const state: any = await ensureLogin()
  const user = state && state.user
  if (isGuestUser(user)) {
    await promptLoginOnce()
    throw new Error('GUEST_READONLY')
  }
  return state
}

/**
 * 初始化云开发实例
 * @param {Object} config - 初始化配置
 * @param {string} config.env - 环境ID，默认使用ENV_ID
 * @param {number} config.timeout - 超时时间，默认15000ms
 * @returns {Object} 云开发实例
 */
export const init = (config: any = {}) => {
  return {
    config,
    disabled: true,
  } as any
};

/**
 * 检查环境配置是否有效
 */
export const checkEnvironment = () => {
  return true
};


/**
 * 执行登录
 * @returns {Promise} 登录状态
 */
export const login = async () => {
  // CloudBase 登录已禁用，统一采用“游客态 + 密码登录获取 JWT”。
  return
};

/**
 * 确保用户已登录
 * @returns {Promise} 登录状态
 */
export const ensureLogin = async () => {
  const storedJwt = safeReadStorage(API_TOKEN_KEY)
  let uid = safeReadStorage(API_UID_KEY)

  if (storedJwt && !uid) {
    uid = getUidFromJwt(storedJwt)
    if (uid) safeWriteStorage(API_UID_KEY, uid)
  }

  if (storedJwt && uid) {
    return {
      user: {
        uid,
        nickName: '',
        nickname: '',
        _isGuest: false,
        _isLocalAuth: true,
      },
      isLocalAuth: true,
    } as any
  }

  return { user: getOrCreateGuestUser(), isAnonymousAuth: true } as any
};

/**
 * 初始化云开发
 * 自动进行匿名登录
 */
export async function initCloudBase() {
  try {
    await ensureLogin()
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * 退出登录（注意：匿名登录无法退出）
 * @returns {Promise}
 */
export const logout = async () => {
  try {
    try {
      ;(uni as any).removeStorageSync(API_TOKEN_KEY)
      ;(uni as any).removeStorageSync(API_UID_KEY)
      ;(uni as any).removeStorageSync(LAST_LOGIN_IDENTIFIER_KEY)
      ;(uni as any).removeStorageSync(LAST_LOGIN_IDENTIFIER_TYPE_KEY)
      ;(uni as any).removeStorageSync(GUEST_UID_KEY)
    } catch {
      try {
        uni.setStorageSync(API_TOKEN_KEY, '')
        uni.setStorageSync(API_UID_KEY, '')
        uni.setStorageSync(LAST_LOGIN_IDENTIFIER_KEY, '')
        uni.setStorageSync(LAST_LOGIN_IDENTIFIER_TYPE_KEY, '')
        uni.setStorageSync(GUEST_UID_KEY, '')
      } catch {}
    }

    return { success: true, message: '已成功退出登录' }
  } catch (error) {
    console.error('退出登录失败:', error);
    throw error;
  }
};

// 默认导出
export default {
  init,
  app,
  auth,
  ensureLogin,
  requireNonGuest,
  isGuestUser,
  login,
  logout,
  checkEnvironment,
  isValidEnvId,
  initCloudBase,
};