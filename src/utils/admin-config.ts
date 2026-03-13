import { requireAdmin } from './admin'

export type SimilarityRule = 'text' | 'category' | 'hybrid'

export type AdminConfigDoc = {
  _id?: string
  similarity_enabled: boolean
  similarity_threshold: number
  similarity_rule: SimilarityRule
  updated_by?: string
  updatedAt?: any
  updatedAt_ts?: number
}

const COLLECTION = 'sap_admin_config'
const CONFIG_KEY_FIELD = 'config_key'
const CONFIG_KEY_VALUE = 'global'

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
    return String(uni.getStorageSync(API_TOKEN_KEY) || '').trim()
  } catch {
    return ''
  }
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

export function getDefaultAdminConfig(): AdminConfigDoc {
  return {
    similarity_enabled: true,
    similarity_threshold: 0.85,
    similarity_rule: 'text',
  }
}

function normalizeRule(v: any): SimilarityRule {
  const s = String(v || '').trim()
  if (s === 'category' || s === 'hybrid' || s === 'text') return s
  return 'text'
}

function normalizeThreshold(v: any): number {
  const n = Number(v)
  if (!Number.isFinite(n)) return 0.85
  return Math.max(0.5, Math.min(0.99, n))
}

export async function fetchAdminConfig(): Promise<AdminConfigDoc> {
  try {
    const resp: any = await requestJson({
      url: `${API_BASE}/config/similarity`,
      method: 'GET',
    })

    const cfg = resp && resp.ok ? resp.config : null
    if (!cfg) return getDefaultAdminConfig()

    return {
      _id: String((cfg as any)._id || '').trim() || undefined,
      similarity_enabled: (cfg as any).similarity_enabled !== false,
      similarity_threshold: normalizeThreshold((cfg as any).similarity_threshold),
      similarity_rule: normalizeRule((cfg as any).similarity_rule),
      updated_by: (cfg as any).updated_by,
      updatedAt: (cfg as any).updatedAt,
      updatedAt_ts: Number((cfg as any).updatedAt_ts) || undefined,
    }
  } catch {
    return getDefaultAdminConfig()
  }
}

export async function saveAdminConfig(patch: Partial<AdminConfigDoc>): Promise<AdminConfigDoc> {
  const admin = await requireAdmin()

  const token = getStoredToken()
  if (!token) {
    throw new Error('JWT_REQUIRED')
  }

  const resp: any = await requestJson({
    url: `${API_BASE}/config/similarity`,
    method: 'POST',
    data: {
      similarity_enabled: patch.similarity_enabled,
      similarity_threshold: patch.similarity_threshold,
      similarity_rule: patch.similarity_rule,
    },
    header: {
      'x-uid': String(admin.uid || ''),
      'x-nickname': '',
    },
  })

  if (!resp || !resp.ok || !resp.config) {
    throw new Error((resp && resp.error) || 'SAVE_ADMIN_CONFIG_FAILED')
  }

  const cfg = resp.config as any
  return {
    _id: String(cfg._id || '').trim() || undefined,
    similarity_enabled: cfg.similarity_enabled !== false,
    similarity_threshold: normalizeThreshold(cfg.similarity_threshold),
    similarity_rule: normalizeRule(cfg.similarity_rule),
    updated_by: cfg.updated_by || admin.uid,
    updatedAt: cfg.updatedAt,
    updatedAt_ts: Number(cfg.updatedAt_ts) || Date.now(),
  }
}
