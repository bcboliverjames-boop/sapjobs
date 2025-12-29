'use strict'

const fs = require('fs')
const path = require('path')

const tcb = require('@cloudbase/node-sdk')
const { Pool } = require('pg')

function mustGetEnv(name) {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env var: ${name}`)
  return v
}

function getEnvId() {
  return process.env.CLOUDBASE_ENV_ID || process.env.VITE_ENV_ID || 'cloud1-2g93n7qgab878d25'
}

function isTruthy(v) {
  return v === true || v === 1 || v === '1' || v === 'true'
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
  fs.mkdirSync(path.dirname(p), { recursive: true })
  const tmp = `${p}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8')
  fs.renameSync(tmp, p)
}

function toIntOrNull(v) {
  if (v === null || v === undefined) return null
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return Math.trunc(n)
}

function toBoolOrNull(v) {
  if (v === null || v === undefined) return null
  if (v === true || v === false) return v
  if (v === 1 || v === '1' || v === 'true') return true
  if (v === 0 || v === '0' || v === 'false') return false
  return null
}

function toDateOrNull(v) {
  if (!v) return null
  try {
    const d = v instanceof Date ? v : new Date(v)
    if (Number.isNaN(d.getTime())) return null
    return d
  } catch {
    return null
  }
}

function normalizeStringOrNull(v) {
  if (v === null || v === undefined) return null
  const s = String(v).trim()
  return s ? s : null
}

function pickCloudUid(doc) {
  const uid = normalizeStringOrNull(doc.uid)
  if (uid) return uid
  const id = normalizeStringOrNull(doc._id)
  if (id) return id
  return null
}

function isProfileComplete(row) {
  const nickname = normalizeStringOrNull(row.nickname)
  const modules = normalizeStringOrNull(row.expertise_modules)
  const years = typeof row.years_of_exp === 'number' ? row.years_of_exp : null
  return !!(nickname && modules && years !== null)
}

async function main() {
  const cloudbaseSecretId = mustGetEnv('CLOUDBASE_SECRET_ID')
  const cloudbaseSecretKey = mustGetEnv('CLOUDBASE_SECRET_KEY')

  const envId = getEnvId()
  const collection = process.env.CLOUDBASE_USERS_COLLECTION || 'users'

  const dryRun = isTruthy(process.env.DRY_RUN)
  const batchSize = Math.max(1, Number(process.env.BATCH_SIZE || 200))

  const statePath = process.env.STATE_PATH
    ? String(process.env.STATE_PATH)
    : path.join(__dirname, 'data', 'migrate_state_cloudbase_users_to_pg.json')

  const startAfterId = normalizeStringOrNull(process.env.START_AFTER_ID)

  const state = readJsonSafe(statePath, {
    envId,
    collection,
    lastId: null,
    processed: 0,
    updated: 0,
    inserted: 0,
    lastRunAt: null,
  })

  const cloudApp = tcb.init({
    env: envId,
    secretId: cloudbaseSecretId,
    secretKey: cloudbaseSecretKey,
  })

  const cloudDb = cloudApp.database()
  const cmd = cloudDb.command
  const col = cloudDb.collection(collection)

  const pool = new Pool({
    host: process.env.PGHOST,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: false,
  })

  let cursor = startAfterId || state.lastId
  let totalProcessed = 0
  let totalUpserted = 0

  const startedAt = new Date()

  try {
    while (true) {
      let q = col.orderBy('_id', 'asc').limit(batchSize)
      if (cursor) {
        q = q.where({ _id: cmd.gt(cursor) })
      }

      const res = await q.get()
      const docs = (res && res.data) || []
      if (!docs.length) break

      for (const doc of docs) {
        const uid = pickCloudUid(doc)
        const id = normalizeStringOrNull(doc._id)
        if (!id || !uid) {
          cursor = id || cursor
          totalProcessed += 1
          continue
        }

        const nickname = normalizeStringOrNull(doc.nickname)
        const expertiseModules = normalizeStringOrNull(doc.expertise_modules)
        const avatarUrl = normalizeStringOrNull(doc.avatar_url)
        const wechatId = normalizeStringOrNull(doc.wechat_id)
        const qqId = normalizeStringOrNull(doc.qq_id)

        const years = toIntOrNull(doc.years_of_exp)
        const canShare = toBoolOrNull(doc.can_share_contact)

        let points = toIntOrNull(doc.points)
        if (points === null) points = 0
        if (points < 0) points = 0

        const createdAt = toDateOrNull(doc.createdAt) || toDateOrNull(doc.created_at)
        const updatedAt = toDateOrNull(doc.updatedAt) || toDateOrNull(doc.updated_at) || new Date()

        const profileCompletedAt = isProfileComplete({ nickname, expertise_modules: expertiseModules, years_of_exp: years })
          ? updatedAt
          : null

        if (!dryRun) {
          const sql = `
            INSERT INTO user_profiles (
              cloudbase_uid,
              nickname,
              expertise_modules,
              years_of_exp,
              avatar_url,
              wechat_id,
              qq_id,
              can_share_contact,
              points,
              profile_completed_at,
              created_at,
              updated_at
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,COALESCE($11, now()),COALESCE($12, now()))
            ON CONFLICT (cloudbase_uid) DO UPDATE SET
              nickname = EXCLUDED.nickname,
              expertise_modules = EXCLUDED.expertise_modules,
              years_of_exp = EXCLUDED.years_of_exp,
              avatar_url = EXCLUDED.avatar_url,
              wechat_id = EXCLUDED.wechat_id,
              qq_id = EXCLUDED.qq_id,
              can_share_contact = EXCLUDED.can_share_contact,
              points = EXCLUDED.points,
              profile_completed_at = COALESCE(user_profiles.profile_completed_at, EXCLUDED.profile_completed_at),
              updated_at = EXCLUDED.updated_at
          `

          await pool.query(sql, [
            uid,
            nickname,
            expertiseModules,
            years === null ? null : years,
            avatarUrl,
            wechatId,
            qqId,
            canShare === null ? false : canShare,
            points,
            profileCompletedAt,
            createdAt,
            updatedAt,
          ])

          totalUpserted += 1
        }

        cursor = id
        totalProcessed += 1

        if (totalProcessed % 200 === 0) {
          writeJsonAtomic(statePath, {
            envId,
            collection,
            lastId: cursor,
            processed: (state.processed || 0) + totalProcessed,
            updated: state.updated || 0,
            inserted: state.inserted || 0,
            lastRunAt: new Date().toISOString(),
          })
        }
      }

      writeJsonAtomic(statePath, {
        envId,
        collection,
        lastId: cursor,
        processed: (state.processed || 0) + totalProcessed,
        updated: state.updated || 0,
        inserted: state.inserted || 0,
        lastRunAt: new Date().toISOString(),
      })
    }

    const endedAt = new Date()
    const ms = endedAt.getTime() - startedAt.getTime()

    console.log(
      JSON.stringify(
        {
          ok: true,
          dryRun,
          envId,
          collection,
          statePath,
          processed: totalProcessed,
          upserted: totalUpserted,
          lastId: cursor,
          durationMs: ms,
        },
        null,
        2,
      ),
    )
  } finally {
    await pool.end().catch(() => {})
  }
}

main().catch((e) => {
  console.error('cloudbase_users_to_pg_migration_failed', e && e.stack ? e.stack : e)
  process.exitCode = 1
})
