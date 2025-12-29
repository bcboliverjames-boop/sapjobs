import { app } from './cloudbase'

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
  const db = app.database()
  const cmd = db.command

  const field = opts.field || 'created_time_ts'

  const where: any = {
    [field]: cmd.gte(opts.startTs).and(cmd.lt(opts.endTs as any)) as any,
  }

  if (opts.onlyValid) where.demand_type = 'valid'

  const r = await db.collection(UNIQUE_DEMANDS_COLLECTION).where(where).count()
  return toNumberOrNull((r as any).total) || 0
}

export async function fetchUniqueDemandsListByTimeRange(opts: {
  startTs: number
  endTs: number
  field?: 'message_time_ts' | 'created_time_ts'
  onlyValid?: boolean
  limit?: number
  order?: 'asc' | 'desc'
}): Promise<SapUniqueDemandDoc[]> {
  const db = app.database()
  const cmd = db.command

  const field = opts.field || 'created_time_ts'
  const limit = Math.max(1, Math.min(200, opts.limit || 20))
  const order = opts.order || 'desc'

  const where: any = {
    [field]: cmd.gte(opts.startTs).and(cmd.lt(opts.endTs as any)) as any,
  }

  if (opts.onlyValid) where.demand_type = 'valid'

  const r = await db
    .collection(UNIQUE_DEMANDS_COLLECTION)
    .where(where)
    .orderBy(field, order)
    .limit(limit)
    .get()

  return ((r as any).data || []) as SapUniqueDemandDoc[]
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
  const db = app.database()
  const cmd = db.command

  const field = opts.field || 'created_time_ts'
  const order = opts.order || 'desc'
  const pageSize = Math.max(1, Math.min(100, opts.pageSize || 100))
  const max = Math.max(1, opts.max || 2000)

  const where: any = {
    [field]: cmd.gte(opts.startTs).and(cmd.lt(opts.endTs as any)) as any,
  }
  if (opts.onlyValid) where.demand_type = 'valid'

  const all: SapUniqueDemandDoc[] = []
  let skip = 0
  while (all.length < max) {
    const r = await db
      .collection(UNIQUE_DEMANDS_COLLECTION)
      .where(where)
      .orderBy(field, order)
      .skip(skip)
      .limit(pageSize)
      .get()

    const batch = ((r as any).data || []) as SapUniqueDemandDoc[]
    if (!batch.length) break

    all.push(...batch)
    if (batch.length < pageSize) break
    skip += batch.length
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
  const db = app.database()

  const orderBy = opts?.orderBy || 'local_id'
  const order = opts?.order || 'desc'
  const pageSize = Math.max(1, Math.min(100, opts?.pageSize || 100))
  const max = Math.max(1, opts?.max || 2000)

  const where: any = {}
  if (opts?.onlyValid) where.demand_type = 'valid'

  const all: SapUniqueDemandDoc[] = []
  let skip = 0
  while (all.length < max) {
    let q: any = db.collection(UNIQUE_DEMANDS_COLLECTION)
    if (Object.keys(where).length) q = q.where(where)

    const r = await q.orderBy(orderBy, order).skip(skip).limit(pageSize).get()
    const batch = ((r as any).data || []) as SapUniqueDemandDoc[]
    if (!batch.length) break
    all.push(...batch)
    if (batch.length < pageSize) break
    skip += batch.length
  }
  return all.slice(0, max)
}

export async function fetchUniqueDemandById(id: string): Promise<SapUniqueDemandDoc | null> {
  const docId = String(id || '').trim()
  if (!docId) return null
  const db = app.database()
  const r = await db.collection(UNIQUE_DEMANDS_COLLECTION).doc(docId).get()
  const doc = (r as any).data && (r as any).data[0]
  return doc ? (doc as SapUniqueDemandDoc) : null
}
