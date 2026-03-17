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

## 2026-03-17

### Checks (Public prod E2E: www.sapboss.com)
- **Login (password-login)**: PASS (API `POST https://api.sapboss.com/auth/login` returned 200; token stored in `localStorage`)
  - Note: UI remained on `#/pages/login/password-login` after success; manual navigation back to demand plaza confirmed authenticated state.
- **Publish demand**: PASS
  - Published demand text contained marker: `E2E_TEST_20260317`.
  - Publish flow used “detect 2 demands -> batch publish” modal; batch publish completed and returned to plaza.
- **Plaza visibility**: PASS
  - Newly published demand was visible in `#/pages/demand/demand` list:
    - Title: `【自动化测试】远程 FI/CO 顾问`
- **Profile -> My published demands -> detail navigation**: PASS
  - Entry opened detail via `#/pages/demand/detail?uniqueId=raw_ud_c684078f951d91def8d76724b94d772d`.
- **Favorite / My favorites**: PARTIAL
  - Favorite on detail page succeeded (`POST /favorites/add` returned 200; UI shows `已收藏`, toast `收藏成功`).
  - “我的收藏” list contained the favorited demand and opened the same `uniqueId` detail successfully.
  - “我的收藏” list also displayed older entries as `需求已删除` (needs follow-up; may be stale favorites or UI mapping issue).

### Checks (Public prod E2E: full-site traversal addendum)
- **Demand plaza filters/search**: PASS
  - Clicked and exercised filters:
    - 模块（示例：`FI/CO`）
    - 地区（示例：`北京`）
    - 周期（示例：`≤3个月`）
    - 年限（示例：`4-6年`）
    - 合作方式（示例：`Free`）
    - 远程/现场（示例：`仅远程`）
    - 语言（示例：`英语`）
    - 时间范围（示例：`今日`）
  - Searchbox exercised with marker text `E2E_TEST_20260317` then cleared.
  - Note: When multiple filters/search were combined, list could reach “没有更多了”; in that state, previously captured element `uid` became invalid (expected for virtual DOM); resetting filters restored list.
  - Console: no JS errors during filter interactions.

- **Demand detail page actions (sample demand)**: PASS
  - Opened detail by `uniqueId`:
    - `#/pages/demand/detail?uniqueId=raw_ud_30c0057078320bb31bddd6595c71f957`
  - Clicked:
    - 收藏（became `已收藏`)
    - 交付状态：已投递/已面试/已到岗/已关闭（UI modal appeared; canceled to avoid state mutation)
    - 靠谱/不靠谱
    - 复制（contact field)
    - 投诉举报
    - 联系我们
  - Console: no new JS errors observed on this detail page after avoiding synthetic touch-event injection.

- **Legal: 联系我们 (/pages/legal/contact)**: PASS (with content TODO)
  - Entry from detail page: `联系我们`.
  - “复制” button works; toast `已复制` appears.
  - Observation: contact email currently displays placeholder `your@email.com` (needs production value).

- **Legal: 投诉举报 (/pages/legal/report)**: PASS
  - Page renders; key CTAs clickable:
    - `复制举报模板` triggers toast `已复制`.
    - `前往联系我们` navigates to contact page.
    - `提交举报` is clickable (form not submitted).
  - Console: DevTools issue only: `A form field element should have an id or name attribute`.

- **Legal: 隐私政策 (/pages/legal/privacy)**: FAIL
  - Page displays: `连接服务器超时，点击屏幕重试` and does not recover after retry.
  - Console error: `ReferenceError: onMounted is not defined`.

- **Legal: 用户协议 (/pages/legal/agreement)**: FAIL
  - Route loads but page renders blank (no visible text; `document.body.innerText` length observed as 0).
  - After reload (ignore cache), still blank; no explicit console error observed.
  - Network observed unexpected legal chunk previously loaded: `assets/pages-legal-privacy.*.js`.

- **Legal: 注销与删除 (/pages/legal/delete-account)**: FAIL
  - Route loads but page renders blank (no visible text; `document.body.innerText` length observed as 0).
  - After reload (ignore cache), still blank; no explicit console error observed.
  - Network did not show an obvious `pages-legal-delete-account` chunk being loaded (suspect missing route/chunk).

### Checks (Public prod E2E: profile & favorites traversal addendum)
- **Profile page (/pages/profile/profile) entry points**: PASS
  - Verified sections/entries present and navigable:
    - `我的资料`
    - `我发布的需求`
    - `我的收藏`
    - `账号注销 / 个人信息删除申请`
  - Console: DevTools issue only: `A form field element should have an id or name attribute`.

- **Profile -> My published demands -> open detail -> back**: PASS
  - Opened first item from `我发布的需求` and landed on:
    - `#/pages/demand/detail?uniqueId=raw_ud_c684078f951d91def8d76724b94d772d`
  - Back navigation returned to profile page successfully.

- **Profile -> Favorites list**: PARTIAL
  - Favorites list rendered; included entries labeled `需求已删除`.
  - Clicking a `需求已删除` entry still navigated to a detail route:
    - Example: `#/pages/demand/detail?uniqueId=raw_ud_d8416057f230b84e465b6a5b7665f060`
    - Detail showed placeholder-like content (e.g. `来源：示例数据`, `发布者未同步，暂无联系方式`).
  - Network errors observed (root cause for `需求已删除`):
    - `GET https://api.sapboss.com/unique_demands/raw_ud_d8416057f230b84e465b6a5b7665f060` -> 404
    - `GET https://api.sapboss.com/unique_demands/raw_ud_b966ece7085fdd2a186bff163c2bf7c2` -> 404
  - Console: `Failed to load resource: the server responded with a status of 404 (Not Found)`.

- **Profile -> Account delete request page (/pages/legal/account-delete)**: PASS (with content TODO)
  - Entry from profile `账号注销 / 个人信息删除申请` loads and renders.
  - Buttons exercised:
    - `复制` (email)
    - `复制申请模板`
    - `一键发邮件（H5）` (launched `mailto:` external handler)
  - Observation: email still shows placeholder `your@email.com` (needs production value).
