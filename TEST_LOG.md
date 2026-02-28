# Test Log

## 2026-01-05

### Change
- Admin config persistence fix: `sap_admin_config` read/write now prefers fixed singleton doc `_id=global` and avoids `orderBy(updatedAt)` to prevent falling back to default.

### Checks
- `npm run type-check`: PASS
- `npm run build:h5`: PASS (only Sass legacy API deprecation warnings)

### Checks (Unified ingest)
- Backend started locally (no PG env configured). `/health` returns `{ ok:false, db:false, error:'DB_UNAVAILABLE' }` (expected).
- `POST http://127.0.0.1:3002/demands/ingest` with headers `x-uid=test_uid` succeeded.
  - First call returned: `raw_id=5d261094695bb3860aafa0b9478bea44`, `unique_demand_id=ud_533eba4d4feda4b5743cddc6668101c9`.
  - Second call with same payload returned: `raw_id=def9fa84695bb3950ab3409a2d57779c`, `unique_demand_id=ud_533eba4d4feda4b5743cddc6668101c9`, `text similarity=1`.
  - After restoring CloudBase ingest handler + installing server dep `@cloudbase/node-sdk`, another call returned: `raw_id=8e2c0a2f695bb6c10abc6cac791c1d6c`, `unique_demand_id=ud_533eba4d4feda4b5743cddc6668101c9`.

### Checks (Local scripts)
- Migrated local sync scripts to call backend `POST /demands/ingest` with header `x-ingest-secret`.
- Syntax validation:
  - `node --check server/server.js`: PASS
  - `node --check sap-message-capture/tools/sync_parsed_demands_to_cloudbase.cjs`: PASS
  - `node --check sap-message-capture/tools/sync_unique_demands_to_cloudbase.cjs`: PASS

### Checks (Local scripts dry-run)
- `SYNC_DRY_RUN=1 SYNC_VERBOSE=1 SYNC_MAX_RECORDS=3`:
  - parsed-demands sync: `processed=0`, `cursorCol=updated_at`, `updatedCursor=2025-12-26 08:09:12`
  - unique-demands sync: `processed=0`, `cursorCol=last_updated_time`, `updatedCursor=2025-12-24 00:36:00.481529`

### Checks (Local scripts dry-run, full sample)
- `SYNC_MODE=full SYNC_DRY_RUN=1 SYNC_VERBOSE=1 SYNC_MAX_RECORDS=3`:
  - parsed-demands sync: `processed=3` (printed 3 ingest previews with `doc_id=raw_<message_hash>` and `raw_text` populated)
  - unique-demands sync: `processed=3` (printed 3 ingest previews with `doc_id=raw_ud_<id>` and `raw_text/last_updated_time` populated)

### Manual verification plan (requires CloudBase env + login)
- Open Admin page -> change similarity config -> Save.
- Re-enter Admin page and verify values persist.
- Verify in CloudBase console: collection `sap_admin_config` has doc `_id=global` with expected fields.

### Checks (Cloud deployment: sapboss-api)
- Deployed to Tencent Cloud server via git pull + PM2 restart.
- `GET http://127.0.0.1:3000/health`: 200 OK (`ok:true`, `db:true`).
- `GET /admin/raw_candidates` with header `x-uid=acc_0619a066b2c157bc8fd654c24a19ef5d`: 200 OK.

### Fix (Cloud: /unique_demands route shadowing)
- Root cause: Express route `/unique_demands/:id` matched `/unique_demands/count|range|all`, returning `NOT_FOUND`.
- Fix: In `/unique_demands/:id` handler, passthrough reserved words via `next()` for `count|range|all`.

### Checks (Cloud: /unique_demands endpoints)
- `GET /unique_demands/count` (without `startTs/endTs`): 400 `RANGE_REQUIRED` (expected; route now correct).
- `GET /unique_demands/range?offset=0&limit=1` (without `startTs/endTs`): 400 `RANGE_REQUIRED`.
- `GET /unique_demands/all?limit=1`: 200 OK (`ok:true`).

## 2026-01-06

### Checks (Local PostgreSQL10)
- Local PostgreSQL 10 verified listening on port `5433`.
- Synced cloud schema-only SQL from Tencent Cloud server (`/tmp/sapboss_schema.sql`) to local file `sapboss_schema.sql`.
- Imported schema into local database `sapboss` on PG10 (`5433`).

### Checks (Local backend)
- Started local backend with `PGHOST=127.0.0.1`, `PGPORT=5433`, `PGUSER=sapboss`, `PGDATABASE=sapboss`, `PORT=3001`.
- `GET http://127.0.0.1:3001/health`: 200 OK (`ok:true`, `db:true`).

### Fix (Local DB authentication)
- Issue: `/health` returned `DB_UNAVAILABLE` with PG error `28P01 password authentication failed` after switching local `pg_hba.conf` back to `md5`.
- Fix: Temporarily allowed localhost `trust` in `pg_hba.conf` to reset local role passwords, then restored `pg_hba.conf` back to `md5` and restarted `postgresql-x64-10`.
- Result: `/health` restored to 200 OK (`ok:true`, `db:true`).

## 2026-01-08

### Change
- Unified frontend SAP module enum source:
  - Added `src/utils/sap-modules.ts` as single source of truth (code/label/aliases + normalization).
  - `pages/demand/publish.vue`: module chips now rendered from `sap-modules.ts`; auto-parse module codes normalized (e.g. `FI|CO|FI/CO -> FICO`, `BI -> BW`, `HR -> HCM`).
  - `pages/demand/demand.vue`: module filters/labels and module extraction from `tags_json` now use `sap-modules.ts` normalization.
- Pipeline consistency:
  - `POST /demands/ingest`: now auto link/create unique demand (B) after upserting raw demand (A), mirroring `/demands/create`.
  - Unique demand `tags_json` derivation now includes `duration_text` and `years_text` for stable UI tags (e.g. `6个月`).

### Checks
- `npm run type-check`: PASS
- `node --check server/server.js`: PASS

### Manual verification checklist (local)
- Start local backend with PostgreSQL configured and `PORT=3001`.
- Publish a demand from `/#/pages/demand/publish`:
  - Expect response includes `unique_demand_id`.
- Open `/#/pages/demand/demand`:
  - Demand should be visible in marketplace.
  - Tags should show:
    - city (from `attributes_json.city`)
    - duration text (e.g. `6个月`)
    - module label (e.g. `FI/CO`)
  - Module filter chips should be consistent with publish page.
