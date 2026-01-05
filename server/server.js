const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')
const https = require('https')
const jwt = require('jsonwebtoken')
const crypto = require('crypto')

const app = express()

app.use(express.json({ limit: '1mb' }))
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-uid', 'x-nickname'],
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
  const nickname = String(req.header('x-nickname') || '').trim()
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

function getCloudbaseAuthBase() {
  const base = String(process.env.TCB_AUTH_BASE || '').trim()
  if (base) return base.replace(/\/+$/, '')

  const envId = String(process.env.TCB_ENV_ID || '').trim()
  const region = String(process.env.TCB_REGION || 'ap-shanghai').trim()
  if (!envId) return ''
  return `https://${envId}.${region}.tcb-api.tencentcloudapi.com/auth/v1`
}

function httpsJson(method, urlStr, headers, body) {
  return new Promise((resolve, reject) => {
    try {
      const u = new URL(urlStr)
      const req = https.request(
        {
          method,
          hostname: u.hostname,
          path: u.pathname + u.search,
          headers: headers || {},
        },
        (res) => {
          let data = ''
          res.on('data', (chunk) => (data += chunk))
          res.on('end', () => {
            const status = res.statusCode || 0
            try {
              const json = data ? JSON.parse(data) : {}
              resolve({ status, json })
            } catch {
              resolve({ status, json: { raw: data } })
            }
          })
        },
      )
      req.on('error', reject)
      if (body) req.write(body)
      req.end()
    } catch (e) {
      reject(e)
    }
  })
}

async function getCloudbaseUserMe(accessToken) {
  const base = getCloudbaseAuthBase()
  if (!base) return { ok: false, error: 'TCB_AUTH_BASE_NOT_CONFIGURED' }

  const r = await httpsJson('GET', `${base}/user/me`, { Authorization: `Bearer ${accessToken}` }, null)
  if (!r || r.status < 200 || r.status >= 300) {
    return { ok: false, error: 'TCB_USER_ME_FAILED', status: r && r.status, data: r && r.json }
  }

  const j = r.json || {}
  const uid = String(j.uid || (j.user && j.user.uid) || j.sub || '').trim()
  if (!uid) return { ok: false, error: 'TCB_UID_MISSING', data: j }

  return { ok: true, uid, raw: j }
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

const port = process.env.PORT ? Number(process.env.PORT) : 3001
const host = process.env.HOST || '127.0.0.1'

app.listen(port, host, () => {
  console.log(`server_listening ${host}:${port}`)
})
