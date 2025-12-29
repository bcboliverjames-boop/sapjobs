'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const { Pool } = require('pg')

function mustGetEnv(name) {
  const val = process.env[name]
  if (!val) throw new Error(`Missing env var: ${name}`)
  return val
}

function isTruthy(v) {
  return v === true || v === 1 || v === '1' || v === 'true'
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true })
}

function readJsonSafe(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonAtomic(p, obj) {
  ensureDir(path.dirname(p))
  const tmp = `${p}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8')
  fs.renameSync(tmp, p)
}

function md5(s) {
  return crypto.createHash('md5').update(String(s), 'utf8').digest('hex')
}

function normalizeStringOrNull(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

function toIsoStringOrNull(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  if (!s) return null

  let normalized = s.includes('T') ? s : s.replace(' ', 'T')
  normalized = normalized.replace(/\.(\d{3})\d+/, '.$1')

  const d = new Date(normalized)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

async function loadSqlJs() {
  const initSqlJs = require('sql.js')
  return await initSqlJs()
}

function selectColumns(db, tableName) {
  const res = db.exec(`PRAGMA table_info(\"${tableName}\")`)
  if (!res || !res[0] || !Array.isArray(res[0].values)) return []
  return res[0].values
    .map((row) => String(row[1]))
    .filter((c) => c !== '_id')
}

function pickUpdateColumn(columns) {
  const cset = new Set(columns)
  if (cset.has('updated_at')) return 'updated_at'
  if (cset.has('last_seen_at')) return 'last_seen_at'
  if (cset.has('created_at')) return 'created_at'
  if (cset.has('first_seen_at')) return 'first_seen_at'
  return null
}

function buildRowObject(cols, row) {
  const obj = {}
  for (let i = 0; i < cols.length; i++) obj[cols[i]] = row[i]
  return obj
}

function makeDocId(rowObj) {
  const providerId = String(rowObj.provider_id || '').trim()
  if (providerId) return `prov_${providerId}`

  const wechat = String(rowObj.wechat_id || '').trim()
  const qq = String(rowObj.qq_number || '').trim()
  const sourceType = String(rowObj.source_type || '').trim()
  const sourceGroup = String(rowObj.source_group || '').trim()

  return `prov_${md5([sourceType, sourceGroup, wechat, qq].filter(Boolean).join('|') || 'unknown')}`
}

async function main() {
  const sqliteDbPath = process.env.SQLITE_DB_PATH
    ? String(process.env.SQLITE_DB_PATH)
    : path.join(__dirname, '..', 'sap-message-capture', 'database', 'local_cache.db')

  const tableName = process.env.SQLITE_TABLE || 'providers_cache'

  const dryRun = isTruthy(process.env.DRY_RUN)
  const mode = process.env.SYNC_MODE || 'full'
  const batchSize = Math.max(1, Number(process.env.BATCH_SIZE || 200))

  const statePath = process.env.STATE_PATH
    ? String(process.env.STATE_PATH)
    : path.join(__dirname, 'data', 'migrate_state_sqlite_providers_cache_to_pg_user_profiles.json')

  if (!fs.existsSync(sqliteDbPath)) throw new Error(`SQLite db not found: ${sqliteDbPath}`)

  mustGetEnv('PGHOST')
  mustGetEnv('PGPORT')
  mustGetEnv('PGUSER')
  mustGetEnv('PGPASSWORD')
  mustGetEnv('PGDATABASE')

  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: false,
  })

  const state = readJsonSafe(statePath, {
    sqliteDbPath,
    tableName,
    lastCursor: null,
    lastCursorColumn: null,
    processed: 0,
    upserted: 0,
    lastRunAt: null,
  })

  const SQL = await loadSqlJs()
  const fileBuffer = fs.readFileSync(sqliteDbPath)
  const localDb = new SQL.Database(fileBuffer)

  const cols = selectColumns(localDb, tableName)
  if (!cols.length) throw new Error(`No columns found for table: ${tableName}`)

  const cursorCol = pickUpdateColumn(cols)
  const lastCursor = mode === 'full' ? null : state.lastCursor

  let where = ''
  const params = []
  if (mode !== 'full' && cursorCol && lastCursor) {
    where = `WHERE COALESCE(${cursorCol}, '') > ?`
    params.push(String(lastCursor))
  }

  const order = cursorCol ? `COALESCE(${cursorCol}, '') ASC, provider_id ASC` : 'provider_id ASC'
  const selectSql = `SELECT ${cols.map((c) => `\"${c}\"`).join(', ')} FROM \"${tableName}\" ${where} ORDER BY ${order}`

  const stmt = localDb.prepare(selectSql)
  if (params.length) stmt.bind(params)

  let processed = 0
  let upserted = 0
  let updatedCursor = lastCursor

  const nowIso = new Date().toISOString()

  try {
    while (stmt.step()) {
      const row = stmt.get()
      const rowObj = buildRowObject(cols, row)

      if (cursorCol && rowObj[cursorCol] !== null && rowObj[cursorCol] !== undefined) {
        updatedCursor = String(rowObj[cursorCol])
      } else if (rowObj.provider_id !== null && rowObj.provider_id !== undefined) {
        updatedCursor = String(rowObj.provider_id)
      }

      const cloudbaseUid = makeDocId(rowObj)

      const contactRemark = String(rowObj.contact_remark || '').trim()
      const nicknameRaw = String(rowObj.nickname || '').trim()
      const nickname = contactRemark || nicknameRaw || '未知'

      const wechatId = normalizeStringOrNull(rowObj.wechat_id)
      const qqId = normalizeStringOrNull(rowObj.qq_number)

      const createdAt = toIsoStringOrNull(rowObj.created_at)
      const updatedAt = toIsoStringOrNull(rowObj.updated_at) || nowIso

      const canShare = true
      const points = 0

      if (!dryRun) {
        const sql = `
          INSERT INTO user_profiles (
            cloudbase_uid,
            nickname,
            wechat_id,
            qq_id,
            can_share_contact,
            points,
            created_at,
            updated_at
          )
          VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, now()),COALESCE($8, now()))
          ON CONFLICT (cloudbase_uid) DO UPDATE SET
            nickname = EXCLUDED.nickname,
            wechat_id = EXCLUDED.wechat_id,
            qq_id = EXCLUDED.qq_id,
            can_share_contact = EXCLUDED.can_share_contact,
            points = EXCLUDED.points,
            updated_at = EXCLUDED.updated_at
        `

        await pool.query(sql, [cloudbaseUid, nickname, wechatId, qqId, canShare, points, createdAt, updatedAt])
        upserted += 1
      }

      processed += 1

      if (processed % batchSize === 0) {
        writeJsonAtomic(statePath, {
          sqliteDbPath,
          tableName,
          lastCursor: updatedCursor,
          lastCursorColumn: cursorCol,
          processed: (state.processed || 0) + processed,
          upserted: (state.upserted || 0) + upserted,
          lastRunAt: nowIso,
        })
      }
    }

    writeJsonAtomic(statePath, {
      sqliteDbPath,
      tableName,
      lastCursor: updatedCursor,
      lastCursorColumn: cursorCol,
      processed: (state.processed || 0) + processed,
      upserted: (state.upserted || 0) + upserted,
      lastRunAt: nowIso,
    })

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          sqliteDbPath,
          tableName,
          statePath,
          processed,
          upserted,
          cursorCol,
          updatedCursor,
        },
        null,
        2,
      ),
    )
  } finally {
    stmt.free()
    localDb.close()
    await pool.end().catch(() => {})
  }
}

main().catch((e) => {
  console.error('sqlite_users_to_pg_migration_failed', e && e.stack ? e.stack : e)
  process.exitCode = 1
})
