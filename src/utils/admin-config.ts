import { app, ensureLogin } from './cloudbase'
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
  await ensureLogin()
  const db = app.database()

  try {
    // Prefer singleton config by key, avoid relying on docId or orderBy
    try {
      const byKey: any = await db
        .collection(COLLECTION)
        .where({ [CONFIG_KEY_FIELD]: CONFIG_KEY_VALUE } as any)
        .limit(1)
        .get()
      const doc = byKey && byKey.data && byKey.data[0]
      if (doc) {
        return {
          _id: doc._id,
          similarity_enabled: doc.similarity_enabled !== false,
          similarity_threshold: normalizeThreshold(doc.similarity_threshold),
          similarity_rule: normalizeRule(doc.similarity_rule),
          updated_by: doc.updated_by,
          updatedAt: doc.updatedAt,
          updatedAt_ts: Number(doc.updatedAt_ts) || undefined,
        }
      }
    } catch {
      // ignore
    }

    // Fallback: pick a best-effort latest one among recent docs
    const r: any = await db.collection(COLLECTION).limit(50).get()
    const rows: any[] = (r && r.data) || []
    if (!rows.length) return getDefaultAdminConfig()

    let best: any = null
    let bestTs = -1
    for (const x of rows) {
      const ts = Number(x && (x.updatedAt_ts ?? x.updated_at_ts))
      if (Number.isFinite(ts) && ts > bestTs) {
        best = x
        bestTs = ts
      }
    }
    if (!best) best = rows[0]
    const doc = best
    if (!doc) return getDefaultAdminConfig()

    return {
      _id: doc._id,
      similarity_enabled: doc.similarity_enabled !== false,
      similarity_threshold: normalizeThreshold(doc.similarity_threshold),
      similarity_rule: normalizeRule(doc.similarity_rule),
      updated_by: doc.updated_by,
      updatedAt: doc.updatedAt,
      updatedAt_ts: Number(doc.updatedAt_ts) || undefined,
    }
  } catch {
    return getDefaultAdminConfig()
  }
}

export async function saveAdminConfig(patch: Partial<AdminConfigDoc>): Promise<AdminConfigDoc> {
  const admin = await requireAdmin()
  const db = app.database()

  const current = await fetchAdminConfig()
  const next: AdminConfigDoc = {
    _id: current._id,
    similarity_enabled: patch.similarity_enabled !== undefined ? !!patch.similarity_enabled : current.similarity_enabled,
    similarity_threshold: patch.similarity_threshold !== undefined ? normalizeThreshold(patch.similarity_threshold) : current.similarity_threshold,
    similarity_rule: patch.similarity_rule !== undefined ? normalizeRule(patch.similarity_rule) : current.similarity_rule,
    updated_by: admin.uid,
    updatedAt: new Date(),
    updatedAt_ts: Date.now(),
  }

  // update singleton doc if exists
  try {
    const byKey: any = await db
      .collection(COLLECTION)
      .where({ [CONFIG_KEY_FIELD]: CONFIG_KEY_VALUE } as any)
      .limit(1)
      .get()
    const doc = byKey && byKey.data && byKey.data[0]
    if (doc && doc._id) {
      await db.collection(COLLECTION).doc(String(doc._id)).update({
        [CONFIG_KEY_FIELD]: CONFIG_KEY_VALUE,
        similarity_enabled: next.similarity_enabled,
        similarity_threshold: next.similarity_threshold,
        similarity_rule: next.similarity_rule,
        updated_by: next.updated_by,
        updatedAt: next.updatedAt,
        updatedAt_ts: next.updatedAt_ts,
      })
      next._id = String(doc._id)
      return next
    }
  } catch {
    // ignore
  }

  // create singleton doc
  const r: any = await db.collection(COLLECTION).add({
    [CONFIG_KEY_FIELD]: CONFIG_KEY_VALUE,
    similarity_enabled: next.similarity_enabled,
    similarity_threshold: next.similarity_threshold,
    similarity_rule: next.similarity_rule,
    updated_by: next.updated_by,
    updatedAt: next.updatedAt,
    updatedAt_ts: next.updatedAt_ts,
  })

  const createdId = String(r && ((r as any).id || (r as any)._id) || '').trim()
  if (createdId) next._id = createdId
  return next
}
