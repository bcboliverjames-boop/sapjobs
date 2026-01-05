<template>
  <view class="page">
    <view class="hero">
      <view class="hero-top-actions">
        <view class="icon-btn" @click="goToAccount">
          <uni-icons type="person" size="18" color="#F5F1E8" />
        </view>
      </view>

      <view class="hero-left">
        <view class="hero-kicker">
          <uni-icons type="map" size="16" color="#14B8A6" />
          <text class="hero-kicker-text">SAP 顾问需求广场</text>
        </view>

        <view class="hero-actions">
          <button class="btn btn-primary" @click="goToDemand">进入需求广场</button>
          <button class="btn btn-ghost" :class="{ 'guest-disabled': isGuest }" @click="goToPublish">发布需求</button>
        </view>

        <view class="insights insights--hero">
          <view class="insights-head">
            <text class="insights-title">需求洞察</text>
            <text class="insights-sub">{{ insightsSubText }}</text>
          </view>

          <view class="ring-row">
            <view class="ring-slot">
              <view class="ring ring--today" @click="goToDemandWithQuery({ timeRange: 'TODAY', timeField: 'UPDATED' })">
                <text class="ring-label">今日需求</text>
                <text class="ring-value">{{ todayDemandText }}</text>
                <text class="ring-yoy" :class="todayDemandYoyClass">同比 {{ todayDemandYoyText }}</text>
              </view>
            </view>
            <view class="ring-slot">
              <view class="ring ring--today-new" @click="goToDemandWithQuery({ timeRange: 'TODAY', timeField: 'CREATED' })">
                <text class="ring-label">今日上新</text>
                <text class="ring-value">{{ todayNewArrivalsText }}</text>
                <text class="ring-yoy" :class="todayNewYoyClass">同比 {{ todayNewYoyText }}</text>
              </view>
            </view>
            <view class="ring-slot">
              <view class="ring ring--week-new" @click="goToDemandWithQuery({ timeRange: 'WEEK', timeField: 'CREATED' })">
                <text class="ring-label">本周上新</text>
                <text class="ring-value">{{ weekNewArrivalsText }}</text>
                <text class="ring-yoy" :class="weekNewYoyClass">同比 {{ weekNewYoyText }}</text>
              </view>
            </view>
          </view>

          <view class="module-chart">
            <view class="module-head">
              <text class="module-title">今日模块需求</text>
              <text class="module-meta">{{ moduleChartMetaText }}</text>
            </view>
            <view class="module-bars">
              <view class="module-bars-inner">
                <view
                  v-for="m in todayModuleBars"
                  :key="m.module"
                  class="module-col"
                  @click="goToDemandWithQuery({ timeRange: 'TODAY', timeField: 'UPDATED', module: m.module })"
                >
                  <view class="module-bar" :class="{ 'module-bar--empty': !m.count }">
                    <view class="module-bar-fill" :style="{ height: m.heightRpx + 'rpx' }" />
                    <text class="module-bar-count">{{ m.count }}</text>
                  </view>
                  <text class="module-name">{{ m.module }}</text>
                </view>
              </view>
            </view>
            <view v-if="!todayModuleBars.length" class="module-empty">
              <text class="module-empty-text">暂无数据</text>
            </view>
          </view>

          <view class="trend">
            <view class="trend-head">
              <text class="trend-title">上新趋势</text>
              <text class="trend-meta">近 30 天</text>
            </view>
            <view class="trend-bars">
              <view v-for="d in trendDays" :key="d.date" class="trend-col">
                <view class="trend-bar" :class="{ 'trend-bar--empty': !d.count }">
                  <view v-if="d.count" class="trend-bar-fill" :style="{ height: d.heightRpx + 'rpx' }" />
                  <text v-if="d.count" class="trend-bar-count">{{ d.count }}</text>
                </view>
                <text class="trend-date">{{ d.date.slice(5) }}</text>
              </view>
            </view>
            <view class="trend-foot">
              <text class="trend-foot-text">{{ trendSummaryText }}</text>
            </view>
          </view>

          <view class="panel panel--inline">
            <view class="panel-title">
              <uni-icons type="settings" size="18" color="#111827" />
              <text class="panel-title-text">实用工具</text>
            </view>

            <view class="tool" @click="openTimesheet">
              <view class="tool-left">
                <uni-icons type="wallet" size="18" color="#D97706" />
                <view class="tool-text">
                  <text class="tool-name">收入计算 & 工时导出</text>
                  <text class="tool-desc">税前收入估算、自动工作日、Excel 导出</text>
                </view>
              </view>
              <uni-icons type="right" size="18" color="#6B7280" />
            </view>

            <view class="tool tool-muted">
              <view class="tool-left">
                <uni-icons type="paperplane" size="18" color="#6B7280" />
                <view class="tool-text">
                  <text class="tool-name">更多工具</text>
                  <text class="tool-desc">后续上线：需求日报、模块画像、薪资基准</text>
                </view>
              </view>
              <text class="tool-badge">规划中</text>
            </view>
          </view>

          <view class="lists">
            <view class="list-card">
              <view class="list-head">
                <text class="list-title">今日上新需求</text>
                <text class="list-meta">{{ todayNewArrivalsText }}</text>
              </view>
              <view class="list-body">
                <view
                  v-for="item in todayNewList"
                  :key="item._id || String(item.local_id || '')"
                  class="list-item"
                  @click="handleUniqueDemand(item)"
                >
                  <text class="list-item-title">{{ clipText(item.raw_text || '', 48) }}</text>
                  <text class="list-item-sub">{{ uniqueDemandMetaText(item) }}</text>
                </view>
                <view v-if="!todayNewList.length" class="list-empty">
                  <text class="list-empty-text">暂无数据</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <view class="footer">
      <view class="footer-links">
        <text class="footer-link" @click="goToPrivacy">隐私政策</text>
        <text class="footer-dot">·</text>
        <text class="footer-link" @click="goToTerms">用户协议</text>
        <text class="footer-dot">·</text>
        <text class="footer-link" @click="goToContact">联系我们</text>
        <text class="footer-dot">·</text>
        <text class="footer-link" @click="goToReport">投诉举报</text>
      </view>
      <text class="footer-icp" @click="openIcp">ICP备案号：{{ ICP_NUMBER }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ICP_LINK, ICP_NUMBER } from '../../config/site'
import { app, ensureLogin, requireNonGuest, isGuestUser } from '../../utils/cloudbase'
import { fetchAllUniqueDemands, fetchAllUniqueDemandsByTimeRange, type SapUniqueDemandDoc } from '../../utils/sap-unique-demands'
import { getWorkingHoursWindowStart } from '../../utils/workday-window'
 

// 跳转到演示页面
const goToDemand = () => {
  uni.navigateTo({
    url: '/pages/demand/demand',
  })
}

const isGuest = ref(false)

const goToDemandWithQuery = (q: {
  timeRange?: 'ALL' | 'TODAY' | 'WEEK'
  timeField?: 'CREATED' | 'UPDATED'
  module?: string
}) => {
  const params: string[] = []
  if (q.timeRange) params.push(`timeRange=${encodeURIComponent(q.timeRange)}`)
  if (q.timeField) params.push(`timeField=${encodeURIComponent(q.timeField)}`)
  if (q.module) params.push(`module=${encodeURIComponent(String(q.module || '').trim())}`)
  const suffix = params.length ? `?${params.join('&')}` : ''
  uni.navigateTo({
    url: `/pages/demand/demand${suffix}`,
  })
}

const extractPrimaryModule = (d: SapUniqueDemandDoc): string => {
  const ms = extractModules(d)
  const m = (ms && ms.length ? ms[0] : '').trim()
  return m || '其他'
}

const parseTs = (v: any): number | null => {
  if (!v) return null
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const s = String(v).trim()
  if (!s) return null
  let normalized = s.includes('T') ? s : s.replace(' ', 'T')
  normalized = normalized.replace(/\.(\d{3})\d+/, '.$1')
  const d = new Date(normalized)
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

const goToAccount = async () => {
  try {
    const state: any = await ensureLogin()
    const user = state && state.user
    if (user && !isGuestUser(user)) {
      uni.navigateTo({
        url: '/pages/profile/profile'
      })
      return
    }
  } catch {}

  uni.navigateTo({
    url: '/pages/login/password-login'
  })
}

// 打开文档
const openTimesheet = () => {
  // #ifdef H5
  window.location.href = '/timesheet/'
  // #endif

  // #ifndef H5
  uni.setClipboardData({
    data: '/timesheet/',
    success: () => {
      uni.showToast({
        title: '工具地址已复制',
        icon: 'none'
      })
    }
  })
  // #endif
}

const goToPublish = async () => {
  try {
    await requireNonGuest()
    uni.navigateTo({
      url: '/pages/demand/publish'
    })
  } catch {
    return
  }
}

const goToPrivacy = () => {
  uni.navigateTo({
    url: '/pages/legal/privacy'
  })
}

const goToTerms = () => {
  uni.navigateTo({
    url: '/pages/legal/terms'
  })
}

const goToContact = () => {
  uni.navigateTo({
    url: '/pages/legal/contact'
  })
}

const goToReport = () => {
  uni.navigateTo({
    url: '/pages/legal/report'
  })
}

const openIcp = () => {
  // #ifdef H5
  window.open(ICP_LINK, '_blank')
  // #endif

  // #ifndef H5
  uni.setClipboardData({
    data: ICP_LINK,
    success: () => {
      uni.showToast({
        title: 'ICP备案查询地址已复制',
        icon: 'none'
      })
    }
  })
  // #endif
}

const insightsLoading = ref(false)
const insightsMode = ref<'strict' | 'demo'>('strict')
const todayDemand = ref<number | null>(null)
const todayDemandTopModule = ref<string>('')
const todayNewArrivals = ref<number | null>(null)
const todayNewArrivalsTopModule = ref<string>('')
const weekNewArrivals = ref<number | null>(null)
const weekNewArrivalsTopModule = ref<string>('')
const trendDays = ref<{ date: string; count: number; heightRpx: number }[]>([])
const trendMax = ref(0)
const todayNewList = ref<SapUniqueDemandDoc[]>([])

const fallbackText = (v: string) => (v && v.trim() ? v : '—')


const todayDemandText = computed(() => (todayDemand.value === null ? '—' : String(todayDemand.value)))
const todayNewArrivalsText = computed(() => (todayNewArrivals.value === null ? '—' : String(todayNewArrivals.value)))
const weekNewArrivalsText = computed(() => (weekNewArrivals.value === null ? '—' : String(weekNewArrivals.value)))
const trendSummaryText = computed(() => {
  if (!trendDays.value.length) return '—'
  const total = trendDays.value.reduce((s, d) => s + (d.count || 0), 0)
  const mx = trendMax.value || 0
  return `总计 ${total} · 单日峰值 ${mx}`
})

const todayDemandYoy = ref<number | null>(null)
const todayNewYoy = ref<number | null>(null)
const weekNewYoy = ref<number | null>(null)

const yoyText = (v: number | null) => {
  if (v === null) return '—'
  const sign = v > 0 ? '+' : ''
  return `${sign}${v}%`
}
const yoyClass = (v: number | null) => {
  if (v === null) return ''
  if (v > 0) return 'is-pos'
  if (v < 0) return 'is-neg'
  return 'is-zero'
}

const todayDemandYoyText = computed(() => yoyText(todayDemandYoy.value))
const todayNewYoyText = computed(() => yoyText(todayNewYoy.value))
const weekNewYoyText = computed(() => yoyText(weekNewYoy.value))
const todayDemandYoyClass = computed(() => yoyClass(todayDemandYoy.value))
const todayNewYoyClass = computed(() => yoyClass(todayNewYoy.value))
const weekNewYoyClass = computed(() => yoyClass(weekNewYoy.value))

const moduleChartMetaText = computed(() => (insightsMode.value === 'demo' ? '演示窗口：近 30 天' : '工作日 24h'))

const todayModuleBars = ref<{ module: string; count: number; heightRpx: number }[]>([])

const insightsSubText = computed(() => {
  return '今日需求不是实时数据（每晚更新）'
})

const pickTop = (counts: Map<string, number>): string => {
  let best = ''
  let bestCount = 0
  for (const [k, c] of counts.entries()) {
    if (!k) continue
    if (c > bestCount) {
      best = k
      bestCount = c
    }
  }
  return best
}


const SAP_MODULES = [
  'FI',
  'CO',
  'FICO',
  'FI/CO',
  'CO-PA',
  'TR',
  'EC',
  'IM',
  'SD',
  'MM',
  'PP',
  'QM',
  'PM',
  'WM',
  'EWM',
  'LE',
  'LO',
  'HR',
  'HCM',
  'SF',
  'SUCCESSFACTORS',
  'SAPCONCUR',
  'CONCUR',
  'SSF',
  'PS',
  'ABAP',
  'BASIS',
  'BW',
  'BI',
  'BO',
  'BPC',
  'BPC合并',
  'SAC',
  'FIORI',
  'UI5',
  'GRC',
  'GTS',
  'DRC',
  'JAVA',
]
const SAP_MODULE_SET = new Set(SAP_MODULES.map((x) => x.toUpperCase()))

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
  '宁波',
  '佛山',
  '东莞',
  '海外',
  '欧洲',
  '印尼',
  '菲律宾',
  '新加坡',
  '马来西亚',
  '泰国',
  '越南',
]
const LOCATION_SET = new Set(LOCATION_KEYWORDS)

const safeJsonArray = (v: any): string[] => {
  if (!v) return []
  try {
    const obj = typeof v === 'string' ? JSON.parse(v) : v
    if (Array.isArray(obj)) return obj.map((x) => String(x)).filter(Boolean)
    return []
  } catch {
    return []
  }
}

const extractModules = (d: SapUniqueDemandDoc): string[] => {
  const tags = safeJsonArray(d.tags_json)
  const hit: string[] = []
  tags.forEach((t) => {
    const key = String(t || '').trim()
    if (!key) return
    const up = key.toUpperCase()
    if (SAP_MODULE_SET.has(up)) {
      if (!hit.includes(key)) hit.push(key)
    }
  })
  if (hit.length) return hit

  const raw = String(d.raw_text || '')
  const m = raw.match(/[【\[]\s*([A-Za-z\/\-]{2,12})\s*[】\]]/g)
  if (m && m.length) {
    m.forEach((seg) => {
      const k = seg.replace(/[【】\[\]]/g, '').trim()
      const up = k.toUpperCase()
      if (SAP_MODULE_SET.has(up) && !hit.includes(k)) hit.push(k)
    })
  }
  return hit.length ? hit : ['其他']
}

const extractCity = (d: SapUniqueDemandDoc): string => {
  const tags = safeJsonArray(d.tags_json)
  for (const t of tags) {
    const k = String(t || '').trim()
    if (!k) continue
    if (LOCATION_SET.has(k)) return k
  }
  return ''
}

const clipText = (s: string, maxLen: number) => {
  const raw = (s || '').replace(/\s+/g, ' ').trim()
  if (!raw) return '—'
  return raw.length > maxLen ? `${raw.slice(0, maxLen)}…` : raw
}

const uniqueDemandMetaText = (d: SapUniqueDemandDoc) => {
  const modules = extractModules(d)
  const city = extractCity(d)
  const left = modules.length ? modules.slice(0, 2).join('/') : '其他'
  const right = city ? city : ''
  return right ? `${left} · ${right}` : left
}

const pickTopFromDocs = (docs: SapUniqueDemandDoc[], kind: 'module' | 'city') => {
  const counts = new Map<string, number>()
  docs.forEach((d) => {
    const keys = kind === 'module' ? extractModules(d) : [extractCity(d)]
    keys.forEach((k) => {
      const key = String(k || '').trim()
      if (!key) return
      if (kind === 'city' && key === '未指定') return
      counts.set(key, (counts.get(key) || 0) + 1)
    })
  })
  return pickTop(counts)
}

const ALL_MODULES = Array.from(
  new Set(
    SAP_MODULES.map((x) => String(x || '').trim())
      .filter(Boolean)
      .filter((x) => String(x).trim() !== '其他')
  )
).concat(['其他'])

const buildModuleBars = (docs: SapUniqueDemandDoc[]) => {
  const counts = new Map<string, number>()

  ALL_MODULES.forEach((m) => counts.set(m, 0))
  docs.forEach((d) => {
    const ms = extractModules(d)
    ms.forEach((m) => {
      const key = String(m || '').trim()
      if (!key) return
      counts.set(key, (counts.get(key) || 0) + 1)
    })
  })
  const entries = Array.from(counts.entries()).sort((a, b) => {
    const am = String(a[0] || '').trim()
    const bm = String(b[0] || '').trim()
    if (am === '其他' && bm !== '其他') return 1
    if (bm === '其他' && am !== '其他') return -1
    return b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))
  })
  const nonZero = entries.filter(([, c]) => c > 0)
  const max = nonZero.reduce((mx, [, c]) => Math.max(mx, c), 0)
  const base = 8
  const peak = 92
  return nonZero.map(([module, count]) => {
    const heightRpx = max ? Math.round(base + (count / max) * peak) : base
    return { module, count, heightRpx }
  })
}


const buildTrendDays = (counts: Map<string, number>) => {
  const days: { date: string; count: number; heightRpx: number }[] = []
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end.getTime() - 29 * 24 * 60 * 60 * 1000)

  let max = 0
  for (let i = 0; i < 30; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const key = `${y}-${m}-${dd}`
    const c = counts.get(key) || 0
    if (c > max) max = c
    days.push({ date: key, count: c, heightRpx: 0 })
  }

  const base = 12
  const peak = 86
  days.forEach((d) => {
    if (!d.count) {
      d.heightRpx = 0
      return
    }
    if (!max) {
      d.heightRpx = base
      return
    }
    const ratio = d.count / max
    d.heightRpx = Math.round(base + ratio * peak)
  })
  trendMax.value = max
  trendDays.value = days
}

const loadUniqueInsights = async () => {
  if (insightsLoading.value) return
  insightsLoading.value = true
  try {
    const state: any = await ensureLogin()
    const user = state && state.user
    const skipCloudDb = !!(state && (state as any).isLocalAuth) || !!(user && (user as any)._isLocalAuth) || !!isGuestUser(user)
    if (skipCloudDb) {
      insightsMode.value = 'demo'
      return
    }

    try {
      const db = app.database()
      const visible = await db.collection('sap_unique_demands').count()
      const total = Number((visible as any)?.total || 0)
      console.log('[unique-insights] readable sap_unique_demands count:', total)
      if (!total) {
        uni.showToast({ title: '需求唯一表暂无可读数据，请检查云端集合权限', icon: 'none' })
      }
    } catch (e: any) {
      console.error('[unique-insights] failed to count sap_unique_demands:', e)
    }

    insightsMode.value = 'strict'

    const now = new Date()
    const endTs = now.getTime()

    const workStart = await getWorkingHoursWindowStart({ now, hours: 24 })
    let startTs = workStart.getTime()

    let weekStartTs = endTs - 7 * 24 * 60 * 60 * 1000
    let monthStartTs = endTs - 30 * 24 * 60 * 60 * 1000

    let allValidDocs: SapUniqueDemandDoc[] | null = null

    let [todayDemandDocs, todayNewDocs, weekNewDocs, monthNewDocs] = await Promise.all([
      fetchAllUniqueDemandsByTimeRange({
        startTs,
        endTs,
        field: 'last_updated_time_ts',
        onlyValid: true,
        order: 'desc',
        pageSize: 100,
        max: 2000,
      }).catch(() => []),
      fetchAllUniqueDemandsByTimeRange({
        startTs,
        endTs,
        field: 'created_time_ts',
        onlyValid: true,
        order: 'desc',
        pageSize: 100,
        max: 2000,
      }).catch(() => []),
      fetchAllUniqueDemandsByTimeRange({
        startTs: weekStartTs,
        endTs,
        field: 'created_time_ts',
        onlyValid: true,
        order: 'desc',
        pageSize: 100,
        max: 2000,
      }).catch(() => []),
      fetchAllUniqueDemandsByTimeRange({
        startTs: monthStartTs,
        endTs,
        field: 'created_time_ts',
        onlyValid: true,
        order: 'desc',
        pageSize: 100,
        max: 2000,
      }).catch(() => []),
    ])

    const emptyByTs =
      todayDemandDocs.length === 0 && todayNewDocs.length === 0 && weekNewDocs.length === 0 && monthNewDocs.length === 0

    if (emptyByTs) {
      const all = await fetchAllUniqueDemands({
        onlyValid: true,
        orderBy: 'local_id',
        order: 'desc',
        pageSize: 100,
        max: 2000,
      }).catch(() => [])

      allValidDocs = all

      const inRange = (t: number | null, s: number, e2: number) => t !== null && t >= s && t < e2

      todayDemandDocs = all.filter((d) => inRange(parseTs(d.last_updated_time_ts ?? d.last_updated_time), startTs, endTs))
      todayNewDocs = all.filter((d) => inRange(parseTs(d.created_time_ts ?? d.created_time), startTs, endTs))
      weekNewDocs = all.filter((d) => inRange(parseTs(d.created_time_ts ?? d.created_time), weekStartTs, endTs))
      monthNewDocs = all.filter((d) => inRange(parseTs(d.created_time_ts ?? d.created_time), monthStartTs, endTs))
    }

    const strictAllZero = todayDemandDocs.length === 0 && todayNewDocs.length === 0 && weekNewDocs.length === 0
    if (strictAllZero) {
      insightsMode.value = 'demo'
      startTs = endTs - 30 * 24 * 60 * 60 * 1000
      weekStartTs = startTs
      monthStartTs = startTs

      ;[todayDemandDocs, todayNewDocs, weekNewDocs, monthNewDocs] = await Promise.all([
        fetchAllUniqueDemandsByTimeRange({
          startTs,
          endTs,
          field: 'last_updated_time_ts',
          onlyValid: true,
          order: 'desc',
          pageSize: 100,
          max: 2000,
        }).catch(() => []),
        fetchAllUniqueDemandsByTimeRange({
          startTs,
          endTs,
          field: 'created_time_ts',
          onlyValid: true,
          order: 'desc',
          pageSize: 100,
          max: 2000,
        }).catch(() => []),
        fetchAllUniqueDemandsByTimeRange({
          startTs: weekStartTs,
          endTs,
          field: 'created_time_ts',
          onlyValid: true,
          order: 'desc',
          pageSize: 100,
          max: 2000,
        }).catch(() => []),
        fetchAllUniqueDemandsByTimeRange({
          startTs: monthStartTs,
          endTs,
          field: 'created_time_ts',
          onlyValid: true,
          order: 'desc',
          pageSize: 100,
          max: 2000,
        }).catch(() => []),
      ])
    }

    const periodMs = Math.max(1, endTs - startTs)
    const prevEndTs = startTs
    const prevStartTs = prevEndTs - periodMs
    const prevWeekEndTs = weekStartTs
    const prevWeekStartTs = prevWeekEndTs - Math.max(1, endTs - weekStartTs)

    let prevTodayDemandDocs: SapUniqueDemandDoc[] = []
    let prevTodayNewDocs: SapUniqueDemandDoc[] = []
    let prevWeekNewDocs: SapUniqueDemandDoc[] = []

    if (allValidDocs) {
      const inRange = (t: number | null, s: number, e2: number) => t !== null && t >= s && t < e2
      prevTodayDemandDocs = allValidDocs.filter((d) =>
        inRange(parseTs(d.last_updated_time_ts ?? d.last_updated_time), prevStartTs, prevEndTs),
      )
      prevTodayNewDocs = allValidDocs.filter((d) =>
        inRange(parseTs(d.created_time_ts ?? d.created_time), prevStartTs, prevEndTs),
      )
      prevWeekNewDocs = allValidDocs.filter((d) =>
        inRange(parseTs(d.created_time_ts ?? d.created_time), prevWeekStartTs, prevWeekEndTs),
      )
    } else {
      ;[prevTodayDemandDocs, prevTodayNewDocs, prevWeekNewDocs] = await Promise.all([
        fetchAllUniqueDemandsByTimeRange({
          startTs: prevStartTs,
          endTs: prevEndTs,
          field: 'last_updated_time_ts',
          onlyValid: true,
          order: 'desc',
          pageSize: 100,
          max: 2000,
        }).catch(() => []),
        fetchAllUniqueDemandsByTimeRange({
          startTs: prevStartTs,
          endTs: prevEndTs,
          field: 'created_time_ts',
          onlyValid: true,
          order: 'desc',
          pageSize: 100,
          max: 2000,
        }).catch(() => []),
        fetchAllUniqueDemandsByTimeRange({
          startTs: prevWeekStartTs,
          endTs: prevWeekEndTs,
          field: 'created_time_ts',
          onlyValid: true,
          order: 'desc',
          pageSize: 100,
          max: 2000,
        }).catch(() => []),
      ])
    }

    todayDemand.value = todayDemandDocs.length
    {
      const prev = prevTodayDemandDocs.length
      todayDemandYoy.value = prev ? Math.round(((todayDemandDocs.length - prev) / prev) * 100) : null
    }

    todayNewArrivals.value = todayNewDocs.length
    {
      const prev = prevTodayNewDocs.length
      todayNewYoy.value = prev ? Math.round(((todayNewDocs.length - prev) / prev) * 100) : null
    }

    weekNewArrivals.value = weekNewDocs.length
    {
      const prev = prevWeekNewDocs.length
      weekNewYoy.value = prev ? Math.round(((weekNewDocs.length - prev) / prev) * 100) : null
    }

    todayModuleBars.value = buildModuleBars(todayDemandDocs)

    todayNewList.value = todayNewDocs.slice(0, 8)

    const byDay = new Map<string, number>()
    monthNewDocs.forEach((d) => {
      const ts = parseTs(d.created_time_ts ?? d.created_time)
      if (!ts) return
      const dd = new Date(ts)
      const y = dd.getFullYear()
      const m = String(dd.getMonth() + 1).padStart(2, '0')
      const day = String(dd.getDate()).padStart(2, '0')
      const key = `${y}-${m}-${day}`
      byDay.set(key, (byDay.get(key) || 0) + 1)
    })
    buildTrendDays(byDay)

  } catch (e: any) {
    console.error('Failed to load unique insights:', e)
    todayDemand.value = null
    todayDemandTopModule.value = ''
    todayDemandYoy.value = null
    todayNewArrivals.value = null
    todayNewArrivalsTopModule.value = ''
    todayNewYoy.value = null
    weekNewArrivals.value = null
    weekNewArrivalsTopModule.value = ''
    weekNewYoy.value = null
    trendDays.value = []
    trendMax.value = 0
    todayNewList.value = []
    todayModuleBars.value = []
  } finally {
    insightsLoading.value = false
  }
}

const handleUniqueDemand = (item: SapUniqueDemandDoc) => {
  const raw = String(item.raw_text || '').trim()
  if (!raw) return
  uni.setClipboardData({
    data: raw,
    success: () => {
      uni.showToast({ title: '需求内容已复制', icon: 'none' })
    },
  })
}

onMounted(() => {
  loadUniqueInsights()
})

onMounted(async () => {
  try {
    const state: any = await ensureLogin()
    isGuest.value = !!(state && isGuestUser(state.user))
  } catch {
    isGuest.value = false
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 36rpx 28rpx 48rpx;
  background: #F5F1E8;
  color: #111827;
  font-family: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", sans-serif;
}

.hero {
  position: relative;
  padding: 30rpx;
  border-radius: 24rpx;
  background: #0B1924;
  color: #F5F1E8;
  overflow: hidden;
}

.hero-top-actions {
  position: absolute;
  top: 18rpx;
  right: 18rpx;
  display: flex;
  gap: 12rpx;
  z-index: 2;
}

.icon-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 999rpx;
  background: rgba(245, 241, 232, 0.10);
  border: 2rpx solid rgba(245, 241, 232, 0.16);
  display: flex;
  align-items: center;
  justify-content: center;
}

.hero::before {
  content: "";
  position: absolute;
  top: -80rpx;
  right: -120rpx;
  width: 460rpx;
  height: 460rpx;
  background: rgba(217, 119, 6, 0.20);
  transform: rotate(18deg);
  border: 2rpx solid rgba(245, 241, 232, 0.10);
}

.hero-left {
  position: relative;
  z-index: 1;
}

.hero-kicker {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.hero-kicker-text {
  font-size: 24rpx;
  color: rgba(245, 241, 232, 0.86);
  letter-spacing: 1rpx;
}

.hero-title {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  line-height: 1.12;
  font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", serif;
}

.hero-subtitle {
  display: block;
  margin-top: 14rpx;
  font-size: 26rpx;
  line-height: 1.55;
  color: rgba(245, 241, 232, 0.84);
  max-width: 560rpx;
}

.hero-actions {
  margin-top: 24rpx;
  display: flex;
  gap: 18rpx;
  flex-wrap: wrap;
}


.btn {
  padding: 18rpx 26rpx;
  border-radius: 18rpx;
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1;
}

.btn-primary {
  background: #D97706;
  color: #111827;
}

.btn-ghost {
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: #fff;
  border: none;
  box-shadow: 0 8rpx 16rpx rgba(76, 175, 80, 0.3);
}

.hero-right {
  position: relative;
  z-index: 1;
  margin-top: 22rpx;
}

.panel {
  background: rgba(245, 241, 232, 0.92);
  border-radius: 20rpx;
  padding: 22rpx;
  color: #111827;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
}

.panel--inline {
  margin-top: 18rpx;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 18rpx;
}

.panel-title-text {
  font-size: 28rpx;
  font-weight: 800;
}

.tool {
  padding: 18rpx;
  border-radius: 16rpx;
  background: #FFFFFF;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
}

.tool-left {
  display: flex;
  align-items: flex-start;
  gap: 14rpx;
}

.tool-text {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}

.tool-name {
  font-size: 26rpx;
  font-weight: 800;
}

.tool-desc {
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.68);
  line-height: 1.35;
}

.tool-muted {
  background: rgba(255, 255, 255, 0.70);
}

.tool-badge {
  font-size: 22rpx;
  color: rgba(107, 114, 128, 1);
}

.quick {
  margin-top: 26rpx;
  display: flex;
  gap: 18rpx;
}

.insights {
  margin-top: 22rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  border: 2rpx solid rgba(245, 241, 232, 0.18);
  background: rgba(11, 25, 36, 0.55);
}

.insights--hero {
  margin-top: 22rpx;
}

.insights-head {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.insights-title {
  font-size: 30rpx;
  font-weight: 900;
  color: rgba(245, 241, 232, 0.94);
  letter-spacing: 1rpx;
}

.insights-sub {
  font-size: 22rpx;
  color: rgba(245, 241, 232, 0.62);
}

.ring-row {
  margin-top: 18rpx;
  display: flex;
  width: 100%;
  justify-content: space-between;
  padding-left: 12rpx;
  padding-right: 12rpx;
}

.ring-slot {
  flex: 1;
  min-width: 0;
  display: flex;
  justify-content: center;
}

.ring {
  width: 200rpx;
  height: 200rpx;
  flex: 0 0 200rpx;
  padding: 18rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(11, 25, 36, 0.92);
  border: 4rpx solid rgba(245, 241, 232, 0.22);
  box-shadow: 0 10rpx 24rpx rgba(0, 0, 0, 0.28);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  min-width: 0;
}

.ring--today {
  border-color: rgba(217, 119, 6, 0.62);
}

.ring--today-new {
  border-color: rgba(20, 184, 166, 0.60);
}

.ring--week-new {
  border-color: rgba(34, 197, 94, 0.58);
}

.ring-label {
  font-size: 20rpx;
  font-weight: 900;
  color: rgba(245, 241, 232, 0.70);
  letter-spacing: 1rpx;
}

.ring-value {
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1;
  color: rgba(245, 241, 232, 0.94);
  font-family: "Noto Serif SC", "Source Han Serif SC", "STSong", serif;
}

.ring-sub {
  font-size: 20rpx;
  color: rgba(20, 184, 166, 0.92);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.ring-yoy {
  font-size: 20rpx;
  color: rgba(245, 241, 232, 0.70);
}

.ring-yoy.is-pos {
  color: rgba(34, 197, 94, 0.92);
}

.ring-yoy.is-neg {
  color: rgba(239, 68, 68, 0.92);
}

.ring-yoy.is-zero {
  color: rgba(245, 241, 232, 0.70);
}

.module-chart {
  margin-top: 16rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: rgba(11, 25, 36, 0.92);
  border: 2rpx solid rgba(17, 24, 39, 0.12);
}

.module-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10rpx;
}

.module-title {
  font-size: 26rpx;
  font-weight: 900;
  color: rgba(245, 241, 232, 0.94);
  letter-spacing: 1rpx;
}

.module-meta {
  font-size: 22rpx;
  color: rgba(245, 241, 232, 0.60);
}

.module-bars {
  margin-top: 16rpx;
}

.module-bars-inner {
  display: flex;
  align-items: flex-end;
  gap: 10rpx;
  padding-bottom: 6rpx;
}

.module-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.module-bar {
  height: 140rpx;
  width: 100%;
  background: rgba(245, 241, 232, 0.06);
  border-radius: 10rpx;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  position: relative;
}

.module-bar--empty {
  background: transparent;
  border: 2rpx solid rgba(245, 241, 232, 0.08);
}

.module-bar-count {
  position: absolute;
  top: 8rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 18rpx;
  font-weight: 800;
  color: rgba(245, 241, 232, 0.88);
}

.module-bar-fill {
  width: 100%;
  background: rgba(20, 184, 166, 0.92);
  border-radius: 10rpx;
}

.module-name {
  margin-top: 10rpx;
  font-size: 18rpx;
  color: rgba(245, 241, 232, 0.52);
  white-space: nowrap;
}

.module-empty {
  padding: 18rpx;
  border-radius: 16rpx;
  background: rgba(245, 241, 232, 0.06);
  border: 2rpx dashed rgba(245, 241, 232, 0.14);
  margin-top: 14rpx;
}

.module-empty-text {
  font-size: 22rpx;
  color: rgba(245, 241, 232, 0.60);
}

.trend {
  margin-top: 18rpx;
  padding: 18rpx;
  border-radius: 20rpx;
  background: rgba(11, 25, 36, 0.92);
  border: 2rpx solid rgba(17, 24, 39, 0.12);
}

.trend-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10rpx;
}

.trend-title {
  font-size: 26rpx;
  font-weight: 900;
  color: rgba(245, 241, 232, 0.94);
  letter-spacing: 1rpx;
}

.trend-meta {
  font-size: 22rpx;
  color: rgba(245, 241, 232, 0.60);
}

.trend-bars {
  margin-top: 16rpx;
  display: flex;
  align-items: flex-end;
  gap: 6rpx;
}

.trend-col {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.trend-bar {
  height: 120rpx;
  width: 100%;
  background: rgba(245, 241, 232, 0.06);
  border-radius: 10rpx;
  overflow: hidden;
  display: flex;
  align-items: flex-end;
  position: relative;
}

.trend-bar--empty {
  background: transparent;
  border: 2rpx solid rgba(245, 241, 232, 0.08);
}

.trend-bar-fill {
  width: 100%;
  background: rgba(20, 184, 166, 0.92);
  border-radius: 10rpx;
}

.trend-bar-count {
  position: absolute;
  top: -20rpx;
  left: 50%;
  transform: translateX(-50%);
  font-size: 18rpx;
  color: rgba(245, 241, 232, 0.82);
}

.trend-date {
  margin-top: 10rpx;
  font-size: 18rpx;
  color: rgba(245, 241, 232, 0.52);
  transform: rotate(-60deg);
  transform-origin: top left;
  white-space: nowrap;
}

.trend-foot {
  margin-top: 12rpx;
}

.trend-foot-text {
  font-size: 22rpx;
  color: rgba(245, 241, 232, 0.68);
}

.lists {
  margin-top: 18rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.list-card {
  padding: 18rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.92);
  border: 2rpx solid rgba(17, 24, 39, 0.08);
}

.list-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.list-title {
  font-size: 26rpx;
  font-weight: 900;
  color: #111827;
}

.list-meta {
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.62);
}

.list-body {
  margin-top: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}

.list-item {
  padding: 14rpx;
  border-radius: 16rpx;
  background: rgba(245, 241, 232, 0.78);
  border: 2rpx solid rgba(17, 24, 39, 0.06);
}

.list-item-title {
  display: block;
  font-size: 24rpx;
  font-weight: 800;
  color: rgba(17, 24, 39, 0.92);
  line-height: 1.35;
}

.list-item-sub {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.64);
}

.list-empty {
  padding: 18rpx;
  border-radius: 16rpx;
  background: rgba(245, 241, 232, 0.55);
  border: 2rpx dashed rgba(17, 24, 39, 0.12);
}

.list-empty-text {
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.60);
}

.quick-item {
  flex: 1;
  padding: 18rpx 16rpx;
  border-radius: 18rpx;
  background: #FFFFFF;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
}

.guest-disabled {
  opacity: 0.45;
  filter: grayscale(1);
}

.quick-text {
  font-size: 24rpx;
  font-weight: 700;
}

.footer {
  margin-top: 34rpx;
  padding: 24rpx 10rpx 0;
  text-align: center;
  color: rgba(17, 24, 39, 0.72);
}

.footer-links {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.footer-link {
  color: rgba(17, 24, 39, 0.90);
  font-size: 24rpx;
}

.footer-dot {
  color: rgba(17, 24, 39, 0.45);
  font-size: 24rpx;
}

.footer-icp {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.55);
}
</style>
