const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')
const tcb = require('@cloudbase/node-sdk')

const app = express()

app.use(express.json({ limit: '1mb' }))
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-uid', 'x-nickname', 'x-ingest-secret'],
    methods: ['GET', 'POST', 'OPTIONS'],
  }),
)

const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: false,
})

function getAuth(req) {
  const uid = String(req.header('x-uid') || '').trim()
  const nicknameRaw = String(req.header('x-nickname') || '').trim()
  const nickname = (() => {
    if (!nicknameRaw) return ''
    try {
      return decodeURIComponent(nicknameRaw)
    } catch {
      return nicknameRaw
    }
  })()
  return { uid, nickname }
}

function normalizePhoneLike(raw) {
  let s = String(raw || '').trim()
  if (!s) return ''
  s = s.replace(/[\s-]/g, '')
  if (s.startsWith('+86')) s = s.slice(3)
  if (s.startsWith('86') && s.length > 11) s = s.slice(2)
  return s
}

function makeIdentifierCandidates(raw) {
  const s = String(raw || '').trim()
  const out = []
  const seen = new Set()
  const push = (v) => {
    const t = String(v || '').trim()
    if (!t) return
    if (seen.has(t)) return
    seen.add(t)
    out.push(t)
  }

  push(s)
  push(s.replace(/[\s-]/g, ''))

  const phone = normalizePhoneLike(s)
  if (phone) {
    push(phone)
    push(`+86${phone}`)
    push(`86${phone}`)
  }

  return out
}

function detectIdentifierType(raw) {
  const s = String(raw || '').trim()
  if (!s) return { type: '', norm: '' }

  const isEmail = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(s)
  if (isEmail) return { type: 'email', norm: s.toLowerCase() }

  const phoneLike = normalizePhoneLike(s)
  const isCnPhone = /^1[3-9]\d{9}$/.test(phoneLike)
  if (isCnPhone) return { type: 'phone', norm: phoneLike }

  const isUsername = /^[a-zA-Z0-9_]{3,20}$/.test(s)
  if (isUsername) return { type: 'username', norm: s.toLowerCase() }

  if (s.length >= 3) return { type: 'username', norm: s.toLowerCase() }
  return { type: '', norm: '' }
}

function pbkdf2Hash(password) {
  const iterations = 120000
  const salt = crypto.randomBytes(16)
  const dk = crypto.pbkdf2Sync(String(password), salt, iterations, 32, 'sha256')
  return `pbkdf2$sha256$${iterations}$${salt.toString('base64')}$${dk.toString('base64')}`
}

function pbkdf2Verify(password, stored) {
  const s = String(stored || '')
  const parts = s.split('$')
  if (parts.length !== 5) return false
  if (parts[0] !== 'pbkdf2') return false
  const alg = parts[1]
  const iter = Number(parts[2] || 0)
  const saltB64 = parts[3] || ''
  const hashB64 = parts[4] || ''
  if (alg !== 'sha256' || !iter || !saltB64 || !hashB64) return false

  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  const got = crypto.pbkdf2Sync(String(password), salt, iter, expected.length, 'sha256')
  try {
    return crypto.timingSafeEqual(expected, got)
  } catch {
    return false
  }
}

async function ensureAccountsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_accounts (
      uid text PRIMARY KEY,
      identifier_type text NOT NULL,
      identifier_norm text NOT NULL UNIQUE,
      phone_norm text,
      email_norm text,
      username_norm text,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `)

  await pool.query(`ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS phone_norm text;`)
  await pool.query(`ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS email_norm text;`)
  await pool.query(`ALTER TABLE app_accounts ADD COLUMN IF NOT EXISTS username_norm text;`)

  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS app_accounts_phone_norm_uq ON app_accounts (phone_norm) WHERE phone_norm IS NOT NULL;`,
  )
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS app_accounts_email_norm_uq ON app_accounts (email_norm) WHERE email_norm IS NOT NULL;`,
  )
  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS app_accounts_username_norm_uq ON app_accounts (username_norm) WHERE username_norm IS NOT NULL;`,
  )

  // Backfill for existing rows created before multi-identifier support
  await pool.query(
    `UPDATE app_accounts
     SET phone_norm = regexp_replace(identifier_norm, '^\\+?86', '')
     WHERE phone_norm IS NULL
       AND identifier_type = 'phone'
       AND identifier_norm ~ '^(\\+?86)?1[3-9]\\d{9}$';`,
  )
  await pool.query(`UPDATE app_accounts SET email_norm = identifier_norm WHERE email_norm IS NULL AND identifier_type = 'email';`)
  await pool.query(`UPDATE app_accounts SET username_norm = identifier_norm WHERE username_norm IS NULL AND identifier_type = 'username';`)
}

async function ensureProfilesColumns() {
  await pool.query(`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS occupation text;`)
}

function normalizeOccupation(raw) {
  const s = String(raw || '').trim()
  if (!s) return ''
  const allowed = new Set(['SAP顾问', '需求发布者', '其他职业'])
  if (!allowed.has(s)) return ''
  return s
}

function hasAnyContactInfo({ wechat_id, qq_id, phone, email }) {
  const w = String(wechat_id || '').trim()
  const q = String(qq_id || '').trim()
  const p = String(phone || '').trim()
  const e = String(email || '').trim()
  return !!(w || q || p || e)
}

async function getAccountByIdentifierCandidates(candidates) {
  const list = Array.isArray(candidates) ? candidates.map((x) => String(x || '').trim()).filter(Boolean) : []
  if (!list.length) return null
  const r = await pool.query(
    'SELECT * FROM app_accounts WHERE identifier_norm = ANY($1::text[]) OR phone_norm = ANY($1::text[]) OR email_norm = ANY($1::text[]) OR username_norm = ANY($1::text[]) LIMIT 1',
    [list],
  )
  return r.rows && r.rows[0] ? r.rows[0] : null
}

async function createAccount({ uid, identifierType, identifierNorm, passwordHash, phoneNorm, emailNorm, usernameNorm }) {
  const r = await pool.query(
    'INSERT INTO app_accounts (uid, identifier_type, identifier_norm, phone_norm, email_norm, username_norm, password_hash) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
    [uid, identifierType, identifierNorm, phoneNorm || null, emailNorm || null, usernameNorm || null, passwordHash],
  )
  return r.rows && r.rows[0] ? r.rows[0] : null
}

async function getAccountByUid(uid) {
  const r = await pool.query('SELECT * FROM app_accounts WHERE uid = $1 LIMIT 1', [uid])
  return r.rows && r.rows[0] ? r.rows[0] : null
}

function maskIdentifier(type, norm) {
  const t = String(type || '').trim()
  const s = String(norm || '').trim()
  if (!s) return ''

  if (t === 'phone') {
    if (s.length >= 11) return `${s.slice(0, 3)}****${s.slice(-4)}`
    if (s.length >= 7) return `${s.slice(0, 3)}****${s.slice(-2)}`
    return s
  }

  if (t === 'email') {
    const parts = s.split('@')
    if (parts.length !== 2) return s
    const name = parts[0] || ''
    const domain = parts[1] || ''
    const maskedName = name.length <= 2 ? `${name.slice(0, 1)}***` : `${name.slice(0, 2)}***`
    return `${maskedName}@${domain}`
  }

  if (s.length <= 2) return `${s.slice(0, 1)}***`
  if (s.length <= 6) return `${s.slice(0, 2)}***`
  return `${s.slice(0, 2)}***${s.slice(-2)}`
}

function mapAccountRow(row) {
  if (!row) return null
  const identifier_type = String(row.identifier_type || '').trim()
  const identifier_norm = String(row.identifier_norm || '').trim()
  const phone_norm_raw = row.phone_norm ? String(row.phone_norm).trim() : ''
  const email_norm_raw = row.email_norm ? String(row.email_norm).trim() : ''
  const username_norm_raw = row.username_norm ? String(row.username_norm).trim() : ''

  const phone_norm = phone_norm_raw || (identifier_type === 'phone' ? identifier_norm : '')
  const email_norm = email_norm_raw || (identifier_type === 'email' ? identifier_norm : '')
  const username_norm = username_norm_raw || (identifier_type === 'username' ? identifier_norm : '')
  return {
    identifier_type,
    identifier_masked: maskIdentifier(identifier_type, identifier_norm),
    phone: phone_norm,
    email: email_norm,
    username: username_norm,
  }
}

function envFlagOn(v) {
  const s = String(v || '').trim().toLowerCase()
  return !!s && s !== '0' && s !== 'false' && s !== 'off' && s !== 'no'
}

function md5Hex(s) {
  return crypto.createHash('md5').update(String(s || ''), 'utf8').digest('hex')
}

function getServiceRole() {
  const r = String(process.env.SERVICE_ROLE || '').trim().toLowerCase()
  if (r === 'sapboss' || r === 'profile') return r
  const p = Number(process.env.PORT)
  if (Number.isFinite(p)) {
    if (p === 3000) return 'sapboss'
    if (p === 3001) return 'profile'
  }
  return 'sapboss'
}

function demandsFeatureEnabled() {
  if (process.env.ENABLE_DEMANDS !== undefined) {
    return envFlagOn(process.env.ENABLE_DEMANDS)
  }
  return getServiceRole() === 'sapboss'
}

function getDefaultSimilarityConfig() {
  return {
    similarity_enabled: process.env.SIMILARITY_ENABLED ? envFlagOn(process.env.SIMILARITY_ENABLED) : true,
    similarity_rule: normalizeRule(process.env.SIMILARITY_RULE || 'hybrid'),
    similarity_threshold: normalizeThreshold(process.env.SIMILARITY_THRESHOLD || 0.86),
  }
}

function getCloudbaseEnvId() {
  return String(process.env.TCB_ENV_ID || process.env.CLOUDBASE_ENV_ID || '').trim()
}

function getCloudbaseSecretId() {
  return String(process.env.CLOUDBASE_SECRET_ID || process.env.TCB_SECRET_ID || '').trim()
}

function getCloudbaseSecretKey() {
  return String(process.env.CLOUDBASE_SECRET_KEY || process.env.TCB_SECRET_KEY || '').trim()
}

let cloudDb = null

function getCloudDbOrThrow() {
  if (cloudDb) return cloudDb

  const envId = getCloudbaseEnvId()
  const secretId = getCloudbaseSecretId()
  const secretKey = getCloudbaseSecretKey()

  if (!envId) throw new Error('CLOUDBASE_ENV_ID_NOT_CONFIGURED')
  if (!secretId || !secretKey) throw new Error('CLOUDBASE_SECRET_NOT_CONFIGURED')

  const cloudApp = tcb.init({
    env: envId,
    secretId,
    secretKey,
  })
  cloudDb = cloudApp.database()
  return cloudDb
}

async function fetchAdminConfigFromCloudbase(db) {
  try {
    const r = await db.collection('sap_admin_config').where({ config_key: 'global' }).limit(1).get()
    const doc = r && r.data && r.data[0]
    if (doc) {
      return {
        similarity_enabled: doc.similarity_enabled !== false,
        similarity_rule: normalizeRule(doc.similarity_rule || 'hybrid'),
        similarity_threshold: normalizeThreshold(doc.similarity_threshold || 0.86),
      }
    }
  } catch {
    // ignore
  }

  return getDefaultSimilarityConfig()
}

async function fetchUniqueCandidatesCloudbase(db, limit) {
  const capped = Math.max(1, Math.min(400, Number(limit || 200)))
  const col = db.collection('sap_unique_demands')
  const attempts = ['last_updated_time_ts', 'updated_at_ts', 'created_time_ts', 'message_time_ts', 'local_id']

  for (const f of attempts) {
    try {
      const r = await col.orderBy(f, 'desc').limit(capped).get()
      return ((r && r.data) || [])
    } catch {
      // try next
    }
  }
  const r = await col.limit(capped).get()
  return ((r && r.data) || [])
}

function pickBestUniqueMatchCloudbase(opts) {
  const { incomingRawText, incomingCategory, candidates, rule, threshold } = opts

  let best = null
  let bestCat = -1
  let bestText = -1

  for (const u of candidates || []) {
    const uText = String((u && u.raw_text) || '').trim()
    const uCat = getCategoryLite(u)
    const catSim = calculateCategorySimilarity(incomingCategory, uCat)
    const textSim = calculateTextSimilarity(incomingRawText, uText)

    let matched = false
    if (rule === 'category') matched = catSim >= threshold
    else if (rule === 'text') matched = textSim >= threshold
    else matched = catSim >= threshold || textSim >= threshold

    if (!matched) continue

    if (catSim > bestCat || (catSim === bestCat && textSim > bestText)) {
      best = u
      bestCat = catSim
      bestText = textSim
    }
  }

  return { best, bestCat, bestText }
}

function toNumberOr(v, fallback) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizeRule(v) {
  const s = String(v || '').trim()
  if (s === 'text' || s === 'category' || s === 'hybrid') return s
  return 'hybrid'
}

function normalizeThreshold(v) {
  const n = toNumberOr(v, 0.86)
  return Math.max(0.5, Math.min(0.99, n))
}

function normalizeTextForSim(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s\p{P}]/gu, '')
    .trim()
}

function lcsLength(a, b) {
  const m = a.length
  const n = b.length
  const dp = new Array(n + 1).fill(0)
  const prev = new Array(n + 1).fill(0)

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      if (a[i - 1] === b[j - 1]) dp[j] = prev[j - 1] + 1
      else dp[j] = Math.max(prev[j], dp[j - 1])
    }
    for (let j = 0; j <= n; j += 1) prev[j] = dp[j]
  }
  return dp[n]
}

function calculateTextSimilarity(a, b) {
  const s1 = normalizeTextForSim(a)
  const s2 = normalizeTextForSim(b)
  if (!s1 || !s2) return 0
  if (s1 === s2) return 1
  if (s1.includes(s2) || s2.includes(s1)) {
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1
    return shorter.length / longer.length
  }
  const l = lcsLength(s1, s2)
  const denom = Math.max(s1.length, s2.length)
  if (!denom) return 0
  return l / denom
}

function parseAttributesJson(v) {
  if (!v) return null
  if (typeof v === 'object') return v
  const s = String(v || '').trim()
  if (!s) return null
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

function normStr(v) {
  return String(v || '').trim()
}

function normCity(v) {
  const s = normStr(v)
  if (!s) return ''
  if (s === '在家') return '远程'
  return s
}

function normModule(m) {
  const s = String(m || '').trim().toUpperCase().replace(/\s+/g, '')
  const t = s.replace(/\\/g, '/').replace(/\|/g, '/').replace(/／/g, '/').replace(/＼/g, '/')
  if (t === 'FI/CO' || t === 'FICO') return 'FICO'
  return t
}

function overlapRatio(a, b) {
  const sa = new Set((Array.isArray(a) ? a : []).map(normModule).filter(Boolean))
  const sb = new Set((Array.isArray(b) ? b : []).map(normModule).filter(Boolean))
  if (!sa.size || !sb.size) return 0
  let inter = 0
  for (const x of sa) if (sb.has(x)) inter += 1
  const denom = Math.min(sa.size, sb.size)
  if (!denom) return 0
  return inter / denom
}

function eqScore(a, b) {
  if (!a || !b) return 0
  return a === b ? 1 : 0
}

function getCategoryLite(doc) {
  const attrs = parseAttributesJson(doc && (doc.attributes_json || doc.attributes)) || {}
  return {
    module_codes: Array.isArray(doc && doc.module_codes) ? doc.module_codes : attrs.module_codes,
    city: normStr(doc && (doc.city || attrs.city)),
    is_remote: doc && Object.prototype.hasOwnProperty.call(doc, 'is_remote') ? doc.is_remote : attrs.is_remote,
    duration_text: normStr(doc && (doc.duration_text || attrs.duration_text)),
    years_text: normStr(doc && (doc.years_text || attrs.years_text)),
    language_tag: normStr(doc && (doc.language_tag || attrs.language_tag)),
    cooperation_mode: normStr(doc && (doc.cooperation_mode || attrs.cooperation_mode)),
    work_mode: normStr(doc && (doc.work_mode || attrs.work_mode)),
    consultant_level: normStr(doc && (doc.consultant_level || attrs.consultant_level)),
    project_cycle: normStr(doc && (doc.project_cycle || attrs.project_cycle)),
    time_requirement: normStr(doc && (doc.time_requirement || attrs.time_requirement)),
  }
}

function calculateCategorySimilarity(a, b) {
  if (!a || !b) return 0

  const aMods = Array.isArray(a.module_codes) ? a.module_codes : []
  const bMods = Array.isArray(b.module_codes) ? b.module_codes : []
  const hasA = aMods.length > 0
  const hasB = bMods.length > 0
  if (hasA !== hasB) return 0
  if (hasA && hasB) {
    const modScore = overlapRatio(aMods, bMods)
    if (modScore <= 0) return 0
  }

  const aCity = normCity(a.city)
  const bCity = normCity(b.city)
  if (aCity && bCity && aCity !== bCity) return 0

  const weights = {
    module: 3,
    city: 2,
    is_remote: 2,
    cooperation_mode: 1,
    work_mode: 1,
    consultant_level: 1,
    project_cycle: 1,
    language_tag: 1,
    time_requirement: 1,
    duration_text: 1,
    years_text: 1,
  }

  const total = Object.values(weights).reduce((s, x) => s + x, 0)
  let score = 0

  score += overlapRatio(aMods, bMods) * weights.module
  score += eqScore(aCity, bCity) * weights.city
  score += eqScore(String(a.is_remote ?? ''), String(b.is_remote ?? '')) * weights.is_remote
  score += eqScore(a.cooperation_mode, b.cooperation_mode) * weights.cooperation_mode
  score += eqScore(a.work_mode, b.work_mode) * weights.work_mode
  score += eqScore(a.consultant_level, b.consultant_level) * weights.consultant_level
  score += eqScore(a.project_cycle, b.project_cycle) * weights.project_cycle
  score += eqScore(a.language_tag, b.language_tag) * weights.language_tag
  score += eqScore(a.time_requirement, b.time_requirement) * weights.time_requirement
  score += eqScore(a.duration_text, b.duration_text) * weights.duration_text
  score += eqScore(a.years_text, b.years_text) * weights.years_text

  return total > 0 ? score / total : 0
}

function requireJwtOnly(req, res) {
  const jwtUser = verifyJwtFromReq(req)
  if (jwtUser && jwtUser.uid) {
    return { uid: jwtUser.uid, nickname: '' }
  }
  res.status(401).json({ ok: false, error: 'JWT_REQUIRED' })
  return null
}

function requireWriteAuth(req, res) {
  if (envFlagOn(process.env.REQUIRE_JWT_WRITE)) {
    return requireJwtOnly(req, res)
  }
  return requireUid(req, res)
}

function getAdminUidSet() {
  const raw = String(process.env.ADMIN_UIDS || '').trim()
  if (!raw) return new Set()
  return new Set(
    raw
      .split(',')
      .map((s) => String(s || '').trim())
      .filter(Boolean),
  )
}

function requireAdminAuth(req, res) {
  const auth = requireWriteAuth(req, res)
  if (!auth) return null
  const set = getAdminUidSet()
  if (set.size === 0) {
    res.status(403).json({ ok: false, error: 'ADMIN_UIDS_NOT_CONFIGURED' })
    return null
  }
  if (!set.has(String(auth.uid || '').trim())) {
    res.status(403).json({ ok: false, error: 'ADMIN_REQUIRED' })
    return null
  }
  return auth
}

function requireIngestAuth(req, res) {
  const ingestSecret = String(process.env.INGEST_SECRET || '').trim()
  const provided = String(req.header('x-ingest-secret') || '').trim()
  if (ingestSecret && provided && ingestSecret === provided) {
    return { uid: '', nickname: '', ingestMode: 'secret' }
  }
  const auth = requireWriteAuth(req, res)
  if (!auth) return null
  return { ...auth, ingestMode: 'user' }
}

function pickDocIdLike(v) {
  const s = String(v || '').trim()
  return s ? s : ''
}

function sanitizeDemandPayload(input, fallbackAuth) {
  const now = new Date()
  const rawText = String((input && (input.raw_text || input.rawText || input.message_text || input.text)) || '').trim()
  const moduleCodesRaw = input && (input.module_codes || input.modules)
  const module_codes = Array.isArray(moduleCodesRaw)
    ? moduleCodesRaw.map((x) => String(x || '').trim()).filter(Boolean)
    : []

  const provider_user_id = String((input && (input.provider_user_id || input.provider_id || input.uid)) || '').trim()
  const provider_name = String((input && (input.provider_name || input.publisher_name || input.nickname)) || '').trim()

  const payload = {
    ...input,
    raw_text: rawText,
    module_codes,
    provider_user_id: provider_user_id || (fallbackAuth && fallbackAuth.uid) || 'local_ingest',
    provider_name: provider_name || (fallbackAuth && fallbackAuth.nickname) || '未知',
    updatedAt: now,
  }

  if (!payload.createdAt) payload.createdAt = now

  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k]
  })

  return payload
}

async function ensureDemandsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_demands (
      id bigserial PRIMARY KEY,
      demand_key text UNIQUE NOT NULL,
      raw_text text NOT NULL,
      module_codes text[] NOT NULL DEFAULT '{}',
      module_labels text[] NOT NULL DEFAULT '{}',
      city text,
      duration_text text,
      years_text text,
      language text,
      daily_rate text,
      is_remote boolean,
      cooperation_mode text,
      work_mode text,
      consultant_level text,
      project_cycle text,
      time_requirement text,
      provider_name text,
      provider_user_id text,
      unique_demand_id text,
      unique_override_by text,
      unique_override_at timestamptz,
      source text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`ALTER TABLE sap_demands ADD COLUMN IF NOT EXISTS unique_demand_id text`)
  await pool.query(`ALTER TABLE sap_demands ADD COLUMN IF NOT EXISTS unique_override_by text`)
  await pool.query(`ALTER TABLE sap_demands ADD COLUMN IF NOT EXISTS unique_override_at timestamptz`)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demands_created_at_idx ON sap_demands(created_at DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demands_provider_user_idx ON sap_demands(provider_user_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demands_unique_demand_idx ON sap_demands(unique_demand_id)`)
}

async function ensureUniqueDemandsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_unique_demands (
      doc_id text PRIMARY KEY,
      local_id bigint,
      raw_text text,
      tags_json text,
      attributes_json text,
      demand_type text,
      richness_score integer,
      created_time timestamptz,
      message_time timestamptz,
      updated_at timestamptz,
      last_updated_time timestamptz,
      created_time_ts bigint,
      message_time_ts bigint,
      updated_at_ts bigint,
      last_updated_time_ts bigint,
      synced_at timestamptz,
      source text,
      canonical_raw_id text,
      canonical_set_by text,
      canonical_set_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at_db timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`CREATE INDEX IF NOT EXISTS sap_unique_demands_created_ts_idx ON sap_unique_demands(created_time_ts DESC)`)
  await pool.query(
    `CREATE INDEX IF NOT EXISTS sap_unique_demands_last_updated_ts_idx ON sap_unique_demands(last_updated_time_ts DESC)`,
  )
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_unique_demands_type_idx ON sap_unique_demands(demand_type)`)
}

function mapUniqueDemandRow(row) {
  if (!row) return null
  return {
    _id: row.doc_id,
    local_id: row.local_id === null || row.local_id === undefined ? undefined : Number(row.local_id),
    raw_text: row.raw_text || '',
    tags_json: row.tags_json || '',
    attributes_json: row.attributes_json || '',
    demand_type: row.demand_type || '',
    richness_score: row.richness_score === null || row.richness_score === undefined ? undefined : Number(row.richness_score),
    created_time: row.created_time,
    message_time: row.message_time,
    updated_at: row.updated_at,
    last_updated_time: row.last_updated_time,
    created_time_ts: row.created_time_ts === null || row.created_time_ts === undefined ? null : Number(row.created_time_ts),
    message_time_ts: row.message_time_ts === null || row.message_time_ts === undefined ? null : Number(row.message_time_ts),
    updated_at_ts: row.updated_at_ts === null || row.updated_at_ts === undefined ? null : Number(row.updated_at_ts),
    last_updated_time_ts:
      row.last_updated_time_ts === null || row.last_updated_time_ts === undefined ? null : Number(row.last_updated_time_ts),
    synced_at: row.synced_at,
    source: row.source || '',
    canonical_raw_id: row.canonical_raw_id || '',
    canonical_set_by: row.canonical_set_by || '',
    canonical_set_at: row.canonical_set_at,
  }
}

function toBigIntOrNull(v) {
  if (v === null || v === undefined) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

async function upsertUniqueDemand(docId, demand) {
  await ensureUniqueDemandsTable()

  const id = pickDocIdLike(docId)
  const d = demand && typeof demand === 'object' ? demand : {}

  const vals = [
    id,
    d.local_id === undefined ? null : toBigIntOrNull(d.local_id),
    d.raw_text ? String(d.raw_text) : null,
    d.tags_json ? String(d.tags_json) : null,
    d.attributes_json ? String(d.attributes_json) : null,
    d.demand_type ? String(d.demand_type) : null,
    d.richness_score === undefined ? null : Number(d.richness_score),
    d.created_time ? new Date(d.created_time) : null,
    d.message_time ? new Date(d.message_time) : null,
    d.updated_at ? new Date(d.updated_at) : null,
    d.last_updated_time ? new Date(d.last_updated_time) : null,
    d.created_time_ts === undefined ? null : toBigIntOrNull(d.created_time_ts),
    d.message_time_ts === undefined ? null : toBigIntOrNull(d.message_time_ts),
    d.updated_at_ts === undefined ? null : toBigIntOrNull(d.updated_at_ts),
    d.last_updated_time_ts === undefined ? null : toBigIntOrNull(d.last_updated_time_ts),
    d.synced_at ? new Date(d.synced_at) : null,
    d.source ? String(d.source) : null,
  ]

  const r = await pool.query(
    `
    INSERT INTO sap_unique_demands (
      doc_id, local_id, raw_text, tags_json, attributes_json,
      demand_type, richness_score,
      created_time, message_time, updated_at, last_updated_time,
      created_time_ts, message_time_ts, updated_at_ts, last_updated_time_ts,
      synced_at, source
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17
    )
    ON CONFLICT (doc_id) DO UPDATE SET
      local_id = EXCLUDED.local_id,
      raw_text = EXCLUDED.raw_text,
      tags_json = EXCLUDED.tags_json,
      attributes_json = EXCLUDED.attributes_json,
      demand_type = EXCLUDED.demand_type,
      richness_score = EXCLUDED.richness_score,
      created_time = EXCLUDED.created_time,
      message_time = EXCLUDED.message_time,
      updated_at = EXCLUDED.updated_at,
      last_updated_time = EXCLUDED.last_updated_time,
      created_time_ts = EXCLUDED.created_time_ts,
      message_time_ts = EXCLUDED.message_time_ts,
      updated_at_ts = EXCLUDED.updated_at_ts,
      last_updated_time_ts = EXCLUDED.last_updated_time_ts,
      synced_at = EXCLUDED.synced_at,
      source = EXCLUDED.source,
      updated_at_db = now()
    RETURNING *
    `,
    vals,
  )

  return r && r.rows && r.rows[0] ? r.rows[0] : null
}

function normalizeDemandKey(rawText) {
  return md5Hex(normalizeTextForSim(rawText))
}

function mapDemandRow(row) {
  if (!row) return null
  return {
    id: String(row.id),
    raw_text: row.raw_text || '',
    module_codes: Array.isArray(row.module_codes) ? row.module_codes : [],
    module_labels: Array.isArray(row.module_labels) ? row.module_labels : [],
    city: row.city || '',
    duration_text: row.duration_text || '',
    years_text: row.years_text || '',
    language: row.language || '',
    daily_rate: row.daily_rate || '',
    is_remote: row.is_remote,
    cooperation_mode: row.cooperation_mode || '',
    work_mode: row.work_mode || '',
    consultant_level: row.consultant_level || '',
    project_cycle: row.project_cycle || '',
    time_requirement: row.time_requirement || '',
    provider_name: row.provider_name || '未知',
    provider_user_id: row.provider_user_id || undefined,
    unique_demand_id: row.unique_demand_id || '',
    unique_override_by: row.unique_override_by || '',
    unique_override_at: row.unique_override_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapDemandDocLike(row) {
  const mapped = mapDemandRow(row)
  if (!mapped) return null
  return { _id: String(mapped.id || ''), ...mapped }
}

async function upsertDemand(payload, source) {
  await ensureDemandsTable()
  const rawText = String(payload && payload.raw_text || '').trim()
  const demandKey = normalizeDemandKey(rawText)
  const moduleCodes = Array.isArray(payload && payload.module_codes) ? payload.module_codes : []
  const moduleLabels = Array.isArray(payload && payload.module_labels) ? payload.module_labels : []

  const providerName = String(payload && payload.provider_name || '').trim()
  const providerUid = String(payload && payload.provider_user_id || '').trim()

  const vals = [
    demandKey,
    rawText,
    moduleCodes,
    moduleLabels,
    payload.city ? String(payload.city) : null,
    payload.duration_text ? String(payload.duration_text) : null,
    payload.years_text ? String(payload.years_text) : null,
    payload.language ? String(payload.language) : null,
    payload.daily_rate ? String(payload.daily_rate) : null,
    typeof payload.is_remote === 'boolean' ? payload.is_remote : null,
    payload.cooperation_mode ? String(payload.cooperation_mode) : null,
    payload.work_mode ? String(payload.work_mode) : null,
    payload.consultant_level ? String(payload.consultant_level) : null,
    payload.project_cycle ? String(payload.project_cycle) : null,
    payload.time_requirement ? String(payload.time_requirement) : null,
    providerName || null,
    providerUid || null,
    source || null,
  ]

  const r = await pool.query(
    `
    INSERT INTO sap_demands (
      demand_key, raw_text, module_codes, module_labels,
      city, duration_text, years_text, language, daily_rate,
      is_remote, cooperation_mode, work_mode, consultant_level, project_cycle, time_requirement,
      provider_name, provider_user_id, source
    )
    VALUES (
      $1, $2, $3::text[], $4::text[],
      $5, $6, $7, $8, $9,
      $10, $11, $12, $13, $14, $15,
      $16, $17, $18
    )
    ON CONFLICT (demand_key) DO UPDATE SET
      raw_text = EXCLUDED.raw_text,
      module_codes = EXCLUDED.module_codes,
      module_labels = EXCLUDED.module_labels,
      city = EXCLUDED.city,
      duration_text = EXCLUDED.duration_text,
      years_text = EXCLUDED.years_text,
      language = EXCLUDED.language,
      daily_rate = EXCLUDED.daily_rate,
      is_remote = EXCLUDED.is_remote,
      cooperation_mode = EXCLUDED.cooperation_mode,
      work_mode = EXCLUDED.work_mode,
      consultant_level = EXCLUDED.consultant_level,
      project_cycle = EXCLUDED.project_cycle,
      time_requirement = EXCLUDED.time_requirement,
      provider_name = EXCLUDED.provider_name,
      provider_user_id = EXCLUDED.provider_user_id,
      source = EXCLUDED.source,
      updated_at = now()
    RETURNING *
    `,
    vals,
  )
  return r && r.rows && r.rows[0] ? r.rows[0] : null
}

async function handleDemandIngestPg(req, res) {
  const auth = requireIngestAuth(req, res)
  if (!auth) return

  const body = (req && req.body) || {}
  const input = body.demand || body.data || body

  const rawDocId = pickDocIdLike(body.raw_id || body.doc_id || input._id || input.id || input.doc_id)
  const payload = sanitizeDemandPayload(input, auth)
  if (!payload.raw_text) {
    res.status(400).json({ ok: false, error: 'RAW_TEXT_REQUIRED' })
    return
  }

  try {
    const source = auth.ingestMode === 'secret' ? 'ingest_secret' : 'web_user'
    const saved = await upsertDemand(payload, source)
    res.json({
      ok: true,
      raw_id: rawDocId || '',
      demand: mapDemandRow(saved),
    })
  } catch (e) {
    console.error('demands_ingest_pg_write_failed', e)
    res.status(500).json({ ok: false, error: 'PG_WRITE_FAILED' })
  }
}

async function handleDemandIngestCloud(req, res) {
  const auth = requireIngestAuth(req, res)
  if (!auth) return

  const body = (req && req.body) || {}
  const input = body.demand || body.data || body
  const rawDocId = pickDocIdLike(body.raw_id || body.doc_id || input._id || input.id || input.doc_id)
  const payload = sanitizeDemandPayload(input, auth)
  if (!payload.raw_text) {
    res.status(400).json({ ok: false, error: 'RAW_TEXT_REQUIRED' })
    return
  }

  let db
  try {
    db = getCloudDbOrThrow()
  } catch (e) {
    res.status(500).json({ ok: false, error: String((e && e.message) || e || 'CLOUDBASE_INIT_FAILED') })
    return
  }

  const now = new Date()
  const nowIso = now.toISOString()
  const nowTs = now.getTime()

  const rawCol = db.collection('sap_demands_raw')
  let savedRawId = ''
  try {
    if (rawDocId) {
      await rawCol.doc(rawDocId).set(payload)
      savedRawId = rawDocId
    } else {
      const r = await rawCol.add(payload)
      savedRawId = String((r && (r.id || r._id)) || '').trim()
    }
  } catch (e) {
    console.error('demands_ingest_raw_write_failed', e)
    res.status(500).json({ ok: false, error: 'RAW_WRITE_FAILED' })
    return
  }

  let cfg
  try {
    cfg = await fetchAdminConfigFromCloudbase(db)
  } catch {
    cfg = getDefaultSimilarityConfig()
  }

  const enabled = cfg && cfg.similarity_enabled !== false
  const rule = normalizeRule(cfg && cfg.similarity_rule)
  const threshold = normalizeThreshold(cfg && cfg.similarity_threshold)

  const incomingCategory = getCategoryLite(payload)
  const candidates = enabled ? await fetchUniqueCandidatesCloudbase(db, 200) : []
  const picked = enabled
    ? pickBestUniqueMatchCloudbase({
        incomingRawText: payload.raw_text,
        incomingCategory,
        candidates,
        rule,
        threshold,
      })
    : { best: null, bestCat: -1, bestText: -1 }

  let uniqueId = String((picked.best && (picked.best._id || picked.best.id)) || '').trim()
  const uniqueCol = db.collection('sap_unique_demands')

  if (!uniqueId) {
    const digest = md5Hex(`${payload.raw_text}__${savedRawId}`)
    uniqueId = `ud_${digest}`
    const uniquePayload = {
      raw_text: payload.raw_text,
      tags_json: payload.tags_json,
      attributes_json: payload.attributes_json,
      publisher_name: payload.provider_name,
      provider_id: payload.provider_user_id,
      demand_type: 'valid',
      canonical_raw_id: savedRawId,
      created_time: nowIso,
      message_time: nowIso,
      updated_at: nowIso,
      last_updated_time: nowIso,
      created_time_ts: nowTs,
      message_time_ts: nowTs,
      updated_at_ts: nowTs,
      last_updated_time_ts: nowTs,
      source: auth.ingestMode === 'secret' ? 'ingest_secret' : 'web_user',
    }
    try {
      await uniqueCol.doc(uniqueId).set(uniquePayload)
    } catch (e) {
      console.error('demands_ingest_unique_create_failed', e)
      res.status(500).json({ ok: false, error: 'UNIQUE_CREATE_FAILED' })
      return
    }
  } else {
    const canonicalExisting = String((picked.best && picked.best.canonical_raw_id) || '').trim()
    const patch = {
      updated_at: nowIso,
      last_updated_time: nowIso,
      updated_at_ts: nowTs,
      last_updated_time_ts: nowTs,
    }
    if (!canonicalExisting && savedRawId) {
      patch.canonical_raw_id = savedRawId
    }
    try {
      await uniqueCol.doc(uniqueId).update(patch)
    } catch {
      // ignore
    }
  }

  try {
    if (savedRawId) {
      await rawCol.doc(savedRawId).update({
        unique_demand_id: uniqueId,
        updatedAt: new Date(),
      })
    }
  } catch {
    // ignore
  }

  res.json({
    ok: true,
    raw_id: savedRawId,
    unique_demand_id: uniqueId,
    similarity: {
      enabled,
      rule,
      threshold,
      category: picked.bestCat,
      text: picked.bestText,
    },
  })
}

async function handleDemandIngest(req, res) {
  if (!demandsFeatureEnabled()) {
    res.status(410).json({ ok: false, error: 'DEMANDS_MOVED_TO_SAPBOSS_API' })
    return
  }
  await handleDemandIngestCloud(req, res)
}

function getBearerToken(req) {
  const h = String(req.header('authorization') || '').trim()
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? String(m[1] || '').trim() : ''
}

function verifyJwtFromReq(req) {
  const secret = String(process.env.JWT_SECRET || '').trim()
  if (!secret) return null
  const token = getBearerToken(req)
  if (!token) return null

  try {
    const payload = jwt.verify(token, secret)
    const uid = payload && (payload.uid || payload.sub)
    if (!uid) return null
    return { uid: String(uid).trim() }
  } catch {
    return null
  }
}

const handleAuthRegister = async (req, res) => {
  const secret = String(process.env.JWT_SECRET || '').trim()
  if (!secret) {
    res.status(500).json({ ok: false, error: 'JWT_SECRET_NOT_CONFIGURED' })
    return
  }

  const identifier = String((req.body && req.body.identifier) || '').trim()
  const password = String((req.body && req.body.password) || '')
  const occupation = normalizeOccupation(req.body && req.body.occupation)
  const wechat_id = String((req.body && req.body.wechat_id) || '').trim()
  const qq_id = String((req.body && req.body.qq_id) || '').trim()
  if (!identifier) {
    res.status(400).json({ ok: false, error: 'IDENTIFIER_REQUIRED' })
    return
  }
  if (!password || password.length < 6) {
    res.status(400).json({ ok: false, error: 'PASSWORD_TOO_SHORT' })
    return
  }
  if (!occupation) {
    res.status(400).json({ ok: false, error: 'OCCUPATION_REQUIRED' })
    return
  }
  if (occupation === '需求发布者' && !(wechat_id || qq_id)) {
    res.status(400).json({ ok: false, error: 'CONTACT_REQUIRED_FOR_PUBLISHER' })
    return
  }

  const { type, norm } = detectIdentifierType(identifier)
  if (!type || !norm) {
    res.status(400).json({ ok: false, error: 'INVALID_IDENTIFIER' })
    return
  }

  try {
    await ensureAccountsTable()
    await ensureProfilesColumns()

    const candidates = makeIdentifierCandidates(identifier)
    const existed = await getAccountByIdentifierCandidates(candidates)
    if (existed) {
      res.status(409).json({ ok: false, error: 'ACCOUNT_EXISTS' })
      return
    }

    const uid = `acc_${crypto.randomBytes(16).toString('hex')}`
    const passwordHash = pbkdf2Hash(password)

    const phoneNorm = type === 'phone' ? norm : null
    const emailNorm = type === 'email' ? norm : null
    const usernameNorm = type === 'username' ? norm : null

    await createAccount({
      uid,
      identifierType: type,
      identifierNorm: norm,
      phoneNorm,
      emailNorm,
      usernameNorm,
      passwordHash,
    })

    const nickname = type === 'phone' ? `用户${norm.slice(-4)}` : type === 'email' ? norm.split('@')[0] : norm
    await getOrCreateProfile(uid, nickname)

    try {
      const sets = []
      const vals = []
      let i = 1
      if (occupation) {
        sets.push(`occupation = $${i}`)
        vals.push(occupation)
        i += 1
      }
      if (wechat_id) {
        sets.push(`wechat_id = $${i}`)
        vals.push(wechat_id)
        i += 1
      }
      if (qq_id) {
        sets.push(`qq_id = $${i}`)
        vals.push(qq_id)
        i += 1
      }
      if (sets.length) {
        vals.push(uid)
        await pool.query(`UPDATE user_profiles SET ${sets.join(', ')} WHERE cloudbase_uid = $${i}`, vals)
      }
    } catch (e) {
      console.error('auth_register_profile_patch_failed', e)
    }

    const token = jwt.sign({ uid }, secret, { expiresIn: '30d' })
    res.json({ ok: true, uid, token })
  } catch (e) {
    console.error('auth_register_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

const handleAuthLogin = async (req, res) => {
  const secret = String(process.env.JWT_SECRET || '').trim()
  if (!secret) {
    res.status(500).json({ ok: false, error: 'JWT_SECRET_NOT_CONFIGURED' })
    return
  }

  const identifier = String((req.body && req.body.identifier) || '').trim()
  const password = String((req.body && req.body.password) || '')
  if (!identifier || !password) {
    res.status(400).json({ ok: false, error: 'MISSING_CREDENTIALS' })
    return
  }

  const { type, norm } = detectIdentifierType(identifier)
  if (!norm) {
    res.status(400).json({ ok: false, error: 'INVALID_IDENTIFIER' })
    return
  }

  try {
    await ensureAccountsTable()

    const candidates = makeIdentifierCandidates(identifier)
    const acct = await getAccountByIdentifierCandidates(candidates)
    if (!acct) {
      res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' })
      return
    }

    const ok = pbkdf2Verify(password, acct.password_hash)
    if (!ok) {
      res.status(401).json({ ok: false, error: 'INVALID_CREDENTIALS' })
      return
    }

    const uid = String(acct.uid || '').trim()
    if (!uid) {
      res.status(500).json({ ok: false, error: 'ACCOUNT_UID_MISSING' })
      return
    }

    // Auto-bind identifier used for login so profile page can autofill phone/email.
    // This is best-effort and should never block login.
    try {
      const t = String(type || '').trim()
      const sets = []
      const vals = []
      let i = 1
      const acctPhoneRaw = acct.phone_norm ? String(acct.phone_norm).trim() : ''
      const acctEmailRaw = acct.email_norm ? String(acct.email_norm).trim() : ''
      const acctUsernameRaw = acct.username_norm ? String(acct.username_norm).trim() : ''

      if (t === 'phone') {
        const acctPhoneNorm = acctPhoneRaw ? normalizePhoneLike(acctPhoneRaw) : ''
        if (!acctPhoneNorm || acctPhoneNorm !== acctPhoneRaw) {
          sets.push(`phone_norm = $${i}`)
          vals.push(norm)
          i += 1
        }
      }

      if (t === 'email' && !acctEmailRaw) {
        sets.push(`email_norm = $${i}`)
        vals.push(norm)
        i += 1
      }

      if (t === 'username' && !acctUsernameRaw) {
        sets.push(`username_norm = $${i}`)
        vals.push(norm)
        i += 1
      }
      if (sets.length) {
        vals.push(uid)
        await pool.query(`UPDATE app_accounts SET ${sets.join(', ')} WHERE uid = $${i}`, vals)
      }
    } catch (e) {
      console.error('auth_login_bind_identifier_failed', e)
    }

    await getOrCreateProfile(uid, '')
    const token = jwt.sign({ uid }, secret, { expiresIn: '30d' })
    res.json({ ok: true, uid, token })
  } catch (e) {
    console.error('auth_login_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

function requireUid(req, res) {
  const jwtUser = verifyJwtFromReq(req)
  if (jwtUser && jwtUser.uid) {
    return { uid: jwtUser.uid, nickname: '' }
  }

  const { uid, nickname } = getAuth(req)
  if (!uid) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    return null
  }
  return { uid, nickname }
}

const handleGetAuthToken = async (req, res) => {
  res.status(410).json({ ok: false, error: 'CLOUDBASE_EXCHANGE_DISABLED' })
}

function mapProfileRow(row) {
  if (!row) return null
  return {
    _id: row.cloudbase_uid,
    uid: row.cloudbase_uid,
    nickname: row.nickname || '',
    expertise_modules: row.expertise_modules || '',
    years_of_exp: row.years_of_exp === null || row.years_of_exp === undefined ? undefined : row.years_of_exp,
    avatar_url: row.avatar_url || '',
    wechat_id: row.wechat_id || '',
    qq_id: row.qq_id || '',
    occupation: row.occupation || '',
    can_share_contact: !!row.can_share_contact,
    points: Number(row.points || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    profile_completed_at: row.profile_completed_at,
  }
}

async function getProfileByUid(uid) {
  const r = await pool.query('SELECT * FROM user_profiles WHERE cloudbase_uid = $1 LIMIT 1', [uid])
  return r.rows && r.rows[0] ? r.rows[0] : null
}

async function getOrCreateProfile(uid, nickname) {
  const existed = await getProfileByUid(uid)
  if (existed) return existed

  const registerBonus = process.env.REGISTER_BONUS_POINTS ? Number(process.env.REGISTER_BONUS_POINTS) : 10
  const points = Number.isFinite(registerBonus) && registerBonus > 0 ? Math.floor(registerBonus) : 0

  const created = await pool.query(
    'INSERT INTO user_profiles (cloudbase_uid, nickname, points) VALUES ($1, $2, $3) ON CONFLICT (cloudbase_uid) DO UPDATE SET nickname = COALESCE(user_profiles.nickname, EXCLUDED.nickname) RETURNING *',
    [uid, nickname || '', points],
  )
  return created.rows[0]
}

function normalizeProfileLookupIds(ids) {
  const raw = Array.isArray(ids) ? ids : []
  const out = []
  const seen = new Set()

  for (const it of raw) {
    const s = String(it || '').trim()
    if (!s) continue
    if (!seen.has(s)) {
      out.push(s)
      seen.add(s)
    }
    if (!s.startsWith('prov_')) {
      const p = `prov_${s}`
      if (!seen.has(p)) {
        out.push(p)
        seen.add(p)
      }
    }
  }

  return out
}

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1 AS ok')
    res.json({ ok: true, db: true, ts: Date.now() })
  } catch (e) {
    console.error('health_check_failed', e)
    res.status(500).json({ ok: false, db: false, error: 'DB_UNAVAILABLE' })
  }
})

app.get('/unique_demands/:id', async (req, res, next) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  try {
    await ensureUniqueDemandsTable()
    const id = String((req.params && req.params.id) || '').trim()
    if (id === 'count' || id === 'range' || id === 'all') {
      next()
      return
    }
    if (!id) {
      res.status(400).json({ ok: false, error: 'ID_REQUIRED' })
      return
    }
    const r = await pool.query('SELECT * FROM sap_unique_demands WHERE doc_id = $1 LIMIT 1', [id])
    const row = r.rows && r.rows[0]
    if (!row) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' })
      return
    }
    res.json({ ok: true, demand: mapUniqueDemandRow(row) })
  } catch (e) {
    console.error('unique_demand_get_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/unique_demands/count', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  try {
    await ensureUniqueDemandsTable()
    const startTs = Number(req.query && req.query.startTs)
    const endTs = Number(req.query && req.query.endTs)
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      res.status(400).json({ ok: false, error: 'RANGE_REQUIRED' })
      return
    }

    const fieldRaw = String((req.query && req.query.field) || 'created_time_ts').trim()
    const allowed = new Set(['message_time_ts', 'created_time_ts', 'last_updated_time_ts', 'updated_at_ts'])
    const field = allowed.has(fieldRaw) ? fieldRaw : 'created_time_ts'

    const onlyValid = envFlagOn((req.query && req.query.onlyValid) || '')

    let sql = `SELECT COUNT(*)::bigint AS cnt FROM sap_unique_demands WHERE ${field} >= $1 AND ${field} < $2`
    const vals = [Math.trunc(startTs), Math.trunc(endTs)]
    if (onlyValid) sql += " AND demand_type = 'valid'"

    const r = await pool.query(sql, vals)
    const cnt = r && r.rows && r.rows[0] ? Number(r.rows[0].cnt || 0) : 0
    res.json({ ok: true, count: cnt })
  } catch (e) {
    console.error('unique_demand_count_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/unique_demands/range', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  try {
    await ensureUniqueDemandsTable()
    const startTs = Number(req.query && req.query.startTs)
    const endTs = Number(req.query && req.query.endTs)
    if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
      res.status(400).json({ ok: false, error: 'RANGE_REQUIRED' })
      return
    }

    const fieldRaw = String((req.query && req.query.field) || 'created_time_ts').trim()
    const allowed = new Set(['message_time_ts', 'created_time_ts', 'last_updated_time_ts', 'updated_at_ts'])
    const field = allowed.has(fieldRaw) ? fieldRaw : 'created_time_ts'

    const orderRaw = String((req.query && req.query.order) || 'desc').trim().toLowerCase()
    const order = orderRaw === 'asc' ? 'ASC' : 'DESC'
    const limit = Math.max(1, Math.min(500, Number((req.query && req.query.limit) || 100)))
    const offset = Math.max(0, Number((req.query && req.query.offset) || 0))
    const onlyValid = envFlagOn((req.query && req.query.onlyValid) || '')

    let sql = `SELECT * FROM sap_unique_demands WHERE ${field} >= $1 AND ${field} < $2`
    const vals = [Math.trunc(startTs), Math.trunc(endTs)]
    let idx = 3
    if (onlyValid) sql += " AND demand_type = 'valid'"
    sql += ` ORDER BY ${field} ${order}, doc_id ${order}`
    sql += ` OFFSET $${idx} LIMIT $${idx + 1}`
    vals.push(offset, limit)

    const r = await pool.query(sql, vals)
    res.json({ ok: true, demands: (r.rows || []).map(mapUniqueDemandRow) })
  } catch (e) {
    console.error('unique_demand_range_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/unique_demands/all', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  try {
    await ensureUniqueDemandsTable()
    const orderRaw = String((req.query && req.query.order) || 'desc').trim().toLowerCase()
    const order = orderRaw === 'asc' ? 'ASC' : 'DESC'
    const orderByRaw = String((req.query && req.query.orderBy) || 'local_id').trim()
    const allowed = new Set(['local_id', 'created_time_ts', 'message_time_ts', 'last_updated_time_ts', 'updated_at_ts'])
    const orderBy = allowed.has(orderByRaw) ? orderByRaw : 'local_id'
    const limit = Math.max(1, Math.min(500, Number((req.query && req.query.limit) || 100)))
    const offset = Math.max(0, Number((req.query && req.query.offset) || 0))
    const onlyValid = envFlagOn((req.query && req.query.onlyValid) || '')

    let sql = 'SELECT * FROM sap_unique_demands'
    const vals = []
    let idx = 1
    if (onlyValid) {
      sql += " WHERE demand_type = 'valid'"
    }
    sql += ` ORDER BY ${orderBy} ${order} NULLS LAST, doc_id ${order}`
    sql += ` OFFSET $${idx} LIMIT $${idx + 1}`
    vals.push(offset, limit)

    const r = await pool.query(sql, vals)
    res.json({ ok: true, demands: (r.rows || []).map(mapUniqueDemandRow) })
  } catch (e) {
    console.error('unique_demand_all_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/admin/raw_candidates', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureDemandsTable()
    const uniqueId = String((req.query && req.query.uniqueId) || '').trim()
    if (!uniqueId) {
      res.status(400).json({ ok: false, error: 'UNIQUE_ID_REQUIRED' })
      return
    }

    const kw = String((req.query && req.query.kw) || '').trim()
    const limitLinked = Math.max(1, Math.min(200, Number((req.query && req.query.limitLinked) || 80)))
    const limitRecent = Math.max(1, Math.min(500, Number((req.query && req.query.limitRecent) || 260)))

    const linkedRes = await pool.query('SELECT * FROM sap_demands WHERE unique_demand_id = $1 ORDER BY created_at DESC LIMIT $2', [
      uniqueId,
      limitLinked,
    ])
    const linkedList = (linkedRes && linkedRes.rows) || []

    const recentRes = await pool.query('SELECT * FROM sap_demands ORDER BY created_at DESC LIMIT $1', [limitRecent])
    const recentList = (recentRes && recentRes.rows) || []

    let exactById = []
    if (kw && /^\d{1,18}$/.test(kw)) {
      const idNum = Number(kw)
      if (Number.isFinite(idNum) && idNum > 0) {
        const r = await pool.query('SELECT * FROM sap_demands WHERE id = $1 LIMIT 1', [idNum])
        exactById = (r && r.rows) || []
      }
    }

    const mergedById = new Map()
    for (const x of [...linkedList, ...exactById, ...recentList]) {
      const id = x && x.id !== undefined && x.id !== null ? String(x.id) : ''
      if (!id) continue
      if (!mergedById.has(id)) mergedById.set(id, x)
    }

    const list = Array.from(mergedById.values()).map(mapDemandDocLike)
    res.json({ ok: true, demands: list.filter(Boolean) })
  } catch (e) {
    console.error('admin_raw_candidates_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/admin/link_raw', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureDemandsTable()
    const body = (req && req.body) || {}
    const rawId = String(body.rawId || body.raw_id || body.id || '').trim()
    const uniqueId = String(body.uniqueId || body.unique_id || '').trim()
    const idNum = Number(rawId)

    if (!rawId || !Number.isFinite(idNum) || idNum <= 0) {
      res.status(400).json({ ok: false, error: 'RAW_ID_REQUIRED' })
      return
    }
    if (!uniqueId) {
      res.status(400).json({ ok: false, error: 'UNIQUE_ID_REQUIRED' })
      return
    }

    const r = await pool.query(
      'UPDATE sap_demands SET unique_demand_id = $1, unique_override_by = $2, unique_override_at = now(), updated_at = now() WHERE id = $3 RETURNING *',
      [uniqueId, String(admin.uid || ''), idNum],
    )

    const row = r && r.rows && r.rows[0]
    res.json({ ok: true, demand: mapDemandDocLike(row) })
  } catch (e) {
    console.error('admin_link_raw_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/admin/unlink_raw', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureDemandsTable()
    const body = (req && req.body) || {}
    const rawId = String(body.rawId || body.raw_id || body.id || '').trim()
    const idNum = Number(rawId)

    if (!rawId || !Number.isFinite(idNum) || idNum <= 0) {
      res.status(400).json({ ok: false, error: 'RAW_ID_REQUIRED' })
      return
    }

    const r = await pool.query(
      "UPDATE sap_demands SET unique_demand_id = '', unique_override_by = $1, unique_override_at = now(), updated_at = now() WHERE id = $2 RETURNING *",
      [String(admin.uid || ''), idNum],
    )
    const row = r && r.rows && r.rows[0]
    res.json({ ok: true, demand: mapDemandDocLike(row) })
  } catch (e) {
    console.error('admin_unlink_raw_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/admin/set_canonical_raw', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureUniqueDemandsTable()
    const body = (req && req.body) || {}
    const uniqueId = String(body.uniqueId || body.unique_id || body.id || '').trim()
    const rawId = String(body.rawId || body.raw_id || '').trim()

    if (!uniqueId) {
      res.status(400).json({ ok: false, error: 'UNIQUE_ID_REQUIRED' })
      return
    }
    if (!rawId) {
      res.status(400).json({ ok: false, error: 'RAW_ID_REQUIRED' })
      return
    }

    const r = await pool.query(
      'UPDATE sap_unique_demands SET canonical_raw_id = $1, canonical_set_by = $2, canonical_set_at = now(), updated_at_db = now() WHERE doc_id = $3 RETURNING *',
      [rawId, String(admin.uid || ''), uniqueId],
    )
    const row = r && r.rows && r.rows[0]
    if (!row) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' })
      return
    }
    res.json({ ok: true, demand: mapUniqueDemandRow(row) })
  } catch (e) {
    console.error('admin_set_canonical_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

const handleGetOrCreateProfile = async (req, res) => {
  const auth = requireWriteAuth(req, res)
  if (!auth) return

  try {
    await ensureAccountsTable()
    await ensureProfilesColumns()
    const row = await getOrCreateProfile(auth.uid, auth.nickname)
    const acct = await getAccountByUid(auth.uid)
    res.json({ ok: true, profile: mapProfileRow(row), account: mapAccountRow(acct) })
  } catch (e) {
    console.error('profile_get_or_create_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

const handleGetProfiles = async (req, res) => {
  const auth = requireUid(req, res)
  if (!auth) return

  const ids = normalizeProfileLookupIds(req.body && req.body.ids)
  if (!ids.length) {
    res.json({ ok: true, profiles: [] })
    return
  }

  const limited = ids.slice(0, 500)

  try {
    const r = await pool.query('SELECT * FROM user_profiles WHERE cloudbase_uid = ANY($1::text[])', [limited])
    const rows = (r && r.rows) || []
    res.json({ ok: true, profiles: rows.map(mapProfileRow) })
  } catch (e) {
    console.error('profiles_get_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

const handleGetProfile = async (req, res) => {
  const auth = requireUid(req, res)
  if (!auth) return

  try {
    await ensureAccountsTable()
    await ensureProfilesColumns()
    const row = await getProfileByUid(auth.uid)
    const acct = await getAccountByUid(auth.uid)
    res.json({ ok: true, profile: mapProfileRow(row), account: mapAccountRow(acct) })
  } catch (e) {
    console.error('profile_get_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

const handleUpdateProfile = async (req, res) => {
  const auth = requireWriteAuth(req, res)
  if (!auth) return

  const patch = (req.body && req.body.patch) || {}
  const accountPatch = (req.body && req.body.account) || {}
  const addPointsRaw = req.body && typeof req.body.addPoints !== 'undefined' ? req.body.addPoints : 0
  const addPoints = Number(addPointsRaw || 0)

  const allowed = {
    nickname: typeof patch.nickname === 'string' ? patch.nickname : undefined,
    expertise_modules: typeof patch.expertise_modules === 'string' ? patch.expertise_modules : undefined,
    years_of_exp: typeof patch.years_of_exp === 'number' ? patch.years_of_exp : undefined,
    avatar_url: typeof patch.avatar_url === 'string' ? patch.avatar_url : undefined,
    wechat_id: typeof patch.wechat_id === 'string' ? patch.wechat_id : undefined,
    qq_id: typeof patch.qq_id === 'string' ? patch.qq_id : undefined,
    occupation: typeof patch.occupation === 'string' ? patch.occupation : undefined,
    can_share_contact: typeof patch.can_share_contact === 'boolean' ? patch.can_share_contact : undefined,
  }

  const fields = []
  const values = []
  let i = 1

  for (const [k, v] of Object.entries(allowed)) {
    if (typeof v === 'undefined') continue
    fields.push(`${k} = $${i}`)
    values.push(v)
    i += 1
  }

  try {
    await pool.query('BEGIN')

    await ensureProfilesColumns()

    const current = await getOrCreateProfile(auth.uid, auth.nickname)

    const occupationNext = typeof allowed.occupation !== 'undefined' ? normalizeOccupation(allowed.occupation) : String(current.occupation || '').trim()
    if (typeof allowed.occupation !== 'undefined' && !occupationNext) {
      await pool.query('ROLLBACK')
      res.status(400).json({ ok: false, error: 'INVALID_OCCUPATION' })
      return
    }

    const nextPhone = typeof accountPatch.phone === 'string' ? String(accountPatch.phone || '').trim() : undefined
    const nextEmail = typeof accountPatch.email === 'string' ? String(accountPatch.email || '').trim() : undefined

    if (typeof nextPhone !== 'undefined' || typeof nextEmail !== 'undefined') {
      await ensureAccountsTable()

      const phoneNorm = typeof nextPhone !== 'undefined' ? (detectIdentifierType(nextPhone).type === 'phone' ? detectIdentifierType(nextPhone).norm : '') : undefined
      const emailNorm = typeof nextEmail !== 'undefined' ? (detectIdentifierType(nextEmail).type === 'email' ? detectIdentifierType(nextEmail).norm : '') : undefined

      if (typeof nextPhone !== 'undefined' && nextPhone && !phoneNorm) {
        await pool.query('ROLLBACK')
        res.status(400).json({ ok: false, error: 'INVALID_PHONE' })
        return
      }
      if (typeof nextEmail !== 'undefined' && nextEmail && !emailNorm) {
        await pool.query('ROLLBACK')
        res.status(400).json({ ok: false, error: 'INVALID_EMAIL' })
        return
      }

      const acctCurrent = await getAccountByUid(auth.uid)
      if (!acctCurrent) {
        await pool.query('ROLLBACK')
        res.status(400).json({ ok: false, error: 'ACCOUNT_NOT_FOUND' })
        return
      }

      if (typeof nextPhone !== 'undefined' && phoneNorm) {
        const r = await pool.query('SELECT uid FROM app_accounts WHERE phone_norm = $1 AND uid <> $2 LIMIT 1', [
          phoneNorm,
          auth.uid,
        ])
        if (r.rows && r.rows[0]) {
          await pool.query('ROLLBACK')
          res.status(409).json({ ok: false, error: 'PHONE_IN_USE' })
          return
        }
      }

      if (typeof nextEmail !== 'undefined' && emailNorm) {
        const r = await pool.query('SELECT uid FROM app_accounts WHERE email_norm = $1 AND uid <> $2 LIMIT 1', [
          emailNorm,
          auth.uid,
        ])
        if (r.rows && r.rows[0]) {
          await pool.query('ROLLBACK')
          res.status(409).json({ ok: false, error: 'EMAIL_IN_USE' })
          return
        }
      }

      const acctSets = []
      const acctVals = []
      let j = 1

      if (typeof nextPhone !== 'undefined') {
        acctSets.push(`phone_norm = $${j}`)
        acctVals.push(phoneNorm ? phoneNorm : null)
        j += 1
      }
      if (typeof nextEmail !== 'undefined') {
        acctSets.push(`email_norm = $${j}`)
        acctVals.push(emailNorm ? emailNorm : null)
        j += 1
      }

      if (acctSets.length) {
        acctVals.push(auth.uid)
        await pool.query(`UPDATE app_accounts SET ${acctSets.join(', ')} WHERE uid = $${j}`, acctVals)
      }
    }

    const wechatNext = typeof allowed.wechat_id !== 'undefined' ? String(allowed.wechat_id || '').trim() : String(current.wechat_id || '').trim()
    const qqNext = typeof allowed.qq_id !== 'undefined' ? String(allowed.qq_id || '').trim() : String(current.qq_id || '').trim()
    if (occupationNext === '需求发布者' && !(wechatNext || qqNext)) {
      await pool.query('ROLLBACK')
      res.status(400).json({ ok: false, error: 'CONTACT_REQUIRED_FOR_PUBLISHER' })
      return
    }

    const currentPoints = Number(current.points || 0)
    const delta = Number.isFinite(addPoints) ? Math.trunc(addPoints) : 0
    const nextPoints = Math.max(0, currentPoints + delta)

    const nicknameNext = typeof allowed.nickname !== 'undefined' ? allowed.nickname : current.nickname
    const expNext = typeof allowed.expertise_modules !== 'undefined' ? allowed.expertise_modules : current.expertise_modules
    const yearsNext = typeof allowed.years_of_exp !== 'undefined' ? allowed.years_of_exp : current.years_of_exp

    const willBeComplete = !!(nicknameNext && String(nicknameNext).trim()) && !!(expNext && String(expNext).trim()) && typeof yearsNext === 'number'
    const isFirstTimeComplete = !current.profile_completed_at

    if (willBeComplete && isFirstTimeComplete) {
      fields.push(`profile_completed_at = COALESCE(profile_completed_at, now())`)
    }

    fields.push(`points = $${i}`)
    values.push(nextPoints)
    i += 1

    const sql = `UPDATE user_profiles SET ${fields.join(', ')} WHERE cloudbase_uid = $${i} RETURNING *`
    values.push(auth.uid)

    const updated = await pool.query(sql, values)

    await pool.query('COMMIT')

    const acct = await getAccountByUid(auth.uid)
    res.json({ ok: true, profile: mapProfileRow(updated.rows[0]), account: mapAccountRow(acct) })
  } catch (e) {
    try {
      await pool.query('ROLLBACK')
    } catch (rollbackErr) {
      console.error('profile_update_rollback_failed', rollbackErr)
    }

    const code = e && e.code ? String(e.code) : ''
    const constraint = e && e.constraint ? String(e.constraint) : ''
    if (code === '23505') {
      if (constraint.includes('app_accounts_phone_norm_uq')) {
        res.status(409).json({ ok: false, error: 'PHONE_IN_USE' })
        return
      }
      if (constraint.includes('app_accounts_email_norm_uq')) {
        res.status(409).json({ ok: false, error: 'EMAIL_IN_USE' })
        return
      }
      if (constraint.includes('app_accounts_username_norm_uq')) {
        res.status(409).json({ ok: false, error: 'USERNAME_IN_USE' })
        return
      }
      res.status(409).json({ ok: false, error: 'ACCOUNT_CONFLICT' })
      return
    }

    console.error('profile_update_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

const handleGetPoints = async (req, res) => {
  const auth = requireWriteAuth(req, res)
  if (!auth) return

  try {
    const row = await getOrCreateProfile(auth.uid, auth.nickname)
    res.json({ ok: true, points: Number(row.points || 0) })
  } catch (e) {
    console.error('points_get_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

async function handleDemandIngestPg(req, res) {
  const auth = requireIngestAuth(req, res)
  if (!auth) return

  try {
    const body = (req && req.body) || {}
    const docId = pickDocIdLike(body.doc_id || body.docId)
    const demandObj = body && body.demand && typeof body.demand === 'object' ? body.demand : body

    if (docId && String(docId).startsWith('raw_ud_')) {
      const row = await upsertUniqueDemand(docId, demandObj)
      res.json({ ok: true, unique: mapUniqueDemandRow(row) })
      return
    }

    const payload = sanitizeDemandPayload(demandObj || {}, auth)
    const row = await upsertDemand(payload, payload.source || 'ingest')
    res.json({ ok: true, demand: mapDemandRow(row) })
  } catch (e) {
    console.error('demand_ingest_pg_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

function demandsGone(res) {
  res.status(410).json({ ok: false, error: 'DEMANDS_MOVED_TO_SAPBOSS_API' })
}

app.get('/config/similarity', (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  res.json({ ok: true, config: getDefaultSimilarityConfig() })
})

app.get('/demands', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  try {
    await ensureDemandsTable()
    const limitRaw = req.query && req.query.limit
    const limit = Math.max(1, Math.min(500, Number(limitRaw || 200)))
    const r = await pool.query('SELECT * FROM sap_demands ORDER BY created_at DESC LIMIT $1', [limit])
    res.json({ ok: true, demands: (r.rows || []).map(mapDemandRow) })
  } catch (e) {
    console.error('demands_list_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/demands/:id(\\d+)', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  try {
    await ensureDemandsTable()
    const id = String(req.params && req.params.id || '').trim()
    const idNum = Number(id)
    if (!id || !Number.isFinite(idNum) || idNum <= 0) {
      res.status(400).json({ ok: false, error: 'ID_REQUIRED' })
      return
    }
    const r = await pool.query('SELECT * FROM sap_demands WHERE id = $1 LIMIT 1', [idNum])
    const row = r.rows && r.rows[0]
    if (!row) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' })
      return
    }
    res.json({ ok: true, demand: mapDemandRow(row) })
  } catch (e) {
    console.error('demand_get_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/demands/mine_raw', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const auth = requireWriteAuth(req, res)
  if (!auth) return

  let db = null
  try {
    db = getCloudDbOrThrow()
  } catch {
    db = null
  }

  if (!db) {
    res.status(500).json({ ok: false, error: 'CLOUDBASE_NOT_CONFIGURED' })
    return
  }

  try {
    const limitRaw = req.query && req.query.limit
    const limit = Math.max(1, Math.min(200, Number(limitRaw || 50)))
    const col = db.collection('sap_demands_raw').where({ provider_user_id: String(auth.uid || '').trim() })

    let r
    try {
      r = await col.orderBy('createdAt', 'desc').limit(limit).get()
    } catch {
      try {
        r = await col.orderBy('updatedAt', 'desc').limit(limit).get()
      } catch {
        r = await col.limit(limit).get()
      }
    }

    const docs = ((r && r.data) || []).map((doc) => {
      const _id = String((doc && (doc._id || doc.id)) || '').trim()
      return { id: _id, ...doc }
    })

    res.json({ ok: true, demands: docs })
  } catch (e) {
    console.error('demands_mine_raw_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demands/create', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const auth = requireWriteAuth(req, res)
  if (!auth) return

  try {
    const body = (req && req.body) || {}
    const rawText = String(body.raw_text || '').trim()
    if (!rawText || rawText.length < 5) {
      res.status(400).json({ ok: false, error: 'RAW_TEXT_REQUIRED' })
      return
    }

    const payload = {
      raw_text: rawText,
      module_codes: Array.isArray(body.module_codes) ? body.module_codes : [],
      module_labels: Array.isArray(body.module_labels) ? body.module_labels : [],
      city: body.city || '',
      duration_text: body.duration_text || '',
      years_text: body.years_text || '',
      language: body.language || '',
      daily_rate: body.daily_rate || '',
      is_remote: typeof body.is_remote === 'boolean' ? body.is_remote : undefined,
      cooperation_mode: body.cooperation_mode || '',
      work_mode: body.work_mode || '',
      consultant_level: body.consultant_level || '',
      project_cycle: body.project_cycle || '',
      time_requirement: body.time_requirement || '',
      provider_name: String(body.provider_name || auth.nickname || '').trim(),
      provider_user_id: auth.uid,
    }

    const saved = await upsertDemand(payload, 'user')
    res.json({ ok: true, demand: mapDemandRow(saved) })
  } catch (e) {
    console.error('demand_create_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demands/check_similar', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  try {
    let db = null
    try {
      db = getCloudDbOrThrow()
    } catch {
      db = null
    }

    if (!db) {
      res.json({ ok: true, hasSimilar: false, similarDemands: [] })
      return
    }

    const cfg = await fetchAdminConfigFromCloudbase(db)

    const body = (req && req.body) || {}
    const rawText = String(body.rawText || body.raw_text || '').trim()
    if (!rawText) {
      res.status(400).json({ ok: false, error: 'RAW_TEXT_REQUIRED' })
      return
    }

    const days = typeof body.days === 'number' ? body.days : 7
    const limit = typeof body.limit === 'number' ? body.limit : 100
    const threshold = typeof body.threshold === 'number' ? body.threshold : Number(cfg.similarity_threshold)
    const rule = body.rule ? normalizeRule(body.rule) : normalizeRule(cfg.similarity_rule)
    const currentUserId = String(body.currentUserId || '').trim()

    const parsed = body.parsed || {}
    const incomingCat = getCategoryLite({
      raw_text: rawText,
      module_codes: Array.isArray(parsed.module_codes) ? parsed.module_codes : [],
      city: String(parsed.city || ''),
      is_remote: typeof parsed.is_remote === 'boolean' ? parsed.is_remote : undefined,
      duration_text: String(parsed.duration_text || ''),
      years_text: String(parsed.years_text || ''),
      language_tag: String(parsed.language_tag || parsed.language || ''),
      cooperation_mode: String(parsed.cooperation_mode || ''),
      work_mode: String(parsed.work_mode || ''),
      consultant_level: String(parsed.consultant_level || ''),
      project_cycle: String(parsed.project_cycle || ''),
      time_requirement: String(parsed.time_requirement || ''),
    })

    const candidates = await fetchUniqueCandidatesCloudbase(db, Math.max(1, Math.min(200, Number(limit) || 100)))
    const sinceMs = Date.now() - Math.max(1, Math.min(365, days)) * 24 * 60 * 60 * 1000

    const out = []
    for (const d of (candidates || [])) {
      const otherText = String(d && d.raw_text || '')
      if (!otherText) continue

      const ts = Number(d && (d.last_updated_time_ts ?? d.updated_at_ts ?? d.created_time_ts ?? d.message_time_ts))
      if (Number.isFinite(ts) && ts > 0 && ts < sinceMs) continue

      const textSim = calculateTextSimilarity(rawText, otherText)
      const catSim = calculateCategorySimilarity(incomingCat, getCategoryLite(d))

      const hybridSim = Math.max(catSim, textSim * 0.5)
      let sim = textSim
      if (rule === 'category') sim = catSim
      if (rule === 'hybrid') sim = hybridSim

      if (sim >= threshold) {
        const provider_user_id = d && (d.provider_id || d.provider_user_id) ? String(d.provider_id || d.provider_user_id) : ''
        out.push({
          id: String((d && (d._id || d.id)) || ''),
          raw_text: otherText,
          similarity: Math.round(sim * 100) / 100,
          createdAt: (d && (d.created_time || d.message_time || d.updated_at || d.last_updated_time)) || undefined,
          provider_name: String((d && (d.publisher_name || d.provider_name)) || '未知'),
          provider_user_id: provider_user_id || undefined,
          isSameUser: !!(currentUserId && provider_user_id && provider_user_id === currentUserId),
        })
      }
    }

    out.sort((a, b) => b.similarity - a.similarity)
    res.json({ ok: true, hasSimilar: out.length > 0, similarDemands: out })
  } catch (e) {
    console.error('demand_check_similar_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/get_or_create_profile', handleGetOrCreateProfile)
app.get('/get_profile', handleGetProfile)
app.post('/update_profile', handleUpdateProfile)
app.get('/get_points', handleGetPoints)
app.post('/get_profiles', handleGetProfiles)
app.post('/get_auth_token', handleGetAuthToken)

app.post('/profile/get_or_create', handleGetOrCreateProfile)
app.get('/profile', handleGetProfile)
app.post('/profile/update', handleUpdateProfile)
app.get('/points', handleGetPoints)
app.post('/profile/list', handleGetProfiles)
app.post('/auth/exchange', handleGetAuthToken)
app.post('/auth/register', handleAuthRegister)
app.post('/auth/login', handleAuthLogin)

app.post('/demands/ingest', handleDemandIngest)

const port = process.env.PORT ? Number(process.env.PORT) : 3001
const host = process.env.HOST || '127.0.0.1'

app.listen(port, host, () => {
  console.log(`server_listening ${host}:${port}`)
})
