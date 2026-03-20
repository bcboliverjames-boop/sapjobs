const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const fs = require('fs')
const path = require('path')

function loadDotEnvFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) return
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = String(content).split(/\r?\n/)
    for (const rawLine of lines) {
      const line = String(rawLine || '').trim()
      if (!line) continue
      if (line.startsWith('#')) continue
      const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line
      const idx = withoutExport.indexOf('=')
      if (idx <= 0) continue

      const key = withoutExport.slice(0, idx).trim()
      if (!key) continue
      if (Object.prototype.hasOwnProperty.call(process.env, key)) continue

      let val = withoutExport.slice(idx + 1)
      if (val === undefined || val === null) val = ''
      val = String(val)

      if (
        (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
        (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
      ) {
        val = val.slice(1, -1)
      }
      process.env[key] = val
    }
  } catch {
    // ignore
  }
}

function loadLocalEnv() {
  const baseDir = __dirname
  loadDotEnvFile(path.join(baseDir, '.env.local'))
  loadDotEnvFile(path.join(baseDir, '.env'))
}

loadLocalEnv()

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

if (String(process.env.PERF_LOG || '').trim() === '1') {
  const perfAgg = new Map()
  const slowMs = Math.max(0, Number(process.env.PERF_SLOW_MS || 1500))

  function perfKey(req) {
    const method = String(req && req.method || '').toUpperCase()
    const path = String(req && (req.baseUrl || '') || '') + String(req && (req.path || req.url || '') || '')
    return `${method} ${path.split('?')[0]}`
  }

  app.use((req, res, next) => {
    const start = Date.now()
    const key = perfKey(req)
    res.on('finish', () => {
      const dur = Date.now() - start
      const prev = perfAgg.get(key) || { count: 0, total: 0, max: 0, statusCounts: new Map() }
      prev.count += 1
      prev.total += dur
      prev.max = Math.max(prev.max || 0, dur)
      const sc = Number(res.statusCode || 0)
      prev.statusCounts.set(sc, (prev.statusCounts.get(sc) || 0) + 1)
      perfAgg.set(key, prev)
      if (slowMs > 0 && dur >= slowMs) {
        console.warn('perf_slow', { key, status: sc, ms: dur })
      }
    })
    next()
  })

  setInterval(() => {
    try {
      const rows = []
      for (const [key, v] of perfAgg.entries()) {
        const avg = v && v.count ? Math.round(v.total / v.count) : 0
        const scObj = {}
        if (v && v.statusCounts && v.statusCounts.size) {
          for (const [k, n] of v.statusCounts.entries()) scObj[String(k)] = n
        }
        rows.push({ key, count: v.count || 0, avg_ms: avg, max_ms: v.max || 0, status: scObj })
      }
      rows.sort((a, b) => (b.avg_ms - a.avg_ms) || (b.max_ms - a.max_ms) || (b.count - a.count))
      console.log('perf_summary', { top: rows.slice(0, 25) })
      perfAgg.clear()
    } catch (e) {
      console.error('perf_summary_failed', e)
    }
  }, Math.max(5000, Number(process.env.PERF_FLUSH_MS || 30000)))
}

// Serve built frontend (optional)
if (String(process.env.SERVE_FRONTEND || '').trim() === '1') {
  const dist = path.join(__dirname, '..', 'dist', 'build', 'h5')
  app.use(express.static(dist))
}

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

async function ensureAdminConfigTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_admin_config (
      config_key text PRIMARY KEY,
      similarity_enabled boolean,
      similarity_rule text,
      similarity_threshold double precision,
      updated_by text,
      updated_at timestamptz,
      updated_at_ts bigint
    )
  `)
}

async function fetchAdminConfigFromPg() {
  await ensureAdminConfigTable()
  try {
    const r = await pool.query('SELECT * FROM sap_admin_config WHERE config_key = $1 LIMIT 1', ['global'])
    const row = r && r.rows && r.rows[0]
    if (row) {
      return {
        similarity_enabled: row.similarity_enabled !== false,
        similarity_rule: normalizeRule(row.similarity_rule || 'hybrid'),
        similarity_threshold: normalizeThreshold(row.similarity_threshold || 0.86),
      }
    }
  } catch {
    // ignore
  }
  return getDefaultSimilarityConfig()
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

function parseDemandIdNum(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  const s = raw.replace(/^ud_/i, '').trim()
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.trunc(n)
}

async function resolveDemandIdNum(input) {
  const raw = String(input || '').trim()
  if (!raw) return null
  const direct = parseDemandIdNum(raw)
  if (direct) return direct

  if (/^raw_ud_/i.test(raw)) {
    try {
      await ensureDemandsTable()
      const r = await pool.query(
        'SELECT id FROM sap_demands WHERE unique_demand_id = $1 ORDER BY created_at DESC LIMIT 1',
        [raw],
      )
      const row = r && r.rows && r.rows[0]
      const idNum = row && parseDemandIdNum(row.id)
      return idNum || null
    } catch (e) {
      console.error('resolve_demand_id_failed', e)
      return null
    }
  }

  return null
}

async function resolveDemandIdNums(inputs) {
  const rawList = Array.isArray(inputs) ? inputs : []
  const cleaned = rawList
    .map((x) => String(x || '').trim())
    .filter(Boolean)

  const mapping = new Map()
  const directNums = []
  const rawUniqueIds = []

  for (const raw of cleaned) {
    const direct = parseDemandIdNum(raw)
    if (direct) {
      mapping.set(raw, direct)
      directNums.push(direct)
      continue
    }
    if (/^raw_ud_/i.test(raw)) {
      rawUniqueIds.push(raw)
      continue
    }
    mapping.set(raw, null)
  }

  if (rawUniqueIds.length) {
    try {
      await ensureDemandsTable()
      const r = await pool.query(
        `SELECT DISTINCT ON (unique_demand_id) unique_demand_id, id
         FROM sap_demands
         WHERE unique_demand_id = ANY($1::text[])
         ORDER BY unique_demand_id, created_at DESC`,
        [rawUniqueIds],
      )
      for (const row of r.rows || []) {
        const key = String(row.unique_demand_id || '').trim()
        if (!key) continue
        const idNum = parseDemandIdNum(row.id)
        mapping.set(key, idNum || null)
      }
      rawUniqueIds.forEach((k) => {
        if (!mapping.has(k)) mapping.set(k, null)
      })
    } catch (e) {
      console.error('resolve_demand_ids_batch_failed', e)
      rawUniqueIds.forEach((k) => {
        if (!mapping.has(k)) mapping.set(k, null)
      })
    }
  }

  const uniqNums = Array.from(
    new Set(
      Array.from(mapping.values())
        .map((x) => (x ? Number(x) : null))
        .filter((x) => Number.isFinite(x) && x > 0),
    ),
  )
  return { mapping, nums: uniqNums }
}

function normModule(m) {
  const s = String(m || '').trim().toUpperCase().replace(/\s+/g, '')
  const t = s.replace(/\\/g, '/').replace(/\|/g, '/').replace(/／/g, '/').replace(/＼/g, '/')
  if (t === 'FI/CO' || t === 'FICO' || t === 'FI' || t === 'CO') return 'FICO'
  if (t === 'BI') return 'BW'
  if (t === 'XI') return 'PI'
  if (t === 'HR') return 'HCM'
  return t
}

function getSapModuleDefs() {
  return [
    { code: 'FICO', label: 'FI/CO', aliases: ['FI', 'CO', 'FI/CO', 'FICO'] },
    { code: 'MM', label: 'MM', aliases: [] },
    { code: 'SD', label: 'SD', aliases: [] },
    { code: 'PP', label: 'PP', aliases: [] },
    { code: 'QM', label: 'QM', aliases: [] },
    { code: 'PM', label: 'PM', aliases: [] },
    { code: 'PS', label: 'PS', aliases: [] },
    { code: 'HCM', label: 'HCM/HR', aliases: ['HR'] },
    { code: 'EHS', label: 'EHS', aliases: [] },
    { code: 'WM', label: 'WM', aliases: [] },
    { code: 'EWM', label: 'EWM', aliases: [] },
    { code: 'LE', label: 'LE', aliases: [] },
    { code: 'SCM', label: 'SCM', aliases: [] },
    { code: 'APO', label: 'APO', aliases: [] },
    { code: 'CRM', label: 'CRM', aliases: [] },
    { code: 'BW', label: 'BW', aliases: ['BI'] },
    { code: 'ABAP', label: 'ABAP', aliases: [] },
    { code: 'BASIS', label: 'BASIS', aliases: ['NETWEAVER'] },
    { code: 'PI', label: 'PI/XI', aliases: ['XI'] },
    { code: 'SRM', label: 'SRM', aliases: [] },
    { code: 'PLM', label: 'PLM', aliases: [] },
    { code: 'WF', label: 'WF', aliases: [] },
    { code: 'EP', label: 'EP', aliases: [] },
    { code: 'OTHER', label: 'OTHER', aliases: [] },
  ]
}

function normalizeModuleCodes(inputCodes) {
  const defs = getSapModuleDefs()
  const known = new Set(defs.map((d) => d.code))
  const aliasMap = new Map()
  for (const d of defs) {
    aliasMap.set(d.code, d.code)
    for (const a of d.aliases || []) aliasMap.set(normModule(a), d.code)
  }

  const raw = Array.isArray(inputCodes) ? inputCodes : []
  const out = []
  const seen = new Set()
  for (const it of raw) {
    const n = normModule(it)
    if (!n) continue
    const mapped = aliasMap.get(n) || (known.has(n) ? n : 'OTHER')
    if (!seen.has(mapped)) {
      out.push(mapped)
      seen.add(mapped)
    }
  }
  return out
}

function deriveModuleLabelsFromCodes(moduleCodes) {
  const defs = getSapModuleDefs()
  const byCode = new Map(defs.map((d) => [d.code, d.label]))
  const raw = Array.isArray(moduleCodes) ? moduleCodes : []
  const out = []
  for (const c of raw) {
    const code = normModule(c)
    if (!code) continue
    out.push(byCode.get(code) || code)
  }
  return out
}

function normalizeLanguageTag(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  if (/日/.test(s)) return '日语'
  if (/英/.test(s)) return '英语'
  return ''
}

function normalizeConsultantLevel(v) {
  const s = String(v || '').trim()
  if (!s) return ''
  if (/专|资深|专家|principal|staff|lead/i.test(s)) return '专家/资深'
  if (/高|高级|senior/i.test(s)) return '高级'
  if (/中|中级/i.test(s)) return '中级'
  if (/初|初级|junior/i.test(s)) return '初级'
  return s
}

function parseConsultantLevelFromRawText(text) {
  const t = String(text || '')
  if (!t) return ''
  if (/专|资深|专家|principal|staff|lead/i.test(t)) return '专家/资深'
  if (/中高|中高级/.test(t)) return '高级'
  if (/高级|高阶|senior/i.test(t)) return '高级'
  if (/中级|中阶/.test(t)) return '中级'
  if (/初级|初阶|junior/i.test(t)) return '初级'
  if (/\bP\d\b/i.test(t)) {
    // 兜底：部分群里用 P4/P5/P6 表示级别
    const m = t.match(/\bP(\d)\b/i)
    const n = m && m[1] ? Number(m[1]) : null
    if (Number.isFinite(n)) {
      if (n >= 7) return '专家/资深'
      if (n >= 6) return '高级'
      if (n >= 4) return '中级'
      return '初级'
    }
  }
  return ''
}

function parseCooperationModeFromRawText(text) {
  const t = String(text || '')
  if (!t) return ''
  if (/\bFREE\b/i.test(t) || /自由顾问|自由职业|freelance/i.test(t)) return 'FREE'
  if (/乙方\s*入职|乙方入职|乙方编制|乙方岗位|乙方直招|乙方直签|乙方/i.test(t) && /入职|转正|编制|直签/.test(t)) return '乙方入职'
  if (/甲方\s*入职|甲方入职|甲方编制|甲方岗位|甲方直招|甲方直签|甲方/i.test(t) && /入职|转正|编制|直签/.test(t)) return '甲方入职'
  if (/入职|转正|编制|直签|正式工/i.test(t)) return '入职'
  if (/兼职|part\s*-?\s*time|parttime/i.test(t)) return '兼职'
  if (/\bOUTSOURCE\b/i.test(t) || /外包/i.test(t)) return '外包'
  return ''
}

const LOCATION_KEYWORDS = [
  '北京',
  '上海',
  '天津',
  '重庆',
  '广州',
  '深圳',
  '杭州',
  '成都',
  '武汉',
  '西安',
  '南京',
  '郑州',
  '长沙',
  '合肥',
  '福州',
  '石家庄',
  '哈尔滨',
  '昆明',
  '南昌',
  '长春',
  '沈阳',
  '大连',
  '厦门',
  '青岛',
  '济南',
  '苏州',
  '无锡',
  '泰安',
  '嘉兴',
  '宁波',
  '佛山',
  '东莞',
  '全国',
  '远程',
  '海外',
  '欧洲',
  '印尼',
  '菲律宾',
  '新加坡',
  '马来西亚',
  '泰国',
  '越南',
]

function escapeRegExp(s) {
  return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseDemandFromRawText(rawText) {
  const text = String(rawText || '').trim()
  if (!text) {
    return {
      module_codes: [],
      city: '',
      is_remote: null,
      duration_text: '',
      years_text: '',
      language_tag: '',
      daily_rate: '',
      consultant_level: '',
      cooperation_mode: '',
    }
  }

  const module_codes = []
  ;(() => {
    const defs = getSapModuleDefs()
    const out = []
    const seen = new Set()
    for (const d of defs) {
      const keys = [d.code, d.label, ...(d.aliases || [])]
      for (const k of keys) {
        const key = String(k || '').trim()
        if (!key) continue
        const re = new RegExp(`(?:^|[^A-Za-z0-9])${escapeRegExp(key)}(?:$|[^A-Za-z0-9])`, 'i')
        if (re.test(text)) {
          if (!seen.has(d.code)) {
            out.push(d.code)
            seen.add(d.code)
          }
          break
        }
      }
    }

    if (!out.length) {
      const hasSapSignal = /\bsap\b|\bs\/4\b|\bec\b/i.test(text) || /SAP|S\/4|ECC/i.test(text)
      const hasModuleContext = /模块|顾问|岗位|要人|资源|招聘|找人|寻找|寻人|实施|运维|支持|support|consultant/i.test(text)
      if (hasSapSignal && hasModuleContext) out.push('OTHER')
    }

    out.forEach((c) => module_codes.push(c))
  })()

  let city = ''
  for (const k of LOCATION_KEYWORDS) {
    if (k && text.includes(k)) {
      city = k
      break
    }
  }
  city = normCity(city)

  let is_remote = null
  if (/远程|remote|在家|居家|线上/i.test(text)) is_remote = true
  else if (/现场|onsite|on-site|到岗|驻场/i.test(text)) is_remote = false
  else if (city === '远程') is_remote = true

  let duration_text = ''
  const dur = (() => {
    const mRange = text.match(/(\d{1,2})\s*(?:[-—~～到至])\s*(\d{1,2})\s*(?:个)?月/i)
    if (mRange) return `${mRange[1]}-${mRange[2]}个月`
    const mPlus = text.match(/(\d{1,2})\s*\+\s*(\d{1,2})\s*(?:个)?月/i)
    if (mPlus) return `${mPlus[1]}+${mPlus[2]}个月`
    if (/半年/i.test(text)) return '6个月'
    const mMon = text.match(/(\d{1,2})\s*个月/i)
    if (mMon) return `${mMon[1]}个月`
    const mW = text.match(/(\d{1,2})\s*周/i)
    if (mW) return `${mW[1]}周`
    const mD = text.match(/(\d{1,3})\s*天/i)
    if (mD) return `${mD[1]}天`
    if (/长期|永久|持续|长期项目/i.test(text)) return '长期'
    return ''
  })()
  if (dur) duration_text = dur

  let years_text = ''
  const years = (() => {
    const mExp = text.match(/(\d{1,2})\s*年\s*(?:以上|及以上|\+)?\s*(?:经验|工作经验|年经验|exp)/i)
    if (mExp) {
      const y = Number(mExp[1])
      if (Number.isFinite(y) && y > 0) return y >= 8 ? `${y}年以上` : `${y}年`
    }
    const mPlus = text.match(/(\d{1,2})\s*[\+＋]\s*(?:年)?\s*(?:经验|工作经验|exp)/i)
    if (mPlus) return `${mPlus[1]}年以上`
    const mRange = text.match(/(\d+)\s*-\s*(\d+)\s*年/i)
    if (mRange) return `${mRange[1]}-${mRange[2]}年`
    return ''
  })()
  if (years) years_text = years

  const consultant_level = parseConsultantLevelFromRawText(text)
  const cooperation_mode = parseCooperationModeFromRawText(text)

  // 若只出现级别未出现年限，为了展示与分桶可用，把 years_text 兜底成级别
  if (!years_text && consultant_level) years_text = consultant_level

  const language_tag = normalizeLanguageTag((/日语|japanese|jp|日文/i.test(text) ? '日语' : /英语|english|en|英文/i.test(text) ? '英语' : ''))

  let daily_rate = ''
  const rate0 = (() => {
    const mRange = text.match(/\brate\s*(\d{3,5})\s*(?:[-—~～到至])\s*(\d{3,5})\b/i)
    if (mRange) return mRange[1]
    const mOne = text.match(/\brate\s*(\d{3,5})\b/i)
    if (mOne) return mOne[1]
    return ''
  })()
  if (rate0) {
    daily_rate = String(rate0)
  } else {
    const rate1 = text.match(/人天[：:：\s]*(\d+(?:\.\d+)?)\s*(?:k|K|千)?/i)
    if (rate1) {
      let rate = Number(rate1[1])
      if (Number.isFinite(rate)) {
        if (/k|K|千/i.test(rate1[0])) rate *= 1000
        daily_rate = String(Math.round(rate))
      }
    } else {
      const rate2 = text.match(/(\d+(?:\.\d+)?)\s*k\s*[=＝]\s*(\d+)/i)
      if (rate2 && rate2[2]) daily_rate = String(rate2[2])
    }
  }

  return {
    module_codes: normalizeModuleCodes(module_codes),
    city,
    is_remote,
    duration_text: String(duration_text || '').trim(),
    years_text: String(years_text || '').trim(),
    language_tag,
    daily_rate,
    consultant_level,
    cooperation_mode,
  }
}

function normalizeRawDemandForStorage(payload) {
  const p = payload && typeof payload === 'object' ? payload : {}
  const module_codes = normalizeModuleCodes(p.module_codes)
  const module_labels = deriveModuleLabelsFromCodes(module_codes)
  const city = normCity(p.city)
  const is_remote = typeof p.is_remote === 'boolean' ? p.is_remote : city === '远程' ? true : null
  return {
    ...p,
    module_codes,
    module_labels,
    city,
    is_remote,
    language_tag: normalizeLanguageTag(p.language_tag || p.language),
  }
}

function countDemandInfoDims(d) {
  const x = d && typeof d === 'object' ? d : {}
  let n = 0
  const city = String(x.city || '').trim()
  if (city && city !== '远程') n += 1
  if (typeof x.is_remote === 'boolean') n += 1
  if (String(x.duration_text || x.durationText || '').trim()) n += 1
  if (String(x.years_text || x.yearsText || '').trim()) n += 1
  if (String(x.language_tag || x.language || '').trim()) n += 1
  if (String(x.daily_rate || x.dailyRate || '').trim()) n += 1
  if (String(x.consultant_level || x.consultantLevel || '').trim()) n += 1
  if (String(x.cooperation_mode || x.cooperationMode || '').trim()) n += 1
  return n
}

function inferYearsBucket(yearsText, consultantLevel) {
  const s = String(yearsText || '').trim()
  const lvl = normalizeConsultantLevel(consultantLevel)

  const byLevel = (() => {
    if (!lvl) return ''
    if (lvl === '初级') return '0-3'
    if (lvl === '中级') return '4-6'
    if (lvl === '高级') return '7-10'
    if (lvl === '专家/资深') return '10+'
    return ''
  })()

  const bucketByNum = (n) => {
    if (!Number.isFinite(n) || n <= 0) return ''
    if (n <= 3) return '0-3'
    if (n <= 6) return '4-6'
    if (n <= 10) return '7-10'
    return '10+'
  }

  if (s) {
    if (/0\s*经?验/.test(s) || /^0$/.test(s)) return '0-3'
    if (/10\s*(以上|\+)|十\s*(以上|\+)/.test(s)) return '10+'
    const mRange = s.match(/(\d{1,2})\s*[-~到至]\s*(\d{1,2})/)
    if (mRange && mRange[2]) {
      const hi = Number(mRange[2])
      const r = bucketByNum(hi)
      if (r) return r
    }
    const m = s.match(/(\d{1,2})/)
    if (m && m[1]) {
      const n = Number(m[1])
      const r = bucketByNum(n)
      if (r) return r
    }
  }

  return byLevel || ''
}

function inferDurationBucket(durationText) {
  const s = String(durationText || '').trim()
  if (!s) return ''
  if (/长期/.test(s)) return 'LONG'
  if (/短期/.test(s)) return 'SHORT'
  const m = s.match(/(\d+)\s*个?月/)
  if (m && m[1]) {
    const months = Number(m[1])
    if (Number.isFinite(months)) {
      if (months <= 2) return 'SHORT'
      if (months <= 6) return 'MID'
      return 'LONG'
    }
  }
  return ''
}

function buildUniqueAttributesFromRawDemand(demandLike) {
  const d = demandLike && typeof demandLike === 'object' ? demandLike : {}
  const normalized = normalizeRawDemandForStorage(d)
  const dailyRateText = String(normalized.daily_rate || '').trim()
  const dailyRateNum = (() => {
    if (!dailyRateText) return null
    const n = Number(dailyRateText)
    if (!Number.isFinite(n) || n <= 0) return null
    return Math.round(n)
  })()
  return {
    module_codes: normalized.module_codes,
    city: normalized.city || '',
    is_remote: normalized.is_remote === null ? null : normalized.is_remote,
    duration_text: String(normalized.duration_text || '').trim(),
    years_text: String(normalized.years_text || '').trim(),
    language_tag: String(normalized.language_tag || '').trim(),
    daily_rate_text: dailyRateText,
    daily_rate_num: dailyRateNum,
    cooperation_mode: String(normalized.cooperation_mode || '').trim(),
    work_mode: String(normalized.work_mode || '').trim(),
    consultant_level: String(normalized.consultant_level || '').trim(),
    project_cycle: String(normalized.project_cycle || '').trim(),
    time_requirement: String(normalized.time_requirement || '').trim(),
    years_bucket: inferYearsBucket(normalized.years_text, normalized.consultant_level),
    duration_bucket: inferDurationBucket(normalized.duration_text),
  }
}

function buildUniqueTagsFromAttributes(attrs) {
  const a = attrs && typeof attrs === 'object' ? attrs : {}
  const tags = []
  const mods = Array.isArray(a.module_codes) ? a.module_codes : []
  tags.push(...deriveModuleLabelsFromCodes(mods))
  if (a.city) tags.push(String(a.city))
  if (a.is_remote === true) tags.push('远程')
  if (a.language_tag) tags.push(String(a.language_tag))
  if (a.duration_text) tags.push(String(a.duration_text))
  if (a.years_text) tags.push(String(a.years_text))
  if (a.project_cycle) tags.push(String(a.project_cycle))
  if (a.consultant_level) tags.push(String(a.consultant_level))
  if (a.cooperation_mode) tags.push(String(a.cooperation_mode))
  if (a.time_requirement) tags.push(String(a.time_requirement))
  return tags.filter(Boolean)
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
  // Local dev bypass: allow calling admin endpoints from localhost without auth headers.
  // This is only enabled for loopback requests, so it won't affect production.
  try {
    const host = String(req && (req.hostname || req.headers && req.headers.host) || '')
    const ip = String(req && (req.ip || req.connection && req.connection.remoteAddress) || '')
    const isLoopbackHost = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
    const isLoopbackIp = ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1'
    if (isLoopbackHost || isLoopbackIp) {
      return { uid: 'local_admin', nickname: 'local_admin' }
    }
  } catch {}

  const auth = requireWriteAuth(req, res)
  if (!auth) return null
  const set = getAdminUidSet()
  if (set.size === 0) {
    try {
      console.warn('admin_uids_not_configured', { uid: String(auth.uid || '').trim() })
    } catch {}
    res.status(403).json({ ok: false, error: 'ADMIN_UIDS_NOT_CONFIGURED' })
    return null
  }

  const uid = String(auth.uid || '').trim()
  if (!set.has(uid)) {
    try {
      console.warn('admin_required', { uid, adminUids: Array.from(set) })
    } catch {}
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
  let module_codes = Array.isArray(moduleCodesRaw)
    ? moduleCodesRaw.map((x) => String(x || '').trim()).filter(Boolean)
    : []

  const inferred = rawText ? parseDemandFromRawText(rawText) : null
  if (!module_codes.length && inferred && Array.isArray(inferred.module_codes) && inferred.module_codes.length) {
    module_codes = inferred.module_codes
  }

  const provider_user_id = String((input && (input.provider_user_id || input.provider_id || input.uid)) || '').trim()
  const provider_name = String((input && (input.provider_name || input.publisher_name || input.nickname)) || '').trim()

  const payload = {
    ...input,
    raw_text: rawText,
    module_codes,
    city: (input && input.city) || (inferred && inferred.city) || '',
    is_remote:
      typeof (input && input.is_remote) === 'boolean'
        ? input.is_remote
        : inferred && Object.prototype.hasOwnProperty.call(inferred, 'is_remote')
          ? inferred.is_remote
          : null,
    duration_text: (input && (input.duration_text || input.durationText)) || (inferred && inferred.duration_text) || '',
    years_text: (input && (input.years_text || input.yearsText)) || (inferred && inferred.years_text) || '',
    language_tag: (input && (input.language_tag || input.language)) || (inferred && inferred.language_tag) || '',
    daily_rate: (input && (input.daily_rate || input.dailyRate)) || (inferred && inferred.daily_rate) || '',
    consultant_level: (input && (input.consultant_level || input.consultantLevel)) || (inferred && inferred.consultant_level) || '',
    cooperation_mode: (input && (input.cooperation_mode || input.cooperationMode)) || (inferred && inferred.cooperation_mode) || '',
    provider_user_id: provider_user_id || (fallbackAuth && fallbackAuth.uid) || 'local_ingest',
    provider_name: provider_name || (fallbackAuth && fallbackAuth.nickname) || '未知',
    updatedAt: now,
  }

  if (!payload.createdAt) payload.createdAt = now

  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) delete payload[k]
  })

  return normalizeRawDemandForStorage(payload)
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
      provider_user_id text,
      provider_name text,
      canonical_raw_id text,
      canonical_set_by text,
      canonical_set_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at_db timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`ALTER TABLE sap_unique_demands ADD COLUMN IF NOT EXISTS provider_user_id text`)
  await pool.query(`ALTER TABLE sap_unique_demands ADD COLUMN IF NOT EXISTS provider_name text`)

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
    provider_user_id: row.provider_user_id || '',
    provider_name: row.provider_name || '',
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

async function ensureFavoritesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_demand_favorites (
      user_id text NOT NULL,
      demand_id bigint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, demand_id)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demand_favorites_user_idx ON sap_demand_favorites(user_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demand_favorites_demand_idx ON sap_demand_favorites(demand_id)`)
}

async function ensureFavoritesV2Table() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_demand_favorites_v2 (
      user_id text NOT NULL,
      demand_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, demand_key)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demand_favorites_v2_user_idx ON sap_demand_favorites_v2(user_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demand_favorites_v2_key_idx ON sap_demand_favorites_v2(demand_key)`)
}

async function resolveFavoriteKey(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''

  // Prefer unique id form.
  if (/^raw_ud_/i.test(raw)) return raw

  const directNum = parseDemandIdNum(raw)
  if (!directNum) return raw

  // Try map numeric raw id -> unique demand id.
  try {
    await ensureDemandsTable()
    const r = await pool.query('SELECT unique_demand_id FROM sap_demands WHERE id = $1 LIMIT 1', [Math.trunc(directNum)])
    const row = r && r.rows && r.rows[0]
    const uid = row ? String(row.unique_demand_id || '').trim() : ''
    if (uid) return uid
  } catch (e) {
    console.error('resolve_favorite_key_by_demands_failed', e)
  }

  try {
    await ensureUniqueDemandsTable()
    const r2 = await pool.query('SELECT doc_id FROM sap_unique_demands WHERE canonical_raw_id = $1 LIMIT 1', [String(directNum)])
    const row2 = r2 && r2.rows && r2.rows[0]
    const uid2 = row2 ? String(row2.doc_id || '').trim() : ''
    if (uid2) return uid2
  } catch (e) {
    console.error('resolve_favorite_key_by_unique_failed', e)
  }

  // Fallback: keep numeric in a stable text key.
  return `ud_${Math.trunc(directNum)}`
}

async function canUseFavoritesV2() {
  try {
    const r = await pool.query(
      `SELECT 1 AS ok
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'sap_demand_favorites_v2'
       LIMIT 1`,
    )
    return !!(r && r.rows && r.rows[0])
  } catch {
    return false
  }
}

async function ensureUgcReportsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_ugc_reports (
      id bigserial PRIMARY KEY,
      category text,
      description text,
      contact text,
      target_type text,
      target_id text,
      page_url text,
      reporter_user_id text,
      reporter_nickname text,
      status text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_ugc_reports_created_idx ON sap_ugc_reports(created_at DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_ugc_reports_target_idx ON sap_ugc_reports(target_type, target_id)`)
 }

async function ensureDemandStatusTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_demand_status (
      user_id text NOT NULL,
      demand_id bigint NOT NULL,
      status text NOT NULL,
      nickname text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, demand_id, status)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demand_status_demand_idx ON sap_demand_status(demand_id)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demand_status_user_idx ON sap_demand_status(user_id)`)
}

async function ensureDemandReliabilityTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_demand_reliability (
      user_id text NOT NULL,
      demand_id bigint NOT NULL,
      reliable boolean,
      nickname text,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, demand_id)
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demand_reliability_demand_idx ON sap_demand_reliability(demand_id)`)
}

async function ensureMessagesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id bigserial PRIMARY KEY,
      from_user_id text NOT NULL,
      to_user_id text NOT NULL,
      demand_id text,
      content text NOT NULL,
      is_read boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS messages_from_idx ON messages(from_user_id, created_at DESC)`)
  await pool.query(`CREATE INDEX IF NOT EXISTS messages_to_idx ON messages(to_user_id, created_at DESC)`)
}

async function ensureCommentRepliesTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_comment_replies (
      id bigserial PRIMARY KEY,
      comment_id text NOT NULL,
      demand_id text NOT NULL,
      content text NOT NULL,
      nickname text,
      user_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_comment_replies_comment_idx ON sap_comment_replies(comment_id, created_at ASC)`)
}

async function ensureUgcTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_rate_limits (
      id text PRIMARY KEY,
      uid text NOT NULL,
      key text NOT NULL,
      last_ts bigint,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_demand_comments (
      id bigserial PRIMARY KEY,
      demand_id text NOT NULL,
      content text NOT NULL,
      nickname text,
      user_id text NOT NULL,
      likes integer NOT NULL DEFAULT 0,
      dislikes integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_demand_comments_demand_idx ON sap_demand_comments(demand_id, created_at DESC)`)

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_comment_reactions (
      unique_key text PRIMARY KEY,
      comment_id bigint NOT NULL,
      demand_id text NOT NULL,
      user_id text NOT NULL,
      reaction text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz
    )
  `)
  await pool.query(`CREATE INDEX IF NOT EXISTS sap_comment_reactions_comment_idx ON sap_comment_reactions(comment_id)`)
}

async function ensureContactUnlockTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_contact_unlock_limits (
      id text PRIMARY KEY,
      uid text NOT NULL,
      day text NOT NULL,
      count integer NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sap_contact_unlock_logs (
      id text PRIMARY KEY,
      uid text NOT NULL,
      demand_id text NOT NULL,
      target_provider_user_id text NOT NULL,
      target_raw_id text,
      day text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  // Backward-compat: older deployments may not have the `id` column (or may not have it as unique).
  // We rely on `id` for upsert (`ON CONFLICT (id)`), so we must ensure column + unique index exists.
  try {
    await pool.query('ALTER TABLE sap_contact_unlock_limits ADD COLUMN IF NOT EXISTS id text')
  } catch {}
  try {
    await pool.query('ALTER TABLE sap_contact_unlock_logs ADD COLUMN IF NOT EXISTS id text')
  } catch {}

  // Backfill id values for limits when missing.
  try {
    await pool.query(
      "UPDATE sap_contact_unlock_limits SET id = CONCAT('daily_', day, '_', uid) WHERE (id IS NULL OR id = '')",
    )
  } catch {}

  // Make sure `id` is unique even if it's not the primary key.
  try {
    await pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS sap_contact_unlock_limits_id_uq ON sap_contact_unlock_limits(id) WHERE id IS NOT NULL',
    )
  } catch {}
  try {
    await pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS sap_contact_unlock_logs_id_uq ON sap_contact_unlock_logs(id) WHERE id IS NOT NULL',
    )
  } catch {}

  // Natural key for limits: (uid, day). Some legacy tables may not have `id` as primary key.
  try {
    await pool.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS sap_contact_unlock_limits_uid_day_uq ON sap_contact_unlock_limits(uid, day)',
    )
  } catch {}

  // Backward-compat: earlier schema might have uuid typed primary keys.
  // If so, convert to text so we can store string keys like "unlock_YYYY-MM-DD_...".
  try {
    await pool.query('ALTER TABLE sap_contact_unlock_logs ALTER COLUMN id TYPE text USING id::text')
  } catch {}
  try {
    await pool.query('ALTER TABLE sap_contact_unlock_limits ALTER COLUMN id TYPE text USING id::text')
  } catch {}

  try {
    const r = await pool.query(
      "SELECT tc.table_name, tc.constraint_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.table_schema = current_schema() AND tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('sap_contact_unlock_logs', 'sap_contact_unlock_limits') AND kcu.column_name = 'uid'",
    )
    const rows = (r && r.rows) || []
    for (const row of rows) {
      const table = String(row.table_name || '').trim()
      const name = String(row.constraint_name || '').trim()
      if (!table || !name) continue
      try {
        const qt = `"${table.replace(/\"/g, '""')}"`
        const qn = `"${name.replace(/\"/g, '""')}"`
        await pool.query(`ALTER TABLE ${qt} DROP CONSTRAINT IF EXISTS ${qn}`)
      } catch {}
    }
  } catch {}
}

function sanitizeText(input, maxLen) {
  const s = String(input || '').replace(/\u0000/g, '').trim()
  if (!s) return ''
  return s.length > maxLen ? s.slice(0, maxLen) : s
}

function computeRichnessScore(demandLike) {
  const d = demandLike && typeof demandLike === 'object' ? demandLike : {}
  const rawText = String(d.raw_text || d.rawText || '').trim()
  const moduleCodes = Array.isArray(d.module_codes) ? d.module_codes : []
  const moduleLabels = Array.isArray(d.module_labels) ? d.module_labels : []

  const city = String(d.city || '').trim()
  const duration = String(d.duration_text || d.durationText || '').trim()
  const years = String(d.years_text || d.yearsText || '').trim()
  const language = String(d.language_tag || d.language || '').trim()
  const dailyRate = String(d.daily_rate || d.dailyRate || '').trim()
  const cooperationMode = String(d.cooperation_mode || d.cooperationMode || '').trim()
  const consultantLevel = String(d.consultant_level || d.consultantLevel || '').trim()
  const projectCycle = String(d.project_cycle || d.projectCycle || '').trim()
  const timeRequirement = String(d.time_requirement || d.timeRequirement || '').trim()
  const hasRemoteFlag = typeof d.is_remote === 'boolean'

  let score = 0

  // raw_text: base signal
  if (rawText.length >= 10) score += 10
  if (rawText.length >= 30) score += 10
  if (rawText.length >= 60) score += 10
  if (rawText.length >= 120) score += 10

  // structured fields
  if (moduleCodes.length > 0) score += 10
  else if (moduleLabels.length > 0) score += 6
  if (city) score += 8
  if (hasRemoteFlag) score += 4
  if (duration) score += 6
  if (years) score += 6
  if (language) score += 6
  if (dailyRate) score += 6
  if (cooperationMode) score += 5
  if (consultantLevel) score += 5
  if (projectCycle) score += 5
  if (timeRequirement) score += 5

  // cap
  if (!Number.isFinite(score)) score = 0
  return Math.max(0, Math.min(100, Math.trunc(score)))
}

function containsForbiddenContent(text) {
  const s = String(text || '')
  if (!s) return false
  if (/https?:\/\//i.test(s)) return true
  if (/\b1[3-9]\d{9}\b/.test(s)) return true
  const hasWeChatHint = /(微信|vx|v信|wechat|加v|加V|加微)/i.test(s)
  const wechatIdLike = /[a-zA-Z][a-zA-Z0-9_-]{4,}/.test(s)
  if (hasWeChatHint && wechatIdLike) return true
  const hasQqHint = /(qq|Qq|QQ群|加群)/.test(s)
  const qqNumLike = /\b[1-9]\d{4,11}\b/.test(s)
  if (hasQqHint && qqNumLike) return true
  return false
}

async function enforceInterval(uid, key, minIntervalMs) {
  await ensureUgcTables()
  const id = `rate_${uid}_${key}`
  const now = Date.now()

  try {
    const r = await pool.query('SELECT last_ts FROM sap_rate_limits WHERE id = $1 LIMIT 1', [id])
    const row = r && r.rows && r.rows[0]
    const last = row && row.last_ts ? Number(row.last_ts) : 0
    if (last && now - last < minIntervalMs) {
      throw new Error('TOO_FREQUENT')
    }
  } catch (e) {
    const msg = String(e && e.message ? e.message : '')
    if (msg === 'TOO_FREQUENT') throw e
  }

  await pool.query(
    'INSERT INTO sap_rate_limits (id, uid, key, last_ts) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO UPDATE SET last_ts = EXCLUDED.last_ts, updated_at = now()',
    [id, uid, key, now],
  )
}

async function getNicknameFromProfiles(uid) {
  try {
    await ensureProfilesColumns()
    const r = await pool.query('SELECT nickname FROM user_profiles WHERE cloudbase_uid = $1 LIMIT 1', [uid])
    const row = r && r.rows && r.rows[0]
    const name = String((row && row.nickname) || '').trim()
    return name || '匿名用户'
  } catch {
    return '匿名用户'
  }
}

async function addPointsToUser(targetUid, delta) {
  const duid = String(targetUid || '').trim()
  const d = Number(delta || 0)
  if (!duid || !Number.isFinite(d) || d <= 0) return

  try {
    const row = await getOrCreateProfile(duid, '')
    const current = Number(row && row.points ? row.points : 0)
    const next = Math.max(0, current + Math.trunc(d))
    await pool.query('UPDATE user_profiles SET points = $1, updated_at = now() WHERE cloudbase_uid = $2', [next, duid])
  } catch {
    // ignore
  }
}

async function upsertUniqueDemand(docId, demand) {
  await ensureUniqueDemandsTable()

  const id = pickDocIdLike(docId)
  const d = demand && typeof demand === 'object' ? demand : {}

  if ((d.richness_score === undefined || d.richness_score === null) && d.raw_text) {
    d.richness_score = computeRichnessScore(d)
  }

  const providerUserId = String((d && (d.provider_user_id || d.provider_id || d.providerUid)) || '').trim()
  const providerName = String((d && (d.provider_name || d.publisher_name || d.publisherName)) || '').trim()

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
    providerUserId || null,
    providerName || null,
  ]

  const r = await pool.query(
    `
    INSERT INTO sap_unique_demands (
      doc_id, local_id, raw_text, tags_json, attributes_json,
      demand_type, richness_score,
      created_time, message_time, updated_at, last_updated_time,
      created_time_ts, message_time_ts, updated_at_ts, last_updated_time_ts,
      synced_at, source,
      provider_user_id, provider_name
    )
    VALUES (
      $1, $2, $3, $4, $5,
      $6, $7,
      $8, $9, $10, $11,
      $12, $13, $14, $15,
      $16, $17,
      $18, $19
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
      provider_user_id = EXCLUDED.provider_user_id,
      provider_name = EXCLUDED.provider_name,
      updated_at_db = now()
    RETURNING *
    `,
    vals,
  )

  return r && r.rows && r.rows[0] ? r.rows[0] : null
}

async function linkOrCreateUniqueForDemandRow(demandRow) {
  if (!demandRow) return null
  const overrideBy = String(demandRow.unique_override_by || '').trim()
  if (overrideBy) return null
  const existing = String(demandRow.unique_demand_id || '').trim()
  if (existing) return existing

  const rawText = String(demandRow.raw_text || '').trim()
  if (!rawText) return null

  const attrs = buildUniqueAttributesFromRawDemand(demandRow)
  const incomingCategory = getCategoryLite(attrs)

  let cfg = null
  try {
    cfg = await fetchAdminConfigFromPg()
  } catch {
    cfg = getDefaultSimilarityConfig()
  }

  let bestId = ''
  try {
    if (cfg && cfg.similarity_enabled !== false) {
      await ensureUniqueDemandsTable()
      const r = await pool.query(
        "SELECT * FROM sap_unique_demands WHERE demand_type IS NULL OR demand_type = 'valid' ORDER BY last_updated_time_ts DESC NULLS LAST, updated_at_ts DESC NULLS LAST, created_time_ts DESC NULLS LAST, doc_id DESC LIMIT 200",
      )
      const candidates = (r && r.rows) || []
      const rule = normalizeRule(cfg.similarity_rule)
      const threshold = normalizeThreshold(cfg.similarity_threshold)
      const matched = pickBestUniqueMatchCloudbase({
        incomingRawText: rawText,
        incomingCategory,
        candidates,
        rule,
        threshold,
      })
      if (matched && matched.best) {
        bestId = String(matched.best.doc_id || '').trim()
      }
    }
  } catch (e) {
    console.error('unique_auto_match_failed', e)
    bestId = ''
  }

  const uniqueId = bestId || `raw_ud_${String(demandRow.demand_key || normalizeDemandKey(rawText))}`

  if (bestId) {
    const nowTs = Date.now()
    try {
      await ensureUniqueDemandsTable()
      await pool.query(
        `UPDATE sap_unique_demands
         SET
           created_time = COALESCE(created_time, now()),
           created_time_ts = COALESCE(created_time_ts, $2),
           updated_at = now(),
           updated_at_ts = $2,
           last_updated_time = now(),
           last_updated_time_ts = $2,
           updated_at_db = now()
         WHERE doc_id = $1`,
        [bestId, Math.trunc(nowTs)],
      )
    } catch (e) {
      console.error('unique_touch_failed', e)
    }
  }

  if (!bestId) {
    const now = new Date()
    const tags = buildUniqueTagsFromAttributes(attrs)
    await upsertUniqueDemand(uniqueId, {
      raw_text: rawText,
      tags_json: JSON.stringify(tags),
      attributes_json: JSON.stringify(attrs),
      demand_type: 'valid',
      richness_score: computeRichnessScore(demandRow),
      source: String(demandRow.source || 'user'),
      provider_user_id: String(demandRow.provider_user_id || ''),
      provider_name: String(demandRow.provider_name || ''),
      created_time: now,
      updated_at: now,
      last_updated_time: now,
      created_time_ts: Date.now(),
      updated_at_ts: Date.now(),
      last_updated_time_ts: Date.now(),
    })
  }

  try {
    await ensureDemandsTable()
    await pool.query(
      "UPDATE sap_demands SET unique_demand_id = $1, updated_at = now() WHERE id = $2 AND (unique_override_by IS NULL OR unique_override_by = '')",
      [uniqueId, Math.trunc(Number(demandRow.id))],
    )
  } catch (e) {
    console.error('unique_link_back_failed', e)
  }

  return uniqueId
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
  const normalized = normalizeRawDemandForStorage(payload)
  const rawText = String(normalized && normalized.raw_text || '').trim()
  const demandKey = normalizeDemandKey(rawText)
  const moduleCodes = Array.isArray(normalized && normalized.module_codes) ? normalized.module_codes : []
  const moduleLabels = Array.isArray(normalized && normalized.module_labels) ? normalized.module_labels : []

  const providerName = String(normalized && normalized.provider_name || '').trim()
  const providerUid = String(normalized && normalized.provider_user_id || '').trim()

  const vals = [
    demandKey,
    rawText,
    moduleCodes,
    moduleLabels,
    normalized.city ? String(normalized.city) : null,
    normalized.duration_text ? String(normalized.duration_text) : null,
    normalized.years_text ? String(normalized.years_text) : null,
    normalized.language ? String(normalized.language) : null,
    normalized.daily_rate ? String(normalized.daily_rate) : null,
    typeof normalized.is_remote === 'boolean' ? normalized.is_remote : null,
    normalized.cooperation_mode ? String(normalized.cooperation_mode) : null,
    normalized.work_mode ? String(normalized.work_mode) : null,
    normalized.consultant_level ? String(normalized.consultant_level) : null,
    normalized.project_cycle ? String(normalized.project_cycle) : null,
    normalized.time_requirement ? String(normalized.time_requirement) : null,
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

async function handleDemandIngest(req, res) {
  if (!demandsFeatureEnabled()) {
    res.status(410).json({ ok: false, error: 'DEMANDS_MOVED_TO_SAPBOSS_API' })
    return
  }
  await handleDemandIngestPg(req, res)
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
    res.json({ ok: true, db: true, ts: Date.now(), pgport: process.env.PGPORT ? Number(process.env.PGPORT) : null })
  } catch (e) {
    console.error('health_check_failed', e)
    res.status(500).json({ ok: false, db: false, error: 'DB_UNAVAILABLE', pgport: process.env.PGPORT ? Number(process.env.PGPORT) : null })
  }
})

app.post('/demand_status/counts_bulk', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    await ensureDemandStatusTable()
    const body = (req && req.body) || {}
    const demandIds = Array.isArray(body.demandIds) ? body.demandIds : []

    const { mapping, nums } = await resolveDemandIdNums(demandIds)
    if (!mapping.size) {
      res.json({ ok: true, counts: {} })
      return
    }

    const baseCountsByNum = new Map()
    if (nums.length) {
      const r = await pool.query(
        'SELECT demand_id, status, COUNT(*)::int AS cnt FROM sap_demand_status WHERE demand_id = ANY($1::bigint[]) GROUP BY demand_id, status',
        [nums],
      )
      for (const row of r.rows || []) {
        const idNum = Number(row.demand_id)
        if (!Number.isFinite(idNum) || idNum <= 0) continue
        const s = String(row.status || '').trim()
        if (!s) continue
        if (!baseCountsByNum.has(idNum)) baseCountsByNum.set(idNum, { applied: 0, interviewed: 0, onboarded: 0, closed: 0 })
        const bucket = baseCountsByNum.get(idNum)
        bucket[s] = Number(row.cnt || 0)
      }
    }

    const out = {}
    for (const [raw, idNum] of mapping.entries()) {
      if (idNum) out[raw] = baseCountsByNum.get(idNum) || { applied: 0, interviewed: 0, onboarded: 0, closed: 0 }
      else out[raw] = { applied: 0, interviewed: 0, onboarded: 0, closed: 0 }
    }
    res.json({ ok: true, counts: out })
  } catch (e) {
    console.error('demand_status_counts_bulk_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/admin/unique_demands/reparse_recent', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureUniqueDemandsTable()
    const body = (req && req.body) || {}
    const days = Math.max(1, Math.min(365, Number(body.days || 90)))
    const limit = Math.max(1, Math.min(5000, Number(body.limit || 2000)))

    const r = await pool.query(
      `SELECT doc_id, raw_text
       FROM sap_unique_demands
       WHERE created_at >= (now() - ($1::int * interval '1 day'))
       ORDER BY created_at DESC
       LIMIT $2`,
      [Math.trunc(days), Math.trunc(limit)],
    )

    const rows = (r && r.rows) || []
    const updates = []
    for (const row of rows) {
      const docId = String(row && row.doc_id || '').trim()
      if (!docId) continue
      const rawText = String(row && row.raw_text || '').trim()
      const parsed = parseDemandFromRawText(rawText)
      const attrs = buildUniqueAttributesFromRawDemand(parsed)
      const tags = buildUniqueTagsFromAttributes(attrs)
      updates.push({ doc_id: docId, tags_json: JSON.stringify(tags), attributes_json: JSON.stringify(attrs) })
    }

    if (!updates.length) {
      res.json({ ok: true, updated: 0, requested: 0 })
      return
    }

    const CHUNK = 200
    let updated = 0
    for (let i = 0; i < updates.length; i += CHUNK) {
      const chunk = updates.slice(i, i + CHUNK)
      const vals = []
      const rowsSql = []
      let p = 1
      for (const it of chunk) {
        rowsSql.push(`($${p++}, $${p++}, $${p++})`)
        vals.push(it.doc_id, it.tags_json, it.attributes_json)
      }

      const sql = `
        WITH v(doc_id, tags_json, attributes_json) AS (
          VALUES ${rowsSql.join(',')}
        )
        UPDATE sap_unique_demands u
        SET
          tags_json = v.tags_json,
          attributes_json = v.attributes_json,
          updated_at_db = now()
        FROM v
        WHERE u.doc_id = v.doc_id
        RETURNING u.doc_id
      `
      const ur = await pool.query(sql, vals)
      updated += (ur && ur.rowCount) || 0
    }

    res.json({ ok: true, updated, requested: updates.length })
  } catch (e) {
    console.error('admin_unique_demands_reparse_recent_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/admin/unique_demands/cleanup_invalid', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureUniqueDemandsTable()
    const body = (req && req.body) || {}
    const days = Math.max(1, Math.min(3650, Number(body.days || 365)))
    const limit = Math.max(1, Math.min(50000, Number(body.limit || 20000)))
    const dryRun = body && (body.dryRun === true || body.dryRun === 1 || body.dryRun === '1' || body.dryRun === 'true')
    const sample = Math.max(0, Math.min(100, Number(body.sample || 20)))

    const r = await pool.query(
      `SELECT doc_id, raw_text, demand_type
       FROM sap_unique_demands
       WHERE created_at >= (now() - ($1::int * interval '1 day'))
       ORDER BY created_at DESC
       LIMIT $2`,
      [Math.trunc(days), Math.trunc(limit)],
    )

    const rows = (r && r.rows) || []
    const reasons = new Map()
    const bad = []
    const samples = []

    function bump(reason) {
      reasons.set(reason, (reasons.get(reason) || 0) + 1)
    }

    function toPreview(text) {
      const s = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
      const oneLine = s.split('\n').map((x) => String(x || '').trim()).filter(Boolean).slice(0, 2).join(' / ')
      if (!oneLine) return ''
      return oneLine.length > 180 ? `${oneLine.slice(0, 180)}...` : oneLine
    }

    for (const row of rows) {
      const docId = String(row && row.doc_id || '').trim()
      if (!docId) continue
      const rawText0 = String(row && row.raw_text || '')
      const rawTrim = String(rawText0 || '').trim()

      let reason = ''
      if (!rawTrim || rawTrim.length < 20) {
        reason = 'TOO_SHORT'
      } else {
        const newlineCount = (rawText0.match(/\n/g) || []).length
        if (rawText0.length > 500 || newlineCount >= 3) {
          reason = 'RAW_TEXT_BLOCKY'
        } else {
          const inferred = parseDemandFromRawText(rawTrim)
          if (!inferred || !Array.isArray(inferred.module_codes) || !inferred.module_codes.length) {
            reason = 'NO_MODULE'
          } else if (countDemandInfoDims(inferred) < 2) {
            reason = 'DIMENSIONS_TOO_FEW'
          }
        }
      }

      if (!reason) continue

      bump(reason)
      bad.push({ doc_id: docId, reason })
      if (sample > 0 && samples.length < sample) {
        samples.push({ doc_id: docId, reason, demand_type: String(row && row.demand_type || ''), preview: toPreview(rawTrim) })
      }
    }

    const summary = {}
    for (const [k, v] of reasons.entries()) summary[k] = v

    if (dryRun) {
      res.json({ ok: true, dryRun: true, scanned: rows.length, invalid: bad.length, summary, samples })
      return
    }

    if (!bad.length) {
      res.json({ ok: true, dryRun: false, scanned: rows.length, invalid: 0, updated: 0, summary, samples })
      return
    }

    const CHUNK = 500
    let updated = 0
    for (let i = 0; i < bad.length; i += CHUNK) {
      const chunk = bad.slice(i, i + CHUNK)
      const vals = []
      const rowsSql = []
      let p = 1
      for (const it of chunk) {
        rowsSql.push(`($${p++}, $${p++})`)
        vals.push(it.doc_id, it.reason)
      }

      const sql = `
        WITH v(doc_id, reason) AS (
          VALUES ${rowsSql.join(',')}
        )
        UPDATE sap_unique_demands u
        SET
          demand_type = 'invalid',
          updated_at_db = now()
        FROM v
        WHERE u.doc_id = v.doc_id
        RETURNING u.doc_id
      `

      const ur = await pool.query(sql, vals)
      updated += (ur && ur.rowCount) || 0
    }

    res.json({ ok: true, dryRun: false, scanned: rows.length, invalid: bad.length, updated, summary, samples })
  } catch (e) {
    console.error('admin_unique_demands_cleanup_invalid_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/debug/lookup_uid', async (req, res) => {
  try {
    const env = String(process.env.NODE_ENV || '').trim().toLowerCase()
    const ip = String((req.ip || req.connection?.remoteAddress || '')).trim()
    const isLocal =
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      /(^|:)127\.0\.0\.1$/.test(ip) ||
      /::ffff:127\.0\.0\.1/i.test(ip)
    if (env === 'production' || !isLocal) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' })
      return
    }

    await ensureAccountsTable()
    const phoneRaw = String((req.query && req.query.phone) || '').trim()
    const emailRaw = String((req.query && req.query.email) || '').trim()
    const usernameRaw = String((req.query && req.query.username) || '').trim()

    const candidates = []
    if (phoneRaw) candidates.push(normalizePhoneLike(phoneRaw))
    if (emailRaw) candidates.push(String(emailRaw).trim().toLowerCase())
    if (usernameRaw) candidates.push(String(usernameRaw).trim().toLowerCase())

    const list = candidates.map((x) => String(x || '').trim()).filter(Boolean)
    if (!list.length) {
      res.status(400).json({ ok: false, error: 'IDENTIFIER_REQUIRED' })
      return
    }

    const r = await pool.query(
      'SELECT uid, identifier_type, identifier_norm, phone_norm, email_norm, username_norm FROM app_accounts WHERE identifier_norm = ANY($1::text[]) OR phone_norm = ANY($1::text[]) OR email_norm = ANY($1::text[]) OR username_norm = ANY($1::text[]) LIMIT 1',
      [list],
    )
    const row = r.rows && r.rows[0]
    if (!row || !row.uid) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' })
      return
    }
    res.json({ ok: true, uid: String(row.uid), account: row })
  } catch (e) {
    console.error('debug_lookup_uid_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/admin/accounts/lookup_uid', async (req, res) => {
  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureAccountsTable()
    const phoneRaw = String((req.query && req.query.phone) || '').trim()
    const emailRaw = String((req.query && req.query.email) || '').trim()
    const usernameRaw = String((req.query && req.query.username) || '').trim()

    const candidates = []
    if (phoneRaw) candidates.push(normalizePhoneLike(phoneRaw))
    if (emailRaw) candidates.push(String(emailRaw).trim().toLowerCase())
    if (usernameRaw) candidates.push(String(usernameRaw).trim().toLowerCase())

    const list = candidates.map((x) => String(x || '').trim()).filter(Boolean)
    if (!list.length) {
      res.status(400).json({ ok: false, error: 'IDENTIFIER_REQUIRED' })
      return
    }

    const r = await pool.query(
      'SELECT uid, identifier_type, identifier_norm, phone_norm, email_norm, username_norm FROM app_accounts WHERE identifier_norm = ANY($1::text[]) OR phone_norm = ANY($1::text[]) OR email_norm = ANY($1::text[]) OR username_norm = ANY($1::text[]) LIMIT 1',
      [list],
    )
    const row = r.rows && r.rows[0]
    if (!row || !row.uid) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' })
      return
    }
    res.json({ ok: true, uid: String(row.uid), account: row })
  } catch (e) {
    console.error('admin_accounts_lookup_uid_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/admin/unique_demands/recent', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureUniqueDemandsTable()
    const days = Math.max(1, Math.min(365, Number((req.query && req.query.days) || 90)))
    const limit = Math.max(1, Math.min(5000, Number((req.query && req.query.limit) || 1000)))
    const offset = Math.max(0, Math.min(200000, Number((req.query && req.query.offset) || 0)))

    const r = await pool.query(
      `SELECT *
       FROM sap_unique_demands
       WHERE created_at >= (now() - ($1::int * interval '1 day'))
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [Math.trunc(days), Math.trunc(limit), Math.trunc(offset)],
    )

    res.json({ ok: true, demands: (r.rows || []).map(mapUniqueDemandRow) })
  } catch (e) {
    console.error('admin_unique_demands_recent_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/admin/unique_demands/batch_update_tags', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureUniqueDemandsTable()
    const body = (req && req.body) || {}
    const updates = Array.isArray(body.updates) ? body.updates : []
    if (!updates.length) {
      res.status(400).json({ ok: false, error: 'UPDATES_REQUIRED' })
      return
    }

    const cleaned = []
    for (const u of updates) {
      const docId = String((u && (u.doc_id || u._id || u.id)) || '').trim()
      if (!docId) continue
      const tagsJson = u && u.tags_json !== undefined ? String(u.tags_json || '') : ''
      const attrsJson = u && u.attributes_json !== undefined ? String(u.attributes_json || '') : ''
      cleaned.push({ doc_id: docId, tags_json: tagsJson, attributes_json: attrsJson })
    }

    if (!cleaned.length) {
      res.status(400).json({ ok: false, error: 'NO_VALID_UPDATES' })
      return
    }

    const CHUNK = 200
    let updated = 0
    for (let i = 0; i < cleaned.length; i += CHUNK) {
      const chunk = cleaned.slice(i, i + CHUNK)
      const vals = []
      const rowsSql = []
      let p = 1
      for (const it of chunk) {
        rowsSql.push(`($${p++}, $${p++}, $${p++})`)
        vals.push(it.doc_id, it.tags_json, it.attributes_json)
      }

      const sql = `
        WITH v(doc_id, tags_json, attributes_json) AS (
          VALUES ${rowsSql.join(',')}
        )
        UPDATE sap_unique_demands u
        SET
          tags_json = v.tags_json,
          attributes_json = v.attributes_json,
          updated_at_db = now()
        FROM v
        WHERE u.doc_id = v.doc_id
        RETURNING u.doc_id
      `

      const r = await pool.query(sql, vals)
      updated += (r && r.rowCount) || 0
    }

    res.json({ ok: true, updated, requested: cleaned.length })
  } catch (e) {
    console.error('admin_unique_demands_batch_update_tags_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/admin/demands/recent', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureDemandsTable()
    const days = Math.max(1, Math.min(365, Number((req.query && req.query.days) || 90)))
    const limit = Math.max(1, Math.min(5000, Number((req.query && req.query.limit) || 1000)))
    const offset = Math.max(0, Math.min(200000, Number((req.query && req.query.offset) || 0)))

    const r = await pool.query(
      `SELECT *
       FROM sap_demands
       WHERE created_at >= (now() - ($1::int * interval '1 day'))
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [Math.trunc(days), Math.trunc(limit), Math.trunc(offset)],
    )

    res.json({ ok: true, demands: (r.rows || []).map(mapDemandRow) })
  } catch (e) {
    console.error('admin_demands_recent_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/admin/demands/batch_update_tags', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  const admin = requireAdminAuth(req, res)
  if (!admin) return

  try {
    await ensureDemandsTable()
    const body = (req && req.body) || {}
    const updates = Array.isArray(body.updates) ? body.updates : []
    if (!updates.length) {
      res.status(400).json({ ok: false, error: 'UPDATES_REQUIRED' })
      return
    }

    const cleaned = []
    for (const u of updates) {
      const idNum = parseDemandIdNum(u && u.id)
      if (!idNum) continue
      const module_codes = Array.isArray(u && u.module_codes) ? u.module_codes.map((x) => String(x || '').trim()).filter(Boolean) : []
      const module_labels = Array.isArray(u && u.module_labels) ? u.module_labels.map((x) => String(x || '').trim()).filter(Boolean) : []
      cleaned.push({
        id: idNum,
        module_codes,
        module_labels,
        city: String((u && u.city) || '').trim(),
        is_remote: typeof (u && u.is_remote) === 'boolean' ? u.is_remote : null,
        duration_text: String((u && u.duration_text) || '').trim(),
        years_text: String((u && u.years_text) || '').trim(),
        language: String((u && u.language) || '').trim(),
        daily_rate: String((u && u.daily_rate) || '').trim(),
      })
    }

    if (!cleaned.length) {
      res.status(400).json({ ok: false, error: 'NO_VALID_UPDATES' })
      return
    }

    const CHUNK = 200
    let updated = 0
    for (let i = 0; i < cleaned.length; i += CHUNK) {
      const chunk = cleaned.slice(i, i + CHUNK)
      const vals = []
      const rowsSql = []
      let p = 1
      for (const it of chunk) {
        rowsSql.push(`($${p++}, $${p++}::text[], $${p++}::text[], $${p++}, $${p++}::boolean, $${p++}, $${p++}, $${p++}, $${p++})`)
        vals.push(
          it.id,
          it.module_codes,
          it.module_labels,
          it.city || null,
          it.is_remote,
          it.duration_text || null,
          it.years_text || null,
          it.language || null,
          it.daily_rate || null,
        )
      }

      const sql = `
        WITH v(id, module_codes, module_labels, city, is_remote, duration_text, years_text, language, daily_rate) AS (
          VALUES ${rowsSql.join(',')}
        )
        UPDATE sap_demands d
        SET
          module_codes = COALESCE(v.module_codes, d.module_codes),
          module_labels = COALESCE(v.module_labels, d.module_labels),
          city = COALESCE(v.city, d.city),
          is_remote = v.is_remote,
          duration_text = v.duration_text,
          years_text = v.years_text,
          language = v.language,
          daily_rate = v.daily_rate,
          updated_at = now()
        FROM v
        WHERE d.id = v.id
        RETURNING d.id
      `

      const r = await pool.query(sql, vals)
      updated += (r && r.rowCount) || 0
    }

    res.json({ ok: true, updated, requested: cleaned.length })
  } catch (e) {
    console.error('admin_demands_batch_update_tags_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demands/by_ids', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    await ensureDemandsTable()
    const body = (req && req.body) || {}
    const raw = Array.isArray(body.ids) ? body.ids : []
    const ids = raw
      .map((x) => Number(String(x || '').trim()))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, 500)
      .map((n) => Math.trunc(n))

    if (!ids.length) {
      res.json({ ok: true, demands: [] })
      return
    }

    const r = await pool.query('SELECT * FROM sap_demands WHERE id = ANY($1::bigint[])', [ids])
    res.json({ ok: true, demands: (r.rows || []).map(mapDemandRow) })
  } catch (e) {
    console.error('demands_by_ids_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/unique_demands/by_raw/:rawId', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  try {
    await ensureUniqueDemandsTable()
    const rawId = String((req.params && req.params.rawId) || '').trim()
    if (!rawId) {
      res.status(400).json({ ok: false, error: 'RAW_ID_REQUIRED' })
      return
    }

    const r = await pool.query('SELECT doc_id FROM sap_unique_demands WHERE canonical_raw_id = $1 LIMIT 1', [rawId])
    const row = r && r.rows && r.rows[0]
    const uid = row ? String(row.doc_id || '').trim() : ''
    if (!uid) {
      res.status(404).json({ ok: false, error: 'NOT_FOUND' })
      return
    }

    res.json({ ok: true, uniqueId: uid })
  } catch (e) {
    console.error('unique_demand_lookup_by_raw_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/ugc_reports', async (req, res) => {
  const auth = requireWriteAuth(req, res)
  if (!auth) return
  try {
    await ensureUgcReportsTable()
    const body = (req && req.body) || {}
    const category = sanitizeText(body.category, 50)
    const description = sanitizeText(body.description, 2000)
    const contact = sanitizeText(body.contact, 200)
    const target_type = sanitizeText(body.target_type, 50)
    const target_id = sanitizeText(body.target_id, 200)
    const page_url = sanitizeText(body.page_url, 1000)
    const reporter_user_id = String(auth.uid || '').trim()
    const reporter_nickname = sanitizeText(body.reporter_nickname || auth.nickname || '', 80)

    if (!description) {
      res.status(400).json({ ok: false, error: 'DESCRIPTION_REQUIRED' })
      return
    }

    const r = await pool.query(
      `INSERT INTO sap_ugc_reports
        (category, description, contact, target_type, target_id, page_url, reporter_user_id, reporter_nickname, status)
       VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id`,
      [category, description, contact, target_type, target_id, page_url, reporter_user_id, reporter_nickname],
    )

    res.json({ ok: true, id: String(r.rows && r.rows[0] ? r.rows[0].id : '') })
  } catch (e) {
    console.error('ugc_reports_create_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
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
    if (id === 'count' || id === 'range' || id === 'all' || id === 'list') {
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

    const moduleRaw = String((req.query && req.query.module) || '').trim()
    const moduleUp = moduleRaw ? moduleRaw.toUpperCase() : ''
    const module = /^[A-Z0-9_\/-]{1,24}$/.test(moduleUp) && moduleUp !== 'ALL' && moduleUp !== 'OTHER' ? moduleUp : ''

    let sql = `SELECT * FROM sap_unique_demands WHERE ${field} >= $1 AND ${field} < $2`
    const vals = [Math.trunc(startTs), Math.trunc(endTs)]
    let idx = 3
    if (onlyValid) sql += " AND demand_type = 'valid'"
    if (module) {
      sql += ` AND ((tags_json ILIKE $${idx}) OR (attributes_json ILIKE $${idx}))`
      vals.push(`%\"${module}\"%`)
      idx += 1
    }
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


app.get('/unique_demands/list', async (req, res) => {
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

    const moduleRaw = String((req.query && req.query.module) || '').trim()
    const moduleUp = moduleRaw ? moduleRaw.toUpperCase() : ''
    const module = /^[A-Z0-9_\/-]{1,24}$/.test(moduleUp) && moduleUp !== 'ALL' && moduleUp !== 'OTHER' ? moduleUp : ''

    let sql = 'SELECT * FROM sap_unique_demands'
    const vals = []
    let idx = 1
    const wheres = []
    if (onlyValid) wheres.push("demand_type = 'valid'")
    if (module) {
      wheres.push(`((tags_json ILIKE $${idx}) OR (attributes_json ILIKE $${idx}))`)
      vals.push(`%\"${module}\"%`)
      idx += 1
    }
    if (wheres.length) {
      sql += ` WHERE ${wheres.join(' AND ')}`
    }
    sql += ` ORDER BY ${orderBy} ${order} NULLS LAST, doc_id ${order}`
    sql += ` OFFSET $${idx} LIMIT $${idx + 1}`
    vals.push(offset, limit)

    const r = await pool.query(sql, vals)
    res.json({ ok: true, demands: (r.rows || []).map(mapUniqueDemandRow) })
  } catch (e) {
    console.error('unique_demand_list_failed', e)
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

    const moduleRaw = String((req.query && req.query.module) || '').trim()
    const moduleUp = moduleRaw ? moduleRaw.toUpperCase() : ''
    const module = /^[A-Z0-9_\/-]{1,24}$/.test(moduleUp) && moduleUp !== 'ALL' && moduleUp !== 'OTHER' ? moduleUp : ''

    let sql = 'SELECT * FROM sap_unique_demands'
    const vals = []
    let idx = 1
    const wheres = []
    if (onlyValid) wheres.push("demand_type = 'valid'")
    if (module) {
      wheres.push(`((tags_json ILIKE $${idx}) OR (attributes_json ILIKE $${idx}))`)
      vals.push(`%\"${module}\"%`)
      idx += 1
    }
    if (wheres.length) {
      sql += ` WHERE ${wheres.join(' AND ')}`
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

    const rawDocId = pickDocIdLike(body.raw_id || body.doc_id || (demandObj && (demandObj._id || demandObj.id || demandObj.doc_id)))

    if (docId && String(docId).startsWith('raw_ud_')) {
      const rawText = String((demandObj && demandObj.raw_text) || '')
      const rawTrim = String(rawText || '').trim()
      if (!rawTrim || rawTrim.length < 20) {
        res.status(422).json({ ok: false, error: 'INVALID_DEMAND' })
        return
      }
      const inferred = parseDemandFromRawText(rawTrim)
      if (!inferred || !Array.isArray(inferred.module_codes) || !inferred.module_codes.length) {
        res.status(422).json({ ok: false, error: 'INVALID_DEMAND' })
        return
      }
      if (countDemandInfoDims(inferred) < 2) {
        res.status(422).json({ ok: false, error: 'INVALID_DEMAND' })
        return
      }
      const newlineCount = (rawText.match(/\n/g) || []).length
      if (rawText.length > 500 || newlineCount >= 3) {
        res.status(422).json({ ok: false, error: 'RAW_TEXT_BLOCKY' })
        return
      }
      const row = await upsertUniqueDemand(docId, demandObj)
      res.json({ ok: true, raw_id: rawDocId || '', unique: mapUniqueDemandRow(row) })
      return
    }

    const payload = sanitizeDemandPayload(demandObj || {}, auth)
    if (!payload.raw_text) {
      res.status(400).json({ ok: false, error: 'RAW_TEXT_REQUIRED' })
      return
    }

    {
      const rawTrim = String(payload.raw_text || '').trim()
      if (!rawTrim || rawTrim.length < 20) {
        res.status(422).json({ ok: false, error: 'INVALID_DEMAND' })
        return
      }
      const moduleCodes = Array.isArray(payload.module_codes) ? payload.module_codes : []
      if (!moduleCodes.length) {
        res.status(422).json({ ok: false, error: 'INVALID_DEMAND' })
        return
      }
      if (countDemandInfoDims(payload) < 2) {
        res.status(422).json({ ok: false, error: 'INVALID_DEMAND' })
        return
      }
    }

    {
      const rawText = String(payload.raw_text || '')
      const newlineCount = (rawText.match(/\n/g) || []).length
      if (rawText.length > 500 || newlineCount >= 3) {
        res.status(422).json({ ok: false, error: 'RAW_TEXT_BLOCKY' })
        return
      }
    }

    if (auth.ingestMode === 'user') {
      await ensureDemandsTable()
      const demandKey = normalizeDemandKey(String(payload.raw_text || ''))
      const existed = await pool.query('SELECT id FROM sap_demands WHERE demand_key = $1 LIMIT 1', [demandKey])
      if (existed && existed.rows && existed.rows[0]) {
        res.status(409).json({ ok: false, error: 'DUPLICATE_DEMAND' })
        return
      }
    }

    const source = payload.source || (auth.ingestMode === 'secret' ? 'ingest_secret' : 'web_user')
    const row = await upsertDemand(payload, source)

    const uniqueId = await linkOrCreateUniqueForDemandRow(row)
    if (uniqueId && row && !row.unique_demand_id) row.unique_demand_id = uniqueId

    res.json({ ok: true, raw_id: rawDocId || '', demand: mapDemandRow(row) })
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
  ;(async () => {
    try {
      const cfg = await fetchAdminConfigFromPg()
      res.json({ ok: true, config: cfg })
    } catch {
      res.json({ ok: true, config: getDefaultSimilarityConfig() })
    }
  })()
})

app.post('/config/similarity', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const admin = requireAdminAuth(req, res)
  if (!admin) return
  try {
    await ensureAdminConfigTable()
    const body = (req && req.body) || {}
    const enabled = body.similarity_enabled !== undefined ? !!body.similarity_enabled : undefined
    const rule = body.similarity_rule !== undefined ? normalizeRule(body.similarity_rule) : undefined
    const threshold = body.similarity_threshold !== undefined ? normalizeThreshold(body.similarity_threshold) : undefined

    const current = await fetchAdminConfigFromPg()
    const next = {
      similarity_enabled: enabled !== undefined ? enabled : current.similarity_enabled !== false,
      similarity_rule: rule !== undefined ? rule : current.similarity_rule,
      similarity_threshold: threshold !== undefined ? threshold : current.similarity_threshold,
    }

    await pool.query(
      `INSERT INTO sap_admin_config (config_key, similarity_enabled, similarity_rule, similarity_threshold, updated_by, updated_at, updated_at_ts)
       VALUES ($1, $2, $3, $4, $5, now(), $6)
       ON CONFLICT (config_key) DO UPDATE SET
         similarity_enabled = EXCLUDED.similarity_enabled,
         similarity_rule = EXCLUDED.similarity_rule,
         similarity_threshold = EXCLUDED.similarity_threshold,
         updated_by = EXCLUDED.updated_by,
         updated_at = now(),
         updated_at_ts = EXCLUDED.updated_at_ts`,
      ['global', next.similarity_enabled, next.similarity_rule, next.similarity_threshold, String(admin.uid || ''), Date.now()],
    )

    res.json({ ok: true, config: next })
  } catch (e) {
    console.error('config_similarity_update_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/favorites/add', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireWriteAuth(req, res)
  if (!auth) return
  try {
    await ensureFavoritesTable()
    await ensureFavoritesV2Table()
    const body = (req && req.body) || {}
    const demandId = String(body.demandId || body.demand_id || '').trim()
    const demandKey = await resolveFavoriteKey(demandId)
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !demandKey) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }

    await pool.query(
      'INSERT INTO sap_demand_favorites_v2 (user_id, demand_key) VALUES ($1, $2) ON CONFLICT (user_id, demand_key) DO NOTHING',
      [String(auth.uid || ''), demandKey],
    )

    // Backward compatible: also store numeric row if possible.
    if (idNum) {
      await pool.query(
        'INSERT INTO sap_demand_favorites (user_id, demand_id) VALUES ($1, $2) ON CONFLICT (user_id, demand_id) DO NOTHING',
        [String(auth.uid || ''), Math.trunc(idNum)],
      )
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('favorites_add_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/favorites/remove', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireWriteAuth(req, res)
  if (!auth) return
  try {
    await ensureFavoritesTable()
    await ensureFavoritesV2Table()
    const body = (req && req.body) || {}
    const demandId = String(body.demandId || body.demand_id || '').trim()
    const demandKey = await resolveFavoriteKey(demandId)
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !demandKey) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }

    await pool.query('DELETE FROM sap_demand_favorites_v2 WHERE user_id = $1 AND demand_key = $2', [
      String(auth.uid || ''),
      demandKey,
    ])

    // Backward compatible: also try delete numeric row.
    if (idNum) {
      await pool.query('DELETE FROM sap_demand_favorites WHERE user_id = $1 AND demand_id = $2', [
        String(auth.uid || ''),
        idNum,
      ])
    }
    res.json({ ok: true })
  } catch (e) {
    console.error('favorites_remove_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/favorites/check', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureFavoritesTable()
    await ensureFavoritesV2Table()
    const demandId = String((req.query && (req.query.demandId || req.query.demand_id)) || '').trim()
    const demandKey = await resolveFavoriteKey(demandId)
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !demandKey) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }

    const v2 = await pool.query(
      'SELECT 1 AS ok FROM sap_demand_favorites_v2 WHERE user_id = $1 AND demand_key = $2 LIMIT 1',
      [String(auth.uid || ''), demandKey],
    )
    if (v2 && v2.rows && v2.rows[0]) {
      res.json({ ok: true, favorited: true })
      return
    }

    if (idNum) {
      const r = await pool.query(
        'SELECT 1 AS ok FROM sap_demand_favorites WHERE user_id = $1 AND demand_id = $2 LIMIT 1',
        [String(auth.uid || ''), idNum],
      )
      res.json({ ok: true, favorited: !!(r && r.rows && r.rows[0]) })
      return
    }

    res.json({ ok: true, favorited: false })
  } catch (e) {
    console.error('favorites_check_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/favorites/check_batch', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureFavoritesTable()
    await ensureFavoritesV2Table()
    const body = (req && req.body) || {}
    const demandIds = Array.isArray(body.demandIds) ? body.demandIds : []

    const resolved = await Promise.all(
      demandIds.map(async (raw) => {
        const s = String(raw || '').trim()
        if (!s) return { raw: '', key: '', idNum: null }
        const key = await resolveFavoriteKey(s)
        const idNum = await resolveDemandIdNum(s)
        return { raw: s, key, idNum }
      }),
    )

    const keys = resolved.map((x) => x.key).filter(Boolean)
    const nums = resolved.map((x) => x.idNum).filter(Boolean)
    const favorited = new Set()

    if (keys.length) {
      const r2 = await pool.query(
        'SELECT demand_key FROM sap_demand_favorites_v2 WHERE user_id = $1 AND demand_key = ANY($2::text[])',
        [String(auth.uid || ''), keys],
      )
      ;(r2.rows || []).forEach((x) => favorited.add(String(x.demand_key)))
    }
    if (nums.length) {
      const r = await pool.query(
        'SELECT demand_id FROM sap_demand_favorites WHERE user_id = $1 AND demand_id = ANY($2::bigint[])',
        [String(auth.uid || ''), nums],
      )
      ;(r.rows || []).forEach((x) => favorited.add(`ud_${String(x.demand_id)}`))
    }

    const favoritedRaw = resolved
      .filter((x) => x.raw && (favorited.has(x.key) || (x.idNum && favorited.has(`ud_${String(x.idNum)}`))))
      .map((x) => x.raw)
    res.json({ ok: true, favorites: favoritedRaw })
  } catch (e) {
    console.error('favorites_check_batch_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/favorites/list', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureFavoritesTable()
    await ensureFavoritesV2Table()
    const uid = String(auth.uid || '').trim()
    const limitRaw = req.query && req.query.limit
    const limit = Math.max(1, Math.min(500, Number(limitRaw || 200)))

    const out = []

    // V2 favorites (preferred): keyed by unique demand id.
    const r2 = await pool.query(
      `SELECT f.user_id, f.demand_key, f.created_at, u.raw_text
       FROM sap_demand_favorites_v2 f
       LEFT JOIN sap_unique_demands u ON u.doc_id = f.demand_key
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [uid, limit],
    )
    ;(r2.rows || []).forEach((x) => {
      const key = String(x.demand_key || '').trim()
      out.push({
        _id: `${uid}_${key}`,
        user_id: uid,
        demand_id: key,
        unique_demand_id: key,
        demand_text: String(x.raw_text || ''),
        createdAt: x.created_at,
      })
    })

    // Old favorites: best-effort migrate / enrich.
    const r = await pool.query(
      `SELECT f.user_id, f.demand_id, f.created_at, d.unique_demand_id AS unique_id, u.raw_text
       FROM sap_demand_favorites f
       LEFT JOIN sap_demands d ON d.id = f.demand_id
       LEFT JOIN sap_unique_demands u ON u.doc_id = d.unique_demand_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC
       LIMIT $2`,
      [uid, limit],
    )
    for (const x of r.rows || []) {
      const num = String(x.demand_id || '').trim()
      const uid2 = String(x.unique_id || '').trim()
      const key = uid2 || `ud_${num}`
      const exists = out.find((it) => it.unique_demand_id === key)
      if (!exists) {
        out.push({
          _id: `${uid}_${key}`,
          user_id: uid,
          demand_id: key,
          unique_demand_id: key,
          demand_text: String(x.raw_text || ''),
          createdAt: x.created_at,
        })
      }
      if (uid2) {
        try {
          await pool.query(
            'INSERT INTO sap_demand_favorites_v2 (user_id, demand_key, created_at) VALUES ($1, $2, $3) ON CONFLICT (user_id, demand_key) DO NOTHING',
            [uid, uid2, x.created_at],
          )
        } catch (e) {
          console.error('favorites_v2_migrate_failed', e)
        }
      }
    }

    // Sort again and cap.
    out.sort((a, b) => {
      const at = new Date(a.createdAt || 0).getTime()
      const bt = new Date(b.createdAt || 0).getTime()
      return bt - at
    })

    res.json({ ok: true, favorites: out.slice(0, limit) })
  } catch (e) {
    console.error('favorites_list_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demand_status/mark', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireWriteAuth(req, res)
  if (!auth) return
  try {
    await ensureDemandStatusTable()
    const body = (req && req.body) || {}
    const demandId = String(body.demandId || body.demand_id || '').trim()
    const status = String(body.status || '').trim()
    const nickname = String(body.nickname || '').trim()
    const idNum = await resolveDemandIdNum(demandId)
    const allowed = new Set(['applied', 'interviewed', 'onboarded', 'closed'])
    if (!demandId || !idNum) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }
    if (!allowed.has(status)) {
      res.status(400).json({ ok: false, error: 'INVALID_STATUS' })
      return
    }
    await pool.query(
      'INSERT INTO sap_demand_status (user_id, demand_id, status, nickname) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, demand_id, status) DO NOTHING',
      [String(auth.uid || ''), idNum, status, nickname || null],
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('demand_status_mark_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demand_status/unmark', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireWriteAuth(req, res)
  if (!auth) return
  try {
    await ensureDemandStatusTable()
    const body = (req && req.body) || {}
    const demandId = String(body.demandId || body.demand_id || '').trim()
    const status = String(body.status || '').trim()
    const userId = String(body.userId || body.user_id || auth.uid || '').trim()
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !idNum) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }
    if (!status || !userId) {
      res.status(400).json({ ok: false, error: 'INVALID_PARAMS' })
      return
    }
    if (userId !== String(auth.uid || '')) {
      res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      return
    }
    await pool.query('DELETE FROM sap_demand_status WHERE user_id = $1 AND demand_id = $2 AND status = $3', [
      userId,
      idNum,
      status,
    ])
    res.json({ ok: true })
  } catch (e) {
    console.error('demand_status_unmark_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/demand_status/counts', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    await ensureDemandStatusTable()
    const demandId = String((req.query && (req.query.demandId || req.query.demand_id)) || '').trim()
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !idNum) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }
    const r = await pool.query(
      'SELECT status, COUNT(*)::int AS cnt FROM sap_demand_status WHERE demand_id = $1 GROUP BY status',
      [idNum],
    )
    const out = { applied: 0, interviewed: 0, onboarded: 0, closed: 0 }
    for (const row of r.rows || []) {
      const s = String(row.status || '').trim()
      if (!s) continue
      out[s] = Number(row.cnt || 0)
    }
    res.json({ ok: true, counts: out })
  } catch (e) {
    console.error('demand_status_counts_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/demand_status/user', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureDemandStatusTable()
    const demandId = String((req.query && (req.query.demandId || req.query.demand_id)) || '').trim()
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !idNum) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }
    const userId = String((req.query && (req.query.userId || req.query.user_id)) || auth.uid || '').trim()
    if (userId !== String(auth.uid || '')) {
      res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      return
    }
    const r = await pool.query('SELECT status FROM sap_demand_status WHERE user_id = $1 AND demand_id = $2', [
      userId,
      idNum,
    ])
    res.json({ ok: true, statuses: (r.rows || []).map((x) => String(x.status || '')) })
  } catch (e) {
    console.error('demand_status_user_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demand_status/user_bulk', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureDemandStatusTable()
    const body = (req && req.body) || {}
    const demandIds = Array.isArray(body.demandIds) ? body.demandIds : []
    const userId = String(body.userId || body.user_id || auth.uid || '').trim()
    if (userId !== String(auth.uid || '')) {
      res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      return
    }

    const { mapping, nums } = await resolveDemandIdNums(demandIds)
    if (!mapping.size) {
      res.json({ ok: true, statuses: {} })
      return
    }

    const byNum = new Map()
    if (nums.length) {
      const r = await pool.query(
        'SELECT demand_id, status FROM sap_demand_status WHERE user_id = $1 AND demand_id = ANY($2::bigint[])',
        [userId, nums],
      )
      for (const row of r.rows || []) {
        const idNum = Number(row.demand_id)
        if (!Number.isFinite(idNum) || idNum <= 0) continue
        const s = String(row.status || '').trim()
        if (!s) continue
        if (!byNum.has(idNum)) byNum.set(idNum, [])
        byNum.get(idNum).push(s)
      }
    }

    const out = {}
    for (const [raw, idNum] of mapping.entries()) {
      if (idNum) out[raw] = byNum.get(idNum) || []
      else out[raw] = []
    }
    res.json({ ok: true, statuses: out })
  } catch (e) {
    console.error('demand_status_user_bulk_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/demand_status/latest_nicknames', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    await ensureDemandStatusTable()
    const demandId = String((req.query && (req.query.demandId || req.query.demand_id)) || '').trim()
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !idNum) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }
    const rawStatuses = String((req.query && req.query.statuses) || '').trim()
    const statuses = rawStatuses
      .split(',')
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 5)
    if (!statuses.length) {
      res.json({ ok: true, nicknames: {} })
      return
    }
    const r = await pool.query(
      'SELECT status, nickname FROM sap_demand_status WHERE demand_id = $1 AND status = ANY($2::text[]) ORDER BY created_at DESC',
      [idNum, statuses],
    )
    const out = {}
    for (const row of r.rows || []) {
      const s = String(row.status || '')
      if (!s || out[s]) continue
      const n = String(row.nickname || '').trim()
      if (n) out[s] = n
    }
    res.json({ ok: true, nicknames: out })
  } catch (e) {
    console.error('demand_status_latest_nicknames_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demand_reliability/mark', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireWriteAuth(req, res)
  if (!auth) return
  try {
    await ensureDemandReliabilityTable()
    const body = (req && req.body) || {}
    const demandId = String(body.demandId || body.demand_id || '').trim()
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !idNum) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }
    const reliable = typeof body.reliable === 'boolean' ? body.reliable : null
    const nickname = String(body.nickname || '').trim()
    if (reliable === null) {
      res.status(400).json({ ok: false, error: 'RELIABLE_REQUIRED' })
      return
    }
    await pool.query(
      'INSERT INTO sap_demand_reliability (user_id, demand_id, reliable, nickname) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id, demand_id) DO UPDATE SET reliable = EXCLUDED.reliable, nickname = EXCLUDED.nickname, created_at = now()',
      [String(auth.uid || ''), idNum, reliable, nickname || null],
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('demand_reliability_mark_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demand_reliability/unmark', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireWriteAuth(req, res)
  if (!auth) return
  try {
    await ensureDemandReliabilityTable()
    const body = (req && req.body) || {}
    const demandId = String(body.demandId || body.demand_id || '').trim()
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !idNum) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }
    const userId = String(body.userId || body.user_id || auth.uid || '').trim()
    if (!userId) {
      res.status(400).json({ ok: false, error: 'INVALID_PARAMS' })
      return
    }
    if (userId !== String(auth.uid || '')) {
      res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      return
    }
    await pool.query('DELETE FROM sap_demand_reliability WHERE user_id = $1 AND demand_id = $2', [userId, idNum])
    res.json({ ok: true })
  } catch (e) {
    console.error('demand_reliability_unmark_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/demand_reliability/counts', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    await ensureDemandReliabilityTable()
    const demandId = String((req.query && (req.query.demandId || req.query.demand_id)) || '').trim()
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !idNum) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }
    const r = await pool.query(
      'SELECT reliable, COUNT(*)::int AS cnt FROM sap_demand_reliability WHERE demand_id = $1 GROUP BY reliable',
      [idNum],
    )
    const out = { reliable: 0, unreliable: 0 }
    for (const row of r.rows || []) {
      if (row.reliable === true) out.reliable = Number(row.cnt || 0)
      else if (row.reliable === false) out.unreliable = Number(row.cnt || 0)
    }
    res.json({ ok: true, counts: out })
  } catch (e) {
    console.error('demand_reliability_counts_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demand_reliability/counts_bulk', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    await ensureDemandReliabilityTable()
    const body = (req && req.body) || {}
    const demandIds = Array.isArray(body.demandIds) ? body.demandIds : []

    const { mapping, nums } = await resolveDemandIdNums(demandIds)
    if (!mapping.size) {
      res.json({ ok: true, counts: {} })
      return
    }

    const baseCountsByNum = new Map()
    if (nums.length) {
      const r = await pool.query(
        'SELECT demand_id, reliable, COUNT(*)::int AS cnt FROM sap_demand_reliability WHERE demand_id = ANY($1::bigint[]) GROUP BY demand_id, reliable',
        [nums],
      )
      for (const row of r.rows || []) {
        const idNum = Number(row.demand_id)
        if (!Number.isFinite(idNum) || idNum <= 0) continue
        if (!baseCountsByNum.has(idNum)) baseCountsByNum.set(idNum, { reliable: 0, unreliable: 0 })
        const bucket = baseCountsByNum.get(idNum)
        if (row.reliable === true) bucket.reliable = Number(row.cnt || 0)
        else if (row.reliable === false) bucket.unreliable = Number(row.cnt || 0)
      }
    }

    const out = {}
    for (const [raw, idNum] of mapping.entries()) {
      if (idNum) out[raw] = baseCountsByNum.get(idNum) || { reliable: 0, unreliable: 0 }
      else out[raw] = { reliable: 0, unreliable: 0 }
    }
    res.json({ ok: true, counts: out })
  } catch (e) {
    console.error('demand_reliability_counts_bulk_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/demand_reliability/user', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureDemandReliabilityTable()
    const demandId = String((req.query && (req.query.demandId || req.query.demand_id)) || '').trim()
    const userId = String((req.query && (req.query.userId || req.query.user_id)) || auth.uid || '').trim()
    const idNum = await resolveDemandIdNum(demandId)
    if (!demandId || !idNum) {
      res.status(400).json({ ok: false, error: 'DEMAND_ID_REQUIRED' })
      return
    }
    if (userId !== String(auth.uid || '')) {
      res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      return
    }
    const r = await pool.query('SELECT reliable FROM sap_demand_reliability WHERE user_id = $1 AND demand_id = $2 LIMIT 1', [
      userId,
      idNum,
    ])
    const row = r && r.rows && r.rows[0]
    res.json({ ok: true, reliable: row ? row.reliable : null })
  } catch (e) {
    console.error('demand_reliability_user_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demand_reliability/user_bulk', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureDemandReliabilityTable()
    const body = (req && req.body) || {}
    const demandIds = Array.isArray(body.demandIds) ? body.demandIds : []
    const userId = String(body.userId || body.user_id || auth.uid || '').trim()
    if (userId !== String(auth.uid || '')) {
      res.status(403).json({ ok: false, error: 'FORBIDDEN' })
      return
    }

    const { mapping, nums } = await resolveDemandIdNums(demandIds)
    if (!mapping.size) {
      res.json({ ok: true, reliability: {} })
      return
    }

    const byNum = new Map()
    if (nums.length) {
      const r = await pool.query(
        'SELECT demand_id, reliable FROM sap_demand_reliability WHERE user_id = $1 AND demand_id = ANY($2::bigint[])',
        [userId, nums],
      )
      for (const row of r.rows || []) {
        const idNum = Number(row.demand_id)
        if (!Number.isFinite(idNum) || idNum <= 0) continue
        byNum.set(idNum, row.reliable === true ? true : row.reliable === false ? false : null)
      }
    }

    const out = {}
    for (const [raw, idNum] of mapping.entries()) {
      if (idNum) out[raw] = byNum.has(idNum) ? byNum.get(idNum) : null
      else out[raw] = null
    }
    res.json({ ok: true, reliability: out })
  } catch (e) {
    console.error('demand_reliability_user_bulk_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/messages/send', async (req, res) => {
  const auth = requireWriteAuth(req, res)
  if (!auth) return
  try {
    await ensureMessagesTable()
    const body = (req && req.body) || {}
    const toUserId = String(body.toUserId || body.to_user_id || '').trim()
    const content = sanitizeText(body.content, 1000)
    const demandId = String(body.demandId || body.demand_id || '').trim()
    if (!toUserId || !content) {
      res.status(400).json({ ok: false, error: 'INVALID_PARAMS' })
      return
    }
    await pool.query(
      'INSERT INTO messages (from_user_id, to_user_id, content, demand_id, is_read) VALUES ($1, $2, $3, $4, false)',
      [String(auth.uid || ''), toUserId, content, demandId || null],
    )
    res.json({ ok: true })
  } catch (e) {
    console.error('messages_send_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/messages/unread_count', async (req, res) => {
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureMessagesTable()
    const r = await pool.query('SELECT COUNT(*)::int AS cnt FROM messages WHERE to_user_id = $1 AND is_read = false', [
      String(auth.uid || ''),
    ])
    const cnt = r && r.rows && r.rows[0] ? Number(r.rows[0].cnt || 0) : 0
    res.json({ ok: true, count: cnt })
  } catch (e) {
    console.error('messages_unread_count_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/messages/with', async (req, res) => {
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureMessagesTable()
    const otherUserId = String((req.query && (req.query.otherUserId || req.query.other_user_id)) || '').trim()
    if (!otherUserId) {
      res.status(400).json({ ok: false, error: 'OTHER_USER_ID_REQUIRED' })
      return
    }
    const r = await pool.query(
      `SELECT * FROM messages
       WHERE (from_user_id = $1 AND to_user_id = $2) OR (from_user_id = $2 AND to_user_id = $1)
       ORDER BY created_at ASC
       LIMIT 1000`,
      [String(auth.uid || ''), otherUserId],
    )
    await pool.query('UPDATE messages SET is_read = true WHERE to_user_id = $1 AND from_user_id = $2 AND is_read = false', [
      String(auth.uid || ''),
      otherUserId,
    ])
    res.json({ ok: true, messages: (r.rows || []).map((m) => ({
      _id: String(m.id),
      from_user_id: m.from_user_id,
      to_user_id: m.to_user_id,
      content: m.content,
      demand_id: m.demand_id || '',
      is_read: !!m.is_read,
      createdAt: m.created_at,
    })) })
  } catch (e) {
    console.error('messages_with_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/messages/conversations', async (req, res) => {
  const auth = requireUid(req, res)
  if (!auth) return
  try {
    await ensureMessagesTable()
    const uid = String(auth.uid || '')
    const r = await pool.query(
      `SELECT
         t.other_user_id,
         t.id,
         t.from_user_id,
         t.to_user_id,
         t.content,
         t.demand_id,
         t.is_read,
         t.created_at
       FROM (
         SELECT DISTINCT ON (other_user_id)
           other_user_id,
           id,
           from_user_id,
           to_user_id,
           content,
           demand_id,
           is_read,
           created_at
         FROM (
           SELECT
             CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END AS other_user_id,
             *
           FROM messages
           WHERE from_user_id = $1 OR to_user_id = $1
         ) m
         ORDER BY other_user_id, created_at DESC
       ) t
       ORDER BY t.created_at DESC
       LIMIT 200`,
      [uid],
    )
    const rows = r.rows || []
    const others = rows.map((x) => String(x.other_user_id || '').trim()).filter(Boolean)
    const unread = await pool.query(
      `SELECT from_user_id AS other_user_id, COUNT(*)::int AS cnt
       FROM messages
       WHERE to_user_id = $1 AND is_read = false
       GROUP BY from_user_id`,
      [uid],
    )
    const unreadMap = new Map()
    for (const row of unread.rows || []) {
      const k = String(row.other_user_id || '').trim()
      unreadMap.set(k, Number(row.cnt || 0))
    }
    res.json({
      ok: true,
      conversations: others.map((other) => {
        const last = rows.find((x) => String(x.other_user_id || '').trim() === other)
        const lastMessage = last
          ? {
              _id: String(last.id),
              from_user_id: last.from_user_id,
              to_user_id: last.to_user_id,
              content: last.content,
              demand_id: last.demand_id || '',
              is_read: !!last.is_read,
              createdAt: last.created_at,
            }
          : null
        return { other_user_id: other, unread_count: unreadMap.get(other) || 0, last_message: lastMessage }
      }),
    })
  } catch (e) {
    console.error('messages_conversations_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/comment_replies', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    await ensureCommentRepliesTable()
    const commentId = String((req.query && (req.query.commentId || req.query.comment_id)) || '').trim()
    if (!commentId) {
      res.status(400).json({ ok: false, error: 'COMMENT_ID_REQUIRED' })
      return
    }
    const r = await pool.query('SELECT * FROM sap_comment_replies WHERE comment_id = $1 ORDER BY created_at ASC LIMIT 500', [commentId])
    res.json({
      ok: true,
      replies: (r.rows || []).map((x) => ({
        _id: String(x.id),
        comment_id: x.comment_id,
        demand_id: x.demand_id,
        content: x.content,
        nickname: x.nickname || '',
        user_id: x.user_id || '',
        createdAt: x.created_at,
      })),
    })
  } catch (e) {
    console.error('comment_replies_list_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/demand_comments', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    await ensureUgcTables()
    const rawIds = String((req.query && (req.query.demandIds || req.query.demand_ids)) || '').trim()
    const ids = rawIds
      .split(',')
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .slice(0, 300)

    if (!ids.length) {
      res.status(400).json({ ok: false, error: 'DEMAND_IDS_REQUIRED' })
      return
    }

    const limitRaw = req.query && req.query.limit
    const limit = Math.max(1, Math.min(500, Number(limitRaw || 200)))

    const r = await pool.query(
      'SELECT * FROM sap_demand_comments WHERE demand_id = ANY($1::text[]) ORDER BY likes DESC, created_at DESC LIMIT $2',
      [ids, limit],
    )

    res.json({
      ok: true,
      comments: (r.rows || []).map((x) => ({
        _id: String(x.id),
        demand_id: x.demand_id,
        content: x.content,
        likes: Number(x.likes || 0),
        dislikes: Number(x.dislikes || 0),
        nickname: x.nickname || '',
        user_id: x.user_id || '',
        createdAt: x.created_at,
      })),
    })
  } catch (e) {
    console.error('demand_comments_list_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/demand_comments', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    await ensureUgcTables()

    const body = (req && req.body) || {}
    const demandIds = body.demandIds || body.demand_ids || body.ids

    let ids = []
    if (Array.isArray(demandIds)) {
      ids = demandIds.map((x) => String(x || '').trim()).filter(Boolean)
    } else {
      const rawIds = String(demandIds || '').trim()
      ids = rawIds
        .split(',')
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    }

    ids = ids.slice(0, 300)
    if (!ids.length) {
      res.status(400).json({ ok: false, error: 'DEMAND_IDS_REQUIRED' })
      return
    }

    const limit = Math.max(1, Math.min(500, Number(body.limit || 200)))
    const r = await pool.query(
      'SELECT * FROM sap_demand_comments WHERE demand_id = ANY($1::text[]) ORDER BY likes DESC, created_at DESC LIMIT $2',
      [ids, limit],
    )

    res.json({
      ok: true,
      comments: (r.rows || []).map((x) => ({
        _id: String(x.id),
        demand_id: x.demand_id,
        content: x.content,
        likes: Number(x.likes || 0),
        dislikes: Number(x.dislikes || 0),
        nickname: x.nickname || '',
        user_id: x.user_id || '',
        createdAt: x.created_at,
      })),
    })
  } catch (e) {
    console.error('demand_comments_post_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.post('/ugc', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  try {
    const auth = requireWriteAuth(req, res)
    if (!auth) return

    await ensureUgcTables()

    const body = (req && req.body) || {}
    const action = String(body.action || '').trim()
    const uid = String(auth.uid || '').trim()

    const COMMENT_POINTS = 1
    const COMMENT_LIKED_POINTS = 1

    if (action === 'comment_add') {
      const demandId = String(body.demandId || body.demand_id || '').trim()
      const content = sanitizeText(body.content, 200)
      if (!demandId || !content) {
        res.status(400).json({ success: false, error: 'INVALID_PARAMS' })
        return
      }
      if (containsForbiddenContent(content)) {
        res.json({ success: false, error: 'FORBIDDEN_CONTENT' })
        return
      }
      await enforceInterval(uid, 'comment_add', 15 * 1000)
      const nickname = await getNicknameFromProfiles(uid)
      const r = await pool.query(
        'INSERT INTO sap_demand_comments (demand_id, content, nickname, user_id, likes, dislikes) VALUES ($1, $2, $3, $4, 0, 0) RETURNING *',
        [demandId, content, nickname, uid],
      )
      await addPointsToUser(uid, COMMENT_POINTS)
      res.json({ success: true, result: { id: String(r.rows[0].id) } })
      return
    }

    if (action === 'reply_add') {
      const demandId = String(body.demandId || body.demand_id || '').trim()
      const commentId = String(body.commentId || body.comment_id || '').trim()
      const content = sanitizeText(body.content, 200)
      if (!demandId || !commentId || !content) {
        res.status(400).json({ success: false, error: 'INVALID_PARAMS' })
        return
      }
      if (containsForbiddenContent(content)) {
        res.json({ success: false, error: 'FORBIDDEN_CONTENT' })
        return
      }
      await enforceInterval(uid, 'reply_add', 8 * 1000)
      const nickname = await getNicknameFromProfiles(uid)
      await ensureCommentRepliesTable()
      const r = await pool.query(
        'INSERT INTO sap_comment_replies (comment_id, demand_id, content, nickname, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [commentId, demandId, content, nickname, uid],
      )
      res.json({ success: true, result: { id: String(r.rows[0].id) } })
      return
    }

    if (action === 'reaction_toggle') {
      const demandId = String(body.demandId || body.demand_id || '').trim()
      const commentId = String(body.commentId || body.comment_id || '').trim()
      const reaction = String(body.reaction || '').trim()
      if (!demandId || !commentId) {
        res.status(400).json({ success: false, error: 'INVALID_PARAMS' })
        return
      }
      if (reaction !== 'like' && reaction !== 'dislike') {
        res.status(400).json({ success: false, error: 'INVALID_PARAMS' })
        return
      }
      await enforceInterval(uid, 'reaction_toggle', 1500)
      const cid = Number(commentId)
      if (!Number.isFinite(cid) || cid <= 0) {
        res.status(400).json({ success: false, error: 'INVALID_PARAMS' })
        return
      }
      const commentRes = await pool.query('SELECT * FROM sap_demand_comments WHERE id = $1 LIMIT 1', [Math.trunc(cid)])
      const comment = commentRes && commentRes.rows && commentRes.rows[0]
      if (!comment) {
        res.json({ success: false, error: 'NOT_FOUND' })
        return
      }

      const uniqueKey = `${cid}_${uid}`
      const existingRes = await pool.query('SELECT * FROM sap_comment_reactions WHERE unique_key = $1 LIMIT 1', [uniqueKey])
      const existing = existingRes && existingRes.rows && existingRes.rows[0]
      const existingReaction = existing && existing.reaction ? String(existing.reaction) : ''

      let likes = Number(comment.likes || 0)
      let dislikes = Number(comment.dislikes || 0)

      if (!existingReaction) {
        if (reaction === 'like') likes += 1
        else dislikes += 1
        await pool.query(
          'INSERT INTO sap_comment_reactions (unique_key, comment_id, demand_id, user_id, reaction) VALUES ($1, $2, $3, $4, $5)',
          [uniqueKey, Math.trunc(cid), demandId, uid, reaction],
        )
      } else if (existingReaction === reaction) {
        if (reaction === 'like') likes = Math.max(0, likes - 1)
        else dislikes = Math.max(0, dislikes - 1)
        await pool.query('DELETE FROM sap_comment_reactions WHERE unique_key = $1', [uniqueKey])
      } else {
        if (reaction === 'like') {
          likes += 1
          dislikes = Math.max(0, dislikes - 1)
        } else {
          likes = Math.max(0, likes - 1)
          dislikes += 1
        }
        await pool.query('UPDATE sap_comment_reactions SET reaction = $1, updated_at = now() WHERE unique_key = $2', [reaction, uniqueKey])
      }

      await pool.query('UPDATE sap_demand_comments SET likes = $1, dislikes = $2, updated_at = now() WHERE id = $3', [likes, dislikes, Math.trunc(cid)])

      const shouldReward = reaction === 'like' && (!existingReaction || existingReaction === 'dislike')
      if (shouldReward && comment.user_id && String(comment.user_id).trim() !== uid) {
        await addPointsToUser(comment.user_id, COMMENT_LIKED_POINTS)
      }

      res.json({ success: true, likes, dislikes, comment_user_id: comment.user_id || null, should_reward: shouldReward })
      return
    }

    res.json({ success: false, error: 'UNKNOWN_ACTION' })
  } catch (e) {
    const msg = String(e && e.message ? e.message : 'UNKNOWN_ERROR')
    if (msg === 'TOO_FREQUENT') {
      res.json({ success: false, error: 'TOO_FREQUENT' })
      return
    }
    console.error('ugc_failed', e)
    res.status(500).json({ success: false, error: msg })
  }
})

app.post('/contact_unlock', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }
  const auth = requireWriteAuth(req, res)
  if (!auth) return

  const VIEW_CONTACT_THRESHOLD = 30
  const DAILY_LIMIT = 20

  try {
    await ensureContactUnlockTables()

    const body = (req && req.body) || {}
    const action = String(body.action || '').trim()
    if (action !== 'unlock') {
      res.json({ success: false, error: 'UNKNOWN_ACTION' })
      return
    }

    const uid = String(auth.uid || '').trim()
    const demandId = String(body.demand_id || body.demandId || '').trim()
    const targetProvider = String(body.target_provider_user_id || body.targetProviderUserId || '').trim()
    const targetRawId = String(body.target_raw_id || body.targetRawId || '').trim()
    if (!demandId || !targetProvider) {
      res.json({ success: false, error: 'INVALID_PARAMS' })
      return
    }

    const profile = await getOrCreateProfile(uid, '')
    const points = Number(profile && profile.points ? profile.points : 0)
    if (points < VIEW_CONTACT_THRESHOLD) {
      res.json({ success: false, error: 'INSUFFICIENT_POINTS', points, threshold: VIEW_CONTACT_THRESHOLD })
      return
    }

    const now = Date.now()
    const day = (() => {
      const d = new Date(now)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const da = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${da}`
    })()

    const logKey = `unlock_${day}_${uid}_${demandId}_${targetProvider}`
    const dailyKey = `daily_${day}_${uid}`

    let dailyCount = 0
    try {
      const r = await pool.query('SELECT count FROM sap_contact_unlock_limits WHERE uid = $1 AND day = $2 LIMIT 1', [uid, day])
      const row = r && r.rows && r.rows[0]
      dailyCount = row ? Number(row.count || 0) : 0
    } catch {
      dailyCount = 0
    }

    if (dailyCount >= DAILY_LIMIT) {
      res.json({ success: false, error: 'DAILY_LIMIT', limit: DAILY_LIMIT, count: dailyCount })
      return
    }

    try {
      const existed = await pool.query('SELECT 1 AS ok FROM sap_contact_unlock_logs WHERE id = $1 LIMIT 1', [logKey])
      if (existed && existed.rows && existed.rows[0]) {
        res.json({ success: true, already: true, key: logKey })
        return
      }
    } catch {
      // ignore
    }

    await pool.query(
      'INSERT INTO sap_contact_unlock_logs (id, uid, demand_id, target_provider_user_id, target_raw_id, day) VALUES ($1, $2, $3, $4, $5, $6)',
      [logKey, uid, demandId, targetProvider, targetRawId || null, day],
    )

    await pool.query(
      `INSERT INTO sap_contact_unlock_limits (id, uid, day, count)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (uid, day)
       DO UPDATE SET count = EXCLUDED.count, updated_at = now()`,
      [dailyKey, uid, day, dailyCount + 1],
    )

    res.json({ success: true, key: logKey, count: dailyCount + 1, limit: DAILY_LIMIT })
  } catch (e) {
    console.error('contact_unlock_failed', e)
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR' })
  }
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
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
})

app.get('/demands/:id(\d+)', async (req, res) => {
  if (!demandsFeatureEnabled()) {
    demandsGone(res)
    return
  }

  // ... (rest of the code remains the same)
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

  try {
    await ensureDemandsTable()
    const limitRaw = req.query && req.query.limit
    const limit = Math.max(1, Math.min(200, Number(limitRaw || 50)))
    const uid = String(auth.uid || '').trim()
    const r = await pool.query(
      'SELECT * FROM sap_demands WHERE provider_user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [uid, limit],
    )
    res.json({ ok: true, demands: (r.rows || []).map(mapDemandRow) })
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

    const lines = rawText
      .split(/\r?\n/)
      .map((x) => String(x || '').trim())
      .filter((x) => x && x.length >= 5)

    const basePayload = {
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

    await ensureDemandsTable()

    // Multi-line publish: create one demand per line
    if (lines.length > 1) {
      const created = []
      const duplicates = []
      for (const t of lines) {
        const payload = { ...basePayload, raw_text: t }
        const demandKey = normalizeDemandKey(String(payload.raw_text || ''))
        const existed = await pool.query('SELECT id FROM sap_demands WHERE demand_key = $1 LIMIT 1', [demandKey])
        if (existed && existed.rows && existed.rows[0]) {
          duplicates.push(t)
          continue
        }
        const saved = await upsertDemand(payload, 'user')
        const uniqueId = await linkOrCreateUniqueForDemandRow(saved)
        if (uniqueId && saved && !saved.unique_demand_id) saved.unique_demand_id = uniqueId
        created.push(mapDemandRow(saved))
      }

      res.json({ ok: true, demand: created[0] || null, demands: created, duplicates })
      return
    }

    // Single-line publish: keep original behavior
    const payload = { ...basePayload, raw_text: rawText }
    const demandKey = normalizeDemandKey(String(payload.raw_text || ''))
    const existed = await pool.query('SELECT id FROM sap_demands WHERE demand_key = $1 LIMIT 1', [demandKey])
    if (existed && existed.rows && existed.rows[0]) {
      res.status(409).json({ ok: false, error: 'DUPLICATE_DEMAND' })
      return
    }

    const saved = await upsertDemand(payload, 'user')
    const uniqueId = await linkOrCreateUniqueForDemandRow(saved)
    if (uniqueId && saved && !saved.unique_demand_id) saved.unique_demand_id = uniqueId
    res.json({ ok: true, demand: mapDemandRow(saved), demands: [mapDemandRow(saved)] })
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
    const cfg = await fetchAdminConfigFromPg()

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

    await ensureUniqueDemandsTable()
    const capped = Math.max(1, Math.min(200, Number(limit) || 100))
    const r = await pool.query(
      'SELECT * FROM sap_unique_demands ORDER BY last_updated_time_ts DESC NULLS LAST, updated_at_ts DESC NULLS LAST, created_time_ts DESC NULLS LAST, doc_id DESC LIMIT $1',
      [capped],
    )
    const candidates = (r && r.rows) || []
    const sinceMs = Date.now() - Math.max(1, Math.min(365, days)) * 24 * 60 * 60 * 1000

    const out = []
    for (const d of (candidates || [])) {
      const otherText = String(d && d.raw_text || '')
      if (!otherText) continue

      const ts = Number(d && (d.last_updated_time_ts ?? d.updated_at_ts ?? d.created_time_ts ?? d.message_time_ts))
      if (Number.isFinite(ts) && ts > 0 && ts < sinceMs) continue

      const textSim = calculateTextSimilarity(rawText, otherText)
      const catSim = calculateCategorySimilarity(incomingCat, getCategoryLite(d))

      const hybridSim = Math.max(catSim, textSim)
      let sim = textSim
      if (rule === 'category') sim = catSim
      if (rule === 'hybrid') sim = hybridSim

      const matched = rule === 'hybrid' ? (catSim >= threshold || textSim >= threshold) : sim >= threshold

      if (matched) {
        const provider_user_id = d && d.provider_user_id ? String(d.provider_user_id) : ''
        const provider_name = d && d.provider_name ? String(d.provider_name) : '未知'
        out.push({
          id: String((d && (d.doc_id || d._id || d.id)) || ''),
          raw_text: otherText,
          similarity: Math.round(sim * 100) / 100,
          createdAt: (d && (d.created_time || d.message_time || d.updated_at || d.last_updated_time)) || undefined,
          provider_name: provider_name || '未知',
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
