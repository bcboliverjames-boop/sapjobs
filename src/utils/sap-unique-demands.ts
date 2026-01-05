export type SapUniqueDemandDoc = {
  _id?: string
  local_id?: number
  raw_text?: string
  tags_json?: string
  attributes_json?: string
  publisher_name?: string
  provider_id?: string
  demand_type?: string
  richness_score?: number

  created_time?: string | Date | null
  message_time?: string | Date | null
  updated_at?: string | Date | null
  last_updated_time?: string | Date | null

  created_time_ts?: number | null
  message_time_ts?: number | null
  updated_at_ts?: number | null
  last_updated_time_ts?: number | null

  synced_at?: string
  source?: string
}

export const UNIQUE_DEMANDS_COLLECTION = 'sap_unique_demands'

const UNIQUE_API_BASE =
  (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || 'https://api.sapboss.com'

function requestJson<T = any>(opts: { url: string; method?: 'GET' | 'POST'; data?: any; header?: any }): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: opts.url,
      method: opts.method || 'GET',
      data: opts.data,
      header: {
        'Content-Type': 'application/json',
        ...(opts.header || {}),
      },
      success: (res) => resolve((res as any)?.data as T),
      fail: (err) => reject(err),
    })
  })
}

function buildQueryString(params: Record<string, string>): string {
  const pairs: string[] = []
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null) return
    pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  })
  return pairs.join('&')
}

function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function fetchUniqueDemandsCountByTimeRange(opts: {
  startTs: number
  endTs: number
  field?: 'message_time_ts' | 'created_time_ts' | 'last_updated_time_ts' | 'updated_at_ts'
  onlyValid?: boolean
}): Promise<number> {
  const field = opts.field || 'created_time_ts'

  const base = String(UNIQUE_API_BASE).replace(/\/+$/, '')
  const qs = buildQueryString({
    startTs: String(opts.startTs),
    endTs: String(opts.endTs),
    field,
    onlyValid: opts.onlyValid ? '1' : '0',
  })

  const resp: any = await requestJson({
    url: `${base}/unique_demands/count?${qs}`,
    method: 'GET',
  })

  if (!resp || !resp.ok) {
    throw new Error((resp && resp.error) || 'UNIQUE_DEMANDS_COUNT_FAILED')
  }
  return toNumberOrNull(resp.count) || 0
}

export async function fetchUniqueDemandsListByTimeRange(opts: {
  startTs: number
  endTs: number
  field?: 'message_time_ts' | 'created_time_ts'
  onlyValid?: boolean
  limit?: number
  order?: 'asc' | 'desc'
}): Promise<SapUniqueDemandDoc[]> {
  const field = opts.field || 'created_time_ts'
  const limit = Math.max(1, Math.min(200, opts.limit || 20))
  const order = opts.order || 'desc'

  const base = String(UNIQUE_API_BASE).replace(/\/+$/, '')
  const qs = buildQueryString({
    startTs: String(opts.startTs),
    endTs: String(opts.endTs),
    field,
    order,
    onlyValid: opts.onlyValid ? '1' : '0',
    limit: String(limit),
    offset: '0',
  })

  const resp: any = await requestJson({
    url: `${base}/unique_demands/range?${qs}`,
    method: 'GET',
  })

  if (!resp || !resp.ok || !Array.isArray(resp.demands)) {
    throw new Error((resp && resp.error) || 'UNIQUE_DEMANDS_RANGE_FAILED')
  }

  return resp.demands as SapUniqueDemandDoc[]
}

export async function fetchAllUniqueDemandsByTimeRange(opts: {
  startTs: number
  endTs: number
  field?: 'message_time_ts' | 'created_time_ts' | 'last_updated_time_ts' | 'updated_at_ts'
  onlyValid?: boolean
  order?: 'asc' | 'desc'
  pageSize?: number
  max?: number
}): Promise<SapUniqueDemandDoc[]> {
  const field = opts.field || 'created_time_ts'
  const order = opts.order || 'desc'
  const pageSize = Math.max(1, Math.min(100, opts.pageSize || 100))
  const max = Math.max(1, opts.max || 2000)

  const base = String(UNIQUE_API_BASE).replace(/\/+$/, '')

  const all: SapUniqueDemandDoc[] = []
  let offset = 0
  while (all.length < max) {
    const limit = Math.min(pageSize, max - all.length)
    const qs = buildQueryString({
      startTs: String(opts.startTs),
      endTs: String(opts.endTs),
      field,
      order,
      onlyValid: opts.onlyValid ? '1' : '0',
      limit: String(limit),
      offset: String(offset),
    })

    const resp: any = await requestJson({
      url: `${base}/unique_demands/range?${qs}`,
      method: 'GET',
    })

    const batch = resp && Array.isArray(resp.demands) ? (resp.demands as SapUniqueDemandDoc[]) : []
    if (!batch.length) break
    all.push(...batch)
    if (batch.length < limit) break
    offset += batch.length
  }

  return all.slice(0, max)
}

export async function fetchAllUniqueDemands(opts?: {
  onlyValid?: boolean
  orderBy?: string
  order?: 'asc' | 'desc'
  pageSize?: number
  max?: number
}): Promise<SapUniqueDemandDoc[]> {
  const orderBy = opts?.orderBy || 'local_id'
  const order = opts?.order || 'desc'
  const pageSize = Math.max(1, Math.min(100, opts?.pageSize || 100))
  const max = Math.max(1, opts?.max || 2000)

  const base = String(UNIQUE_API_BASE).replace(/\/+$/, '')

  const all: SapUniqueDemandDoc[] = []
  let offset = 0
  while (all.length < max) {
    const limit = Math.min(pageSize, max - all.length)
    const qs = buildQueryString({
      orderBy,
      order,
      onlyValid: opts?.onlyValid ? '1' : '0',
      limit: String(limit),
      offset: String(offset),
    })

    const resp: any = await requestJson({
      url: `${base}/unique_demands/all?${qs}`,
      method: 'GET',
    })

    const batch = resp && Array.isArray(resp.demands) ? (resp.demands as SapUniqueDemandDoc[]) : []
    if (!batch.length) break
    all.push(...batch)
    if (batch.length < limit) break
    offset += batch.length
  }

  return all.slice(0, max)
}

export async function fetchUniqueDemandById(id: string): Promise<SapUniqueDemandDoc | null> {
  const docId = String(id || '').trim()
  if (!docId) return null

  const base = String(UNIQUE_API_BASE).replace(/\/+$/, '')
  const resp: any = await requestJson({
    url: `${base}/unique_demands/${encodeURIComponent(docId)}`,
    method: 'GET',
  })

  if (!resp) return null
  if (!resp.ok) {
    if (String(resp.error || '').trim() === 'NOT_FOUND') return null
    throw new Error(resp.error || 'UNIQUE_DEMAND_GET_FAILED')
  }
  return (resp.demand || null) as SapUniqueDemandDoc | null
}
