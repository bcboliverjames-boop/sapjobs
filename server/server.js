const express = require('express')
const cors = require('cors')
const { Pool } = require('pg')

const app = express()

app.use(express.json({ limit: '1mb' }))
app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ['Content-Type', 'x-uid', 'x-nickname'],
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

function requireUid(req, res) {
  const { uid, nickname } = getAuth(req)
  if (!uid) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED' })
    return null
  }
  return { uid, nickname }
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
  const auth = requireUid(req, res)
  if (!auth) return

  try {
    const row = await getOrCreateProfile(auth.uid, auth.nickname)
    res.json({ ok: true, profile: mapProfileRow(row) })
  } catch (e) {
    console.error('profile_get_or_create_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

const handleGetProfile = async (req, res) => {
  const auth = requireUid(req, res)
  if (!auth) return

  try {
    const row = await getProfileByUid(auth.uid)
    res.json({ ok: true, profile: mapProfileRow(row) })
  } catch (e) {
    console.error('profile_get_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

const handleUpdateProfile = async (req, res) => {
  const auth = requireUid(req, res)
  if (!auth) return

  const patch = (req.body && req.body.patch) || {}
  const addPointsRaw = req.body && typeof req.body.addPoints !== 'undefined' ? req.body.addPoints : 0
  const addPoints = Number(addPointsRaw || 0)

  const allowed = {
    nickname: typeof patch.nickname === 'string' ? patch.nickname : undefined,
    expertise_modules: typeof patch.expertise_modules === 'string' ? patch.expertise_modules : undefined,
    years_of_exp: typeof patch.years_of_exp === 'number' ? patch.years_of_exp : undefined,
    avatar_url: typeof patch.avatar_url === 'string' ? patch.avatar_url : undefined,
    wechat_id: typeof patch.wechat_id === 'string' ? patch.wechat_id : undefined,
    qq_id: typeof patch.qq_id === 'string' ? patch.qq_id : undefined,
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

    const current = await getOrCreateProfile(auth.uid, auth.nickname)

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

    res.json({ ok: true, profile: mapProfileRow(updated.rows[0]) })
  } catch (e) {
    try {
      await pool.query('ROLLBACK')
    } catch (rollbackErr) {
      console.error('profile_update_rollback_failed', rollbackErr)
    }

    console.error('profile_update_failed', e)
    res.status(500).json({ ok: false, error: 'INTERNAL_ERROR' })
  }
}

const handleGetPoints = async (req, res) => {
  const auth = requireUid(req, res)
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

app.post('/profile/get_or_create', handleGetOrCreateProfile)
app.get('/profile', handleGetProfile)
app.post('/profile/update', handleUpdateProfile)
app.get('/points', handleGetPoints)

const port = process.env.PORT ? Number(process.env.PORT) : 3001
const host = process.env.HOST || '127.0.0.1'

app.listen(port, host, () => {
  console.log(`server_listening ${host}:${port}`)
})
