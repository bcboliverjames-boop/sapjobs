<template>
  <view class="page sap-demand-page">
    <!-- 顶部区域：标题 + 简短说明 -->
    <view class="page-header">
      <view class="page-title-row">
        <text class="badge">SAP</text>
        <text class="page-title">顾问需求广场</text>
        <view class="header-actions">
          <view v-if="isAdmin" class="refresh-btn" @tap="handleRefreshTags" :class="{ 'refresh-btn--loading': refreshingTags }">
            <text class="refresh-btn-text">{{ refreshingTags ? '刷新中...' : '🔄 刷新标签' }}</text>
          </view>
          <view class="publish-btn" @tap="goToPublish" :class="{ 'guest-disabled': isGuest }">
            <text class="publish-btn-text">+ 发布</text>
          </view>
          <view class="icon-btn" @tap="goToAccount">
            <uni-icons type="person" size="18" color="#F5F1E8" />
          </view>
        </view>
      </view>
    </view>

    <!-- 搜索框 -->
    <view class="search-box">
      <input
        class="search-input"
        v-model="searchKeyword"
        type="text"
        placeholder="搜索需求内容、模块、城市..."
        confirm-type="search"
        @input="handleSearch"
        @confirm="handleSearch"
        @click.stop
      />
      <view class="search-action" @click.stop="triggerSearch">
        <text class="search-action-text">搜索</text>
      </view>
      <view v-if="searchKeyword" class="search-clear" @tap="clearSearch">
        <text class="search-clear-text">✕</text>
      </view>
    </view>

    <!-- 顶部筛选条（静态假数据版，仅前端过滤） -->
    <scroll-view class="filter-strip" scroll-x="true" show-scrollbar="false">
      <view class="filter-group">
        <text class="filter-label">模块</text>
        <view class="filter-chips">
          <view
            v-for="m in modulesForUi"
            :key="m.code"
            class="chip"
            :class="{ 'chip--active': m.code === activeModule }"
            @tap="setModule(m.code)"
          >
            <text class="chip-text">{{ m.name }}</text>
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-label">时间</text>
        <view class="filter-chips tight">
          <view
            v-for="t in timeRanges"
            :key="t.value"
            class="chip chip--ghost"
            :class="{ 'chip--active-ghost': t.value === activeTimeRange }"
            @tap="setTimeRange(t.value)"
          >
            <text class="chip-text">{{ t.label }}</text>
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-label">口径</text>
        <view class="filter-chips tight">
          <view
            v-for="t in timeFields"
            :key="t.value"
            class="chip chip--ghost"
            :class="{ 'chip--active-ghost': t.value === activeTimeField }"
            @tap="setTimeField(t.value)"
          >
            <text class="chip-text">{{ t.label }}</text>
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-label">地区</text>
        <view class="filter-chips tight">
          <view
            v-for="c in cities"
            :key="c"
            class="chip chip--ghost"
            :class="{ 'chip--active-ghost': c === activeCity }"
            @tap="setCity(c)"
          >
            <text class="chip-text">{{ c }}</text>
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-label">工作方式</text>
        <view class="filter-chips tight">
          <view
            v-for="m in remoteModes"
            :key="m.value"
            class="chip chip--ghost"
            :class="{ 'chip--active-ghost': m.value === activeRemoteMode }"
            @tap="setRemoteMode(m.value)"
          >
            <text class="chip-text">{{ m.label }}</text>
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-label">合作方式</text>
        <view class="filter-chips tight">
          <view
            v-for="m in cooperationModes"
            :key="m.value"
            class="chip chip--ghost"
            :class="{ 'chip--active-ghost': m.value === activeCooperationMode }"
            @tap="setCooperationMode(m.value)"
          >
            <text class="chip-text">{{ m.label }}</text>
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-label">年限</text>
        <view class="filter-chips tight">
          <view
            v-for="y in yearRanges"
            :key="y.value"
            class="chip chip--ghost"
            :class="{ 'chip--active-ghost': y.value === activeYearRange }"
            @tap="setYearRange(y.value)"
          >
            <text class="chip-text">{{ y.label }}</text>
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-label">周期</text>
        <view class="filter-chips tight">
          <view
            v-for="d in durationRanges"
            :key="d.value"
            class="chip chip--ghost"
            :class="{ 'chip--active-ghost': d.value === activeDurationRange }"
            @tap="setDurationRange(d.value)"
          >
            <text class="chip-text">{{ d.label }}</text>
          </view>
        </view>
      </view>

      <view class="filter-group">
        <text class="filter-label">语言</text>
        <view class="filter-chips tight">
          <view
            v-for="l in languageOptions"
            :key="l.value"
            class="chip chip--ghost"
            :class="{ 'chip--active-ghost': l.value === activeLanguage }"
            @tap="setLanguage(l.value)"
          >
            <text class="chip-text">{{ l.label }}</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 需求卡片列表（使用假数据） -->
    <scroll-view class="card-list" scroll-y="true" :scroll-with-animation="true">
      <view
        v-for="card in filteredDemands"
        :key="card.id"
        class="demand-card"
        @tap="goDetail(card)"
      >
        <!-- A. 原始信息区 -->
        <view class="card-raw">
          <text class="card-raw-text">
            {{ card.raw_text }}
          </text>
        </view>

         <!-- B. 结构化标签区 -->
         <view class="card-tags">
           <view class="tag tag--primary">
             <text>{{ card.module_labels.join(' / ') }}</text>
           </view>
           <view class="tag" v-if="card.city">
             <text>{{ card.city }}</text>
           </view>
           <view class="tag" v-if="card.duration_text">
             <text>{{ card.duration_text }}</text>
           </view>
           <view class="tag" v-if="card.years_text">
             <text>{{ card.years_text }}</text>
           </view>
           <view class="tag tag--accent" v-if="card.language">
             <text>{{ card.language }}</text>
           </view>
           <view class="tag tag--rate" v-if="card.daily_rate">
             <text>💰 {{ formatDailyRate(card.daily_rate) }}</text>
           </view>
           <view class="tag tag--ghost" v-if="card.cooperation_mode">
             <text>{{ card.cooperation_mode }}</text>
           </view>
           <view v-for="t in card.extra_tags" :key="t" class="tag tag--ghost">
             <text>{{ t }}</text>
           </view>
           <view class="tag tag--related" v-if="card.relatedCount && card.relatedCount > 0">
             <text>关联需求数 {{ card.relatedCount }}</text>
           </view>
         </view>

         <!-- 状态和评价栏（可点击） -->
         <view class="card-status-bar" @tap.stop>
           <view 
             class="card-status-item"
             :class="[
               'card-status-item--applied',
               { 'card-status-item--active': card.userStatuses?.includes('applied') },
               { 'guest-disabled': isGuest }
             ]"
             @tap.stop="handleCardStatusClick(card, 'applied')"
           >
             <text class="card-status-icon">📤</text>
             <text class="card-status-label">已投递</text>
             <text class="card-status-count">({{ card.statusCounts?.applied || 0 }})</text>
           </view>
           <view 
             class="card-status-item"
             :class="[
               'card-status-item--interviewed',
               { 'card-status-item--active': card.userStatuses?.includes('interviewed') },
               { 'guest-disabled': isGuest }
             ]"
             @tap.stop="handleCardStatusClick(card, 'interviewed')"
           >
             <text class="card-status-icon">💼</text>
             <text class="card-status-label">已面试</text>
             <text class="card-status-count">({{ card.statusCounts?.interviewed || 0 }})</text>
           </view>
           <view 
             class="card-status-item"
             :class="[
               'card-status-item--onboarded',
               { 'card-status-item--active': card.userStatuses?.includes('onboarded') },
               { 'guest-disabled': isGuest }
             ]"
             @tap.stop="handleCardStatusClick(card, 'onboarded')"
           >
             <text class="card-status-icon">✅</text>
             <text class="card-status-label">已到岗</text>
             <text class="card-status-count">({{ card.statusCounts?.onboarded || 0 }})</text>
           </view>
           <view 
             class="card-status-item"
             :class="[
               'card-status-item--closed',
               { 'card-status-item--active': card.userStatuses?.includes('closed') },
               { 'guest-disabled': isGuest }
             ]"
             @tap.stop="handleCardStatusClick(card, 'closed')"
           >
             <text class="card-status-icon">🔒</text>
             <text class="card-status-label">已关闭</text>
             <text class="card-status-count">({{ card.statusCounts?.closed || 0 }})</text>
           </view>
         </view>

         <view class="card-reliability-bar" @tap.stop>
          <view 
            class="card-reliability-item card-reliability-item--reliable"
            :class="{ 'card-reliability-item--active': card.userReliability === true, 'guest-disabled': isGuest }"
            @tap.stop="handleCardReliabilityClick(card, true)"
          >
            <text class="card-reliability-icon">👍</text>
            <text class="card-reliability-label">靠谱</text>
            <text class="card-reliability-count">({{ card.reliabilityCounts?.reliable || 0 }})</text>
          </view>
          <view 
            class="card-reliability-item card-reliability-item--unreliable"
            :class="{ 'card-reliability-item--active': card.userReliability === false, 'guest-disabled': isGuest }"
            @tap.stop="handleCardReliabilityClick(card, false)"
          >
            <text class="card-reliability-icon">👎</text>
            <text class="card-reliability-label">不靠谱</text>
            <text class="card-reliability-count">({{ card.reliabilityCounts?.unreliable || 0 }})</text>
          </view>
          <view
            class="card-favorite-btn"
            :class="{ 'card-favorite-btn--active': card.isFavorited, 'guest-disabled': isGuest }"
            @tap.stop="toggleCardFavorite(card)"
          >
            <text class="card-favorite-icon">{{ card.isFavorited ? '❤️' : '🤍' }}</text>
          </view>
        </view>

        <!-- 中部：当前需求的热门评论预览（点赞最高优先） -->
        <scroll-view
          v-if="commentsByDemand[card.id] && commentsByDemand[card.id].length"
          class="card-comments-strip"
          scroll-x="true"
          show-scrollbar="false"
          @tap.stop
        >
          <view class="card-comments-list">
            <view
              v-for="c in commentsByDemand[card.id]"
              :key="c._id"
              class="card-comment-pill"
              @tap.stop
            >
              <text class="card-comment-likes" @tap.stop="reactOnListComment(c, 'likes')">
                👍 {{ c.likes || 0 }}
              </text>
              <text class="card-comment-dislikes" @tap.stop="reactOnListComment(c, 'dislikes')">
                👎 {{ c.dislikes || 0 }}
              </text>
              <text class="card-comment-text" @tap.stop="goToDetailFromComment(c.demand_id)">{{ c.content }}</text>
            </view>
          </view>
        </scroll-view>

         <!-- 相似需求提示 -->
         <view v-if="card.similarCount && card.similarCount > 0" class="similar-hint">
           <text class="similar-hint-text">
             📋 共有 {{ card.similarCount + 1 }} 个用户发布过相似需求
           </text>
         </view>

         <!-- C. 信息提供者 + 联系方式解锁占位 -->
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { ensureLogin, requireNonGuest, isGuestUser } from '../../utils/cloudbase'
import { getWorkingHoursWindowStart } from '../../utils/workday-window'
import { parseDemandText } from '../../utils/demand-parser'
import { calculateTextSimilarity } from '../../utils/demand-similarity'
import { addFavorite, removeFavorite, checkFavoritesStatus } from '../../utils/favorites'
import {
  fetchAllUniqueDemands,
  fetchAllUniqueDemandsByTimeRange,
  type SapUniqueDemandDoc,
} from '../../utils/sap-unique-demands'
import { refreshAllDemandsTags } from '../../utils/sap-demands'
import { getSapModuleFilterOptions, normalizeSapModuleToken, sapModuleCodeToLabel } from '../../utils/sap-modules'
import {
  markDemandStatus,
  unmarkDemandStatus,
  getDemandStatusCounts,
  getUserDemandStatuses,
  markDemandReliability,
  unmarkDemandReliability,
  getDemandReliabilityCounts,
  getUserDemandReliability,
} from '../../utils/demand-status'
import { getOrCreateUserProfile } from '../../utils/user'
import { ugcReactionToggle } from '../../utils/ugc'
import { isAdminUid } from '../../utils/admin'

function getApiBase(): string {
  const fromEnv =
    (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
  if (fromEnv) return String(fromEnv)

  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) return 'http://127.0.0.1:3001'
    }
  } catch {
    // ignore
  }

  return 'https://api.sapboss.com'
}

const API_BASE = getApiBase()

function requestJson<T = any>(opts: { url: string; method?: 'GET' | 'POST'; data?: any; header?: any }): Promise<T> {
  return new Promise((resolve, reject) => {
    uni.request({
      url: opts.url,
      method: opts.method || 'GET',
      data: opts.data,
      header: {
        'Content-Type': 'application/json',
        ...(opts.header || {}),
      },
      success: (res) => resolve((res as any)?.data as T),
      fail: (err) => reject(err),
    })
  })
}

type DemandCard = {
  id: string;
  raw_text: string;
  module_labels: string[];
  module_codes: string[];
  city: string;
  duration_text: string;
  years_text: string;
  language: string;
  daily_rate: string;
  is_remote: boolean | null;
  cooperation_mode: string;
  years_bucket: '' | '0-3' | '4-6' | '7-10' | '10+';
  duration_bucket: '' | 'SHORT' | 'MID' | 'LONG';
  extra_tags: string[];
  provider_name: string;
  createdAt?: any;
  updatedAt?: any;
  relatedCount?: number;
  similarCount?: number; // 相似需求数量
  similarDemands?: Array<{ // 折叠的相似需求列表
    id?: string;
    raw_text: string;
    createdAt: Date | string;
    provider_user_id?: string;
    provider_name: string;
    similarity: number;
  }>;
  statusCounts?: {
    applied: number;
    interviewed: number;
    onboarded: number;
    closed: number;
  };
  reliabilityCounts?: {
    reliable: number;
    unreliable: number;
  };
  userStatuses?: string[]; // 当前用户已标记的状态
  userReliability?: boolean | null; // 当前用户的评价
  isFavorited?: boolean;
  favoriting?: boolean;
};

const BASE_MODULES = getSapModuleFilterOptions()

const extraModules = ref<{ code: string; name: string }[]>([])

const modulesForUi = computed(() => {
  const seen = new Set<string>()
  const out: { code: string; name: string }[] = []
  ;[...BASE_MODULES, ...extraModules.value].forEach((m) => {
    const code = String(m.code || '').trim()
    if (!code) return
    if (seen.has(code)) return
    seen.add(code)
    out.push({ code, name: m.name })
  })
  return out
})

const cities = ['全部', '上海', '北京', '深圳', '全国', '远程', '海外', '欧洲', '菲律宾'];

const activeModule = ref('ALL');
const activeCity = ref('全部');

type TimeRange = 'ALL' | 'TODAY' | 'WEEK'

type TimeField = 'CREATED' | 'UPDATED'

const timeRanges: { value: TimeRange; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'TODAY', label: '今日' },
  { value: 'WEEK', label: '本周' },
]

const activeTimeRange = ref<TimeRange>('ALL')
const timeStartTs = ref<number | null>(null)

const timeFields: { value: TimeField; label: string }[] = [
  { value: 'CREATED', label: '上新' },
  { value: 'UPDATED', label: '更新' },
]

const activeTimeField = ref<TimeField>('CREATED')

type RemoteMode = 'ALL' | 'REMOTE' | 'ONSITE'
type YearRange = 'ALL' | '0-3' | '4-6' | '7-10' | '10+'
type DurationRange = 'ALL' | 'SHORT' | 'MID' | 'LONG'
type LanguageOpt = 'ALL' | 'EN' | 'JP'

type CooperationModeOpt = 'ALL' | string

const remoteModes: { value: RemoteMode; label: string }[] = [
  { value: 'ALL', label: '全部' },
  { value: 'REMOTE', label: '仅远程' },
  { value: 'ONSITE', label: '仅非远程' },
]

const yearRanges: { value: YearRange; label: string }[] = [
  { value: 'ALL', label: '全部年限' },
  { value: '0-3', label: '0-3年' },
  { value: '4-6', label: '4-6年' },
  { value: '7-10', label: '7-10年' },
  { value: '10+', label: '10年以上' },
]

const durationRanges: { value: DurationRange; label: string }[] = [
  { value: 'ALL', label: '全部周期' },
  { value: 'SHORT', label: '≤3个月' },
  { value: 'MID', label: '3-6个月' },
  { value: 'LONG', label: '6个月以上' },
]

const languageOptions: { value: LanguageOpt; label: string }[] = [
  { value: 'ALL', label: '全部语言' },
  { value: 'EN', label: '英语' },
  { value: 'JP', label: '日语' },
]

const cooperationModes = computed(() => {
  return [
    { value: 'ALL' as CooperationModeOpt, label: '全部' },
    { value: 'FREE' as CooperationModeOpt, label: 'Free' },
    { value: '入职' as CooperationModeOpt, label: '入职' },
    { value: '甲方入职' as CooperationModeOpt, label: '甲方入职' },
    { value: '乙方入职' as CooperationModeOpt, label: '乙方入职' },
    { value: '兼职' as CooperationModeOpt, label: '兼职' },
    { value: '外包' as CooperationModeOpt, label: '外包' },
  ]
})

const activeRemoteMode = ref<'ALL' | 'REMOTE' | 'ONSITE'>('ALL')
const activeYearRange = ref<'ALL' | '0-3' | '4-6' | '7-10' | '10+'>('ALL')
const activeDurationRange = ref<'ALL' | 'SHORT' | 'MID' | 'LONG'>('ALL')
const activeLanguage = ref<'ALL' | 'EN' | 'JP'>('ALL')
const activeCooperationMode = ref<CooperationModeOpt>('ALL')

const loading = ref(true)
const allDemands = ref<DemandCard[]>([])
const useLocalFallback = ref(false)
const isGuest = ref(false)
const searchKeyword = ref('')
const refreshingTags = ref(false) // 是否正在刷新标签
const isAdmin = ref(false)
const commentsByDemand = ref<
  Record<
    string,
    {
      _id?: string
      demand_id: string
      content: string
      likes: number
      dislikes: number
      createdAtText: string
    }[]
  >
>({})

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
  '全国',
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

const extractModulesFromUnique = (d: SapUniqueDemandDoc): string[] => {
  const tags = safeJsonArray((d as any).tags_json)
  const hit: string[] = []
  tags.forEach((t) => {
    const key = String(t || '').trim()
    if (!key) return
    const code = normalizeSapModuleToken(key)
    if (code && !hit.includes(code)) hit.push(code)
  })
  return hit.length ? hit : []
}

const extractCityFromUnique = (d: SapUniqueDemandDoc): string => {
  const tags = safeJsonArray((d as any).tags_json)
  for (const t of tags) {
    const k = String(t || '').trim()
    if (!k) continue
    if (LOCATION_SET.has(k)) return k
  }
  return ''
}

const extractCityFromRawText = (rawText: string): string => {
  const text = String(rawText || '').trim()
  if (!text) return ''
  if (/菲律宾|philippines/i.test(text)) return '菲律宾'
  if (/欧洲|europe/i.test(text)) return '欧洲'
  if (/海外|overseas|国外/i.test(text)) return '海外'
  // 兜底：扫描国内城市/地区关键词（避免仅靠 tags/attrs 导致“合肥”等丢失）
  for (const k of LOCATION_KEYWORDS) {
    if (!k) continue
    if (text.includes(k)) return k
  }
  return ''
}

const toModuleLabel = (code: string): string => sapModuleCodeToLabel(code)

// 将云端或本地的原始记录映射到页面用的卡片类型
const mapToCard = (item: any, index: number): DemandCard => ({
  id: item.id || String(index),
  raw_text: item.raw_text,
  module_labels: item.module_labels,
  module_codes: item.module_codes,
  city: item.city,
  duration_text: item.duration_text,
  years_text: item.years_text,
  language: item.language,
  daily_rate: item.daily_rate,
  is_remote: typeof item.is_remote === 'boolean' ? item.is_remote : null,
  cooperation_mode: String(item.cooperation_mode || '').trim(),
  years_bucket: (item.years_bucket === '0-3' || item.years_bucket === '4-6' || item.years_bucket === '7-10' || item.years_bucket === '10+') ? item.years_bucket : '',
  duration_bucket: (item.duration_bucket === 'SHORT' || item.duration_bucket === 'MID' || item.duration_bucket === 'LONG') ? item.duration_bucket : '',
  extra_tags: Array.isArray(item.extra_tags) ? item.extra_tags.map((x: any) => String(x || '').trim()).filter(Boolean) : [],
  provider_name: item.provider_name,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
  relatedCount: item.relatedCount || 0,
  similarCount: item.similarCount || 0,
  similarDemands: item.similarDemands || [],
  // 初始化状态和评价数据，确保始终有值（即使为0也显示）
  statusCounts: item.statusCounts || { applied: 0, interviewed: 0, onboarded: 0, closed: 0 },
  reliabilityCounts: item.reliabilityCounts || { reliable: 0, unreliable: 0 },
})

const computeRelatedCounts = async (cards: DemandCard[]) => {
  try {
    if (!cards.length) return
    cards.forEach((card) => {
      card.relatedCount = 0
    })
  } catch (e) {
    console.error('Failed to compute related demands count:', e)
  }
}

const loadFromCloud = async () => {
  try {
    await ensureLogin()

    const endTs = Date.now()
    let startTs: number | null = null
    if (activeTimeRange.value === 'TODAY') {
      const start = await getWorkingHoursWindowStart({ now: new Date(endTs), hours: 24 })
      startTs = start.getTime()
    } else if (activeTimeRange.value === 'WEEK') {
      startTs = endTs - 7 * 24 * 60 * 60 * 1000
    }

    const field = activeTimeField.value === 'UPDATED' ? 'last_updated_time_ts' : 'created_time_ts'

    let docs: SapUniqueDemandDoc[] = []
    if (startTs !== null) {
      docs = await fetchAllUniqueDemandsByTimeRange({
        startTs,
        endTs,
        field: field as any,
        onlyValid: true,
        order: 'desc',
        max: 2000,
      })
    } else {
      docs = await fetchAllUniqueDemands({
        onlyValid: true,
        orderBy: field,
        order: 'desc',
        max: 2000,
      })
    }

    const cards = (docs || []).map((d, idx) => {
      const rawText = String(d.raw_text || '').trim()
      const attrs = (() => {
        try {
          const v: any = (d as any).attributes_json
          if (!v) return null
          if (typeof v === 'object') return v
          const s = String(v || '').trim()
          if (!s) return null
          return JSON.parse(s)
        } catch {
          return null
        }
      })()

      const tagsFromDoc = safeJsonArray((d as any).tags_json)

      const fromTags = extractModulesFromUnique(d)
      const parsed = parseDemandText(rawText)
      const moduleCodes = (
        (attrs && Array.isArray((attrs as any).module_codes) ? (attrs as any).module_codes : null) ||
        (fromTags.length ? fromTags : parsed.module_codes || [])
      )
        .map((x: any) => String(x || '').trim())
        .map((x: string) => normalizeSapModuleToken(x) || String(x || '').trim().toUpperCase())
        .filter(Boolean)
      const moduleLabels = moduleCodes.map(toModuleLabel)
      const cityFromTags = extractCityFromUnique(d)
      const cityFromAttrs = attrs ? String((attrs as any).city || '').trim() : ''
      const cityFromRaw = extractCityFromRawText(rawText)
      const durationFromAttrs = attrs ? String((attrs as any).duration_text || '').trim() : ''
      const yearsFromAttrs = attrs ? String((attrs as any).years_text || '').trim() : ''
      const languageFromAttrs = attrs ? String((attrs as any).language_tag || '').trim() : ''
      const dailyRateFromAttrs = attrs ? String((attrs as any).daily_rate_text || '').trim() : ''
      const isRemoteFromAttrs = attrs && Object.prototype.hasOwnProperty.call(attrs, 'is_remote') ? (attrs as any).is_remote : null
      const yearsBucketFromAttrs = attrs ? String((attrs as any).years_bucket || '').trim() : ''
      const durationBucketFromAttrs = attrs ? String((attrs as any).duration_bucket || '').trim() : ''
      const cooperationModeFromAttrs = attrs ? String((attrs as any).cooperation_mode || '').trim() : ''
      const createdAt = (d as any).created_time || (d as any).message_time || null
      const updatedAt = (d as any).last_updated_time || (d as any).updated_at || null
      const rawId = (d as any)._id
      const localId = (d as any).local_id
      const id = String(rawId || (localId ? `ud_${localId}` : idx))

      const extraTags = (() => {
        const base = tagsFromDoc.map((x) => String(x || '').trim()).filter(Boolean)
        const drop = new Set<string>()
        moduleLabels.forEach((x) => drop.add(String(x || '').trim()))
        if (cityFromAttrs) drop.add(cityFromAttrs)
        if (durationFromAttrs) drop.add(durationFromAttrs)
        if (yearsFromAttrs) drop.add(yearsFromAttrs)
        if (languageFromAttrs) drop.add(languageFromAttrs)
        if (dailyRateFromAttrs) drop.add(dailyRateFromAttrs)
        if (cooperationModeFromAttrs) drop.add(cooperationModeFromAttrs)
        const out: string[] = []
        for (const t of base) {
          if (!t) continue
          if (drop.has(t)) continue
          if (out.includes(t)) continue
          out.push(t)
          if (out.length >= 6) break
        }
        return out
      })()

      return mapToCard(
        {
          id,
          raw_text: rawText,
          module_codes: moduleCodes,
          module_labels: moduleLabels,
          city: (() => {
            const base = cityFromAttrs || cityFromTags || parsed.city || ''
            if (base === '海外' && (cityFromRaw === '欧洲' || cityFromRaw === '菲律宾')) return cityFromRaw
            return base || cityFromRaw || ''
          })(),
          duration_text: durationFromAttrs || parsed.duration_text || '',
          years_text: yearsFromAttrs || parsed.years_text || '',
          language: languageFromAttrs || parsed.language || '',
          daily_rate: dailyRateFromAttrs || parsed.daily_rate || '',
          is_remote: typeof isRemoteFromAttrs === 'boolean' ? isRemoteFromAttrs : null,
          cooperation_mode: cooperationModeFromAttrs,
          years_bucket: (yearsBucketFromAttrs === '0-3' || yearsBucketFromAttrs === '4-6' || yearsBucketFromAttrs === '7-10' || yearsBucketFromAttrs === '10+') ? (yearsBucketFromAttrs as any) : '',
          duration_bucket: (durationBucketFromAttrs === 'SHORT' || durationBucketFromAttrs === 'MID' || durationBucketFromAttrs === 'LONG') ? (durationBucketFromAttrs as any) : '',
          extra_tags: extraTags,
          provider_name: (d as any).publisher_name || '未知',
          createdAt,
          updatedAt,
          similarCount: 0,
          similarDemands: [],
        },
        idx
      )
    })

    const demandIds = cards.map((d) => d.id).filter(Boolean) as string[]
    const statusCountsMap = new Map<string, any>()
    const reliabilityCountsMap = new Map<string, any>()

    if (demandIds.length > 0) {
      await Promise.all(
        demandIds.map(async (id) => {
          try {
            const [statusCounts, reliabilityCounts] = await Promise.all([
              getDemandStatusCounts(id),
              getDemandReliabilityCounts(id),
            ])
            statusCountsMap.set(id, statusCounts)
            reliabilityCountsMap.set(id, reliabilityCounts)
          } catch (e) {
            console.error(`Failed to load status/reliability for demand ${id}:`, e)
            statusCountsMap.set(id, { applied: 0, interviewed: 0, onboarded: 0, closed: 0 })
            reliabilityCountsMap.set(id, { reliable: 0, unreliable: 0 })
          }
        })
      )
    }

    const user = await getOrCreateUserProfile().catch(() => null)
    if (user) {
      await Promise.all(
        cards.map(async (card) => {
          card.statusCounts = statusCountsMap.get(card.id) || { applied: 0, interviewed: 0, onboarded: 0, closed: 0 }
          card.reliabilityCounts = reliabilityCountsMap.get(card.id) || { reliable: 0, unreliable: 0 }
          try {
            const [userStatuses, userReliability] = await Promise.all([
              getUserDemandStatuses(card.id, user.uid),
              getUserDemandReliability(card.id, user.uid),
            ])
            card.userStatuses = userStatuses || []
            card.userReliability = userReliability
          } catch (e) {
            console.error(`Failed to load user status/reliability for demand ${card.id}:`, e)
            card.userStatuses = []
            card.userReliability = null
          }
        })
      )
    } else {
      cards.forEach((card) => {
        card.statusCounts = statusCountsMap.get(card.id) || { applied: 0, interviewed: 0, onboarded: 0, closed: 0 }
        card.reliabilityCounts = reliabilityCountsMap.get(card.id) || { reliable: 0, unreliable: 0 }
        card.userStatuses = []
        card.userReliability = null
      })
    }

    let favoriteSet = new Set<string>()
    if (user && demandIds.length > 0) {
      favoriteSet = await checkFavoritesStatus(demandIds)
    }
    cards.forEach((card) => {
      card.isFavorited = favoriteSet.has(card.id)
      card.favoriting = false
    })

    await computeRelatedCounts(cards)

    allDemands.value = cards
    await loadCommentsForDemands()
    loading.value = false
    useLocalFallback.value = false
    return
  } catch (e) {
    console.error('Failed to load demands from cloud:', e)
    // 回退到本地示例数据
    allDemands.value = []
    commentsByDemand.value = {}
    loading.value = false
    useLocalFallback.value = true
  }
}

const loadCommentsForDemands = async () => {
  try {
    await ensureLogin()
    const ids = allDemands.value.map((d) => d.id).filter(Boolean)
    if (!ids.length) return

    const base = String(API_BASE).replace(/\/+$/, '')
    const resp: any = await requestJson({
      url: `${base}/demand_comments?demandIds=${encodeURIComponent(ids.join(','))}&limit=200`,
      method: 'GET',
    })

    const rows: any[] = resp && resp.ok && Array.isArray(resp.comments) ? resp.comments : []

    const map: Record<
      string,
      {
        _id?: string
        demand_id: string
        content: string
        likes: number
        dislikes: number
        createdAtText: string
      }[]
    > = {}

    ;(rows || []).forEach((doc: any) => {
      const dId = doc.demand_id
      if (!dId) return
      if (!map[dId]) map[dId] = []
      // 每条需求最多展示 10 条评论
      if (map[dId].length < 10) {
        map[dId].push({
          _id: doc._id,
          demand_id: dId,
          content: doc.content,
          likes: doc.likes || 0,
          dislikes: doc.dislikes || 0,
          createdAtText: doc.createdAt
            ? new Date(doc.createdAt).toLocaleDateString('zh-CN')
            : '',
        })
      }
    })

    commentsByDemand.value = map
  } catch (e) {
    console.error('Failed to load demand comments:', e)
  }
}

onMounted(() => {
  loadFromCloud()

  // 监听详情页收藏变更，返回广场时立即同步心形状态
  uni.$on('favoriteChanged', (payload: any) => {
    const demandId = String(payload?.demandId || '').trim()
    if (!demandId) return
    const isFavorited = Boolean(payload?.isFavorited)
    const card = (allDemands.value || []).find((c) => String(c?.id || '') === demandId)
    if (!card) return
    card.isFavorited = isFavorited
    card.favoriting = false
  })
})

onUnmounted(() => {
  uni.$off('favoriteChanged')
})

const refreshAuthState = async () => {
  try {
    const prevGuest = !!isGuest.value
    const state: any = await ensureLogin()
    const nextGuest = !!(state && isGuestUser(state.user))
    isGuest.value = nextGuest
    isAdmin.value = isAdminUid(String((state && state.user && (state.user as any).uid) || '').trim())

    // When switching from guest -> logged-in, refresh list so favorites/status become interactive.
    if (prevGuest && !nextGuest) {
      await loadFromCloud()
    }
  } catch {
    isGuest.value = false
    isAdmin.value = false
  }
}

// 页面显示时刷新数据（从登录/发布页返回时会触发）
onShow(async () => {
  await refreshAuthState()
  // 如果已经有数据，刷新列表（避免首次加载时重复加载）
  if (allDemands.value.length > 0 || !loading.value) {
    loadFromCloud()
  }
})

const parseCreatedAtTs = (v: any): number | null => {
  if (!v) return null
  try {
    const d = v instanceof Date ? v : new Date(v)
    const t = d.getTime()
    return Number.isFinite(t) ? t : null
  } catch {
    return null
  }
}

const refreshTimeWindow = async () => {
  if (activeTimeRange.value === 'ALL') {
    timeStartTs.value = null
    return
  }

  const now = new Date()
  if (activeTimeRange.value === 'TODAY') {
    const start = await getWorkingHoursWindowStart({ now, hours: 24 })
    timeStartTs.value = start.getTime()
    return
  }

  if (activeTimeRange.value === 'WEEK') {
    timeStartTs.value = now.getTime() - 7 * 24 * 60 * 60 * 1000
    return
  }
}

watch(activeTimeRange, () => {
  refreshTimeWindow()
})

onMounted(async () => {
  await refreshAuthState()
})

onLoad((options) => {
  const module = String((options as any)?.module || '').trim()
  const tr = String((options as any)?.timeRange || '').trim().toUpperCase()
  const tf = String((options as any)?.timeField || '').trim().toUpperCase()

  if (module) {
    if (!BASE_MODULES.some((m) => m.code === module) && !extraModules.value.some((m) => m.code === module)) {
      extraModules.value = [...extraModules.value, { code: module, name: module }]
    }
    activeModule.value = module
  }

  if (tr === 'TODAY' || tr === 'WEEK' || tr === 'ALL') {
    activeTimeRange.value = tr as TimeRange
  }

  if (tf === 'CREATED' || tf === 'UPDATED') {
    activeTimeField.value = tf as TimeField
  }

  refreshTimeWindow()
})

const filteredDemands = computed(() => {
  const nowTs = Date.now()
  const startTs = timeStartTs.value

  const normalizeModuleKeys = (mUp: string): string[] => {
    const base = String(mUp || '').trim().toUpperCase()
    if (!base) return []
    const code = normalizeSapModuleToken(base)
    if (code) return [code]
    if (base.includes('/')) {
      const parts = base
        .split('/')
        .map((x) => String(x || '').trim().toUpperCase())
        .filter(Boolean)
      const codes = parts.map((p) => normalizeSapModuleToken(p)).filter(Boolean)
      return Array.from(new Set([...codes, base]))
    }
    return [base]
  }

  const list = allDemands.value.filter((d) => {
    const m = String(activeModule.value || '').trim()
    const mUp = m.toUpperCase()
    const keys = normalizeModuleKeys(mUp)
    const codesUp = (d.module_codes || []).map((x) => String(x || '').trim().toUpperCase()).filter(Boolean)
    const labelsUp = (d.module_labels || []).map((x) => String(x || '').trim().toUpperCase()).filter(Boolean)

    const byModule =
      mUp === 'ALL' ||
      keys.some((k) => codesUp.includes(k) || labelsUp.includes(k))

    const pickTs = (card: any): number | null => {
      const updated = parseCreatedAtTs(card?.updatedAt)
      const created = parseCreatedAtTs(card?.createdAt)
      if (activeTimeField.value === 'UPDATED') return updated !== null ? updated : created
      return created
    }

    const ts = pickTs(d as any)
    const byTime =
      activeTimeRange.value === 'ALL' ||
      (ts !== null && startTs !== null && ts >= startTs && ts <= nowTs)

    const byCity =
      activeCity.value === '全部' || d.city === activeCity.value

    const byRemote =
      activeRemoteMode.value === 'ALL' ||
      (activeRemoteMode.value === 'REMOTE' && d.is_remote === true) ||
      (activeRemoteMode.value === 'ONSITE' && d.is_remote === false)

    const byYears =
      activeYearRange.value === 'ALL' ||
      (d.years_bucket && d.years_bucket === activeYearRange.value)

    const byDuration =
      activeDurationRange.value === 'ALL' ||
      (d.duration_bucket && d.duration_bucket === activeDurationRange.value)

    let byLang = true
    if (activeLanguage.value === 'EN') byLang = d.language === '英语'
    else if (activeLanguage.value === 'JP') byLang = d.language === '日语'

    const byCooperation = (() => {
      const active = String(activeCooperationMode.value || '').trim()
      if (!active || active === 'ALL') return true
      const val = String(d.cooperation_mode || '').trim()
      if (!val) return false
      if (active === '入职') return val === '入职' || val === '甲方入职' || val === '乙方入职'
      return val === active
    })()

    // 搜索过滤
    let bySearch = true
    if (searchKeyword.value.trim()) {
      const keyword = searchKeyword.value.trim().toLowerCase()
      const searchText = (
        String(d.raw_text || '') +
        ' ' +
        String((d.module_labels || []).join(' ') || '') +
        ' ' +
        String((d.module_codes || []).join(' ') || '') +
        ' ' +
        String(d.city || '') +
        ' ' +
        String(d.duration_text || '') +
        ' ' +
        String(d.years_text || '') +
        ' ' +
        String(d.language || '') +
        ' ' +
        String(d.cooperation_mode || '')
      ).toLowerCase()
      bySearch = searchText.includes(keyword)
    }

    return byModule && byTime && byCity && byRemote && byYears && byDuration && byLang && byCooperation && bySearch
  })

  const pickSortTs = (card: any): number => {
    const updated = parseCreatedAtTs(card?.updatedAt)
    const created = parseCreatedAtTs(card?.createdAt)
    if (activeTimeField.value === 'UPDATED') return updated !== null ? updated : created || 0
    return created || 0
  }

  return list.slice().sort((a, b) => pickSortTs(b as any) - pickSortTs(a as any))
});

// 搜索处理
const handleSearch = (e?: any) => {
  const v = e && e.detail && typeof e.detail.value !== 'undefined' ? e.detail.value : undefined
  if (typeof v !== 'undefined') {
    searchKeyword.value = String(v)
  }
}

const triggerSearch = () => {
  try {
    uni.hideKeyboard()
  } catch {
    return
  }
}

// 清除搜索
const clearSearch = () => {
  searchKeyword.value = ''
}

const setModule = (code: string) => {
  activeModule.value = code;
};

const setTimeRange = (val: TimeRange) => {
  activeTimeRange.value = val
}

const setTimeField = (val: TimeField) => {
  activeTimeField.value = val
}

const setCity = (city: string) => {
  activeCity.value = city;
};

const setRemoteMode = (val: 'ALL' | 'REMOTE' | 'ONSITE') => {
  activeRemoteMode.value = val
}

const setCooperationMode = (val: CooperationModeOpt) => {
  activeCooperationMode.value = val
}

const setYearRange = (val: 'ALL' | '0-3' | '4-6' | '7-10' | '10+') => {
  activeYearRange.value = val
}

const setDurationRange = (val: 'ALL' | 'SHORT' | 'MID' | 'LONG') => {
  activeDurationRange.value = val
}

const setLanguage = (val: 'ALL' | 'EN' | 'JP') => {
  activeLanguage.value = val
}

const goDetail = (card: DemandCard) => {
  const uid = encodeURIComponent(String(card.id || '').trim())
  const suffix = uid ? `?uniqueId=${uid}` : ''
  uni.navigateTo({ url: `/pages/demand/detail${suffix}` })
}

// 列表页评论点赞/踩（与详情页保持同样的“一人一次，可取消/切换”规则）
const reactOnListComment = async (
  item: {
    _id?: string
    demand_id: string
    content: string
    likes: number
    dislikes: number
    createdAtText: string
  },
  field: 'likes' | 'dislikes',
) => {
  if (!item._id) return
  try {
    const r: any = await ugcReactionToggle({
      demand_id: String(item.demand_id || '').trim(),
      comment_id: String(item._id || '').trim(),
      field,
    })
    const ok = r && r.success
    if (!ok) {
      const err = String((r && r.error) || 'REACTION_FAILED')
      if (err === 'TOO_FREQUENT') {
        uni.showToast({ title: '操作太频繁，请稍后再试', icon: 'none' })
        return
      }
      uni.showToast({ title: '操作失败', icon: 'none' })
      return
    }

    await loadCommentsForDemands()
  } catch (e) {
    console.error('Failed to update like/dislike on list:', e)
  }
}

const goToDetailFromComment = (demandId: string) => {
  if (!demandId) return
  const uid = encodeURIComponent(String(demandId || '').trim())
  uni.navigateTo({ url: `/pages/demand/detail?uniqueId=${uid}` })
}

const goToPublish = async () => {
  try {
    await requireNonGuest()
    uni.navigateTo({ url: '/pages/demand/publish' })
  } catch {
    return
  }
}

const goToAccount = async () => {
  try {
    const state: any = await ensureLogin()
    const user = state && state.user
    if (user && !isGuestUser(user)) {
      uni.navigateTo({ url: '/pages/profile/profile' })
      return
    }
  } catch {}

  uni.navigateTo({ url: '/pages/login/password-login' })
}

// 格式化人天价格显示
const formatDailyRate = (rate: string | undefined): string => {
  if (!rate) return ''
  const num = parseInt(rate)
  if (num >= 1000) {
    const k = (num / 1000).toFixed(1)
    return `${k}K/天`
  }
  return `${num}/天`
}

// 切换列表页收藏状态
const toggleCardFavorite = async (card: DemandCard) => {
  if (!card?.id) return
  if (card.favoriting) return

  card.favoriting = true
  try {
    await requireNonGuest()
    if (card.isFavorited) {
      await removeFavorite(card.id)
      card.isFavorited = false
      uni.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      await addFavorite(card.id)
      card.isFavorited = true
      uni.showToast({ title: '已收藏', icon: 'success' })
    }
  } catch (e) {
    const msg = String((e as any)?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    if (msg.includes('已经收藏')) {
      card.isFavorited = true
      uni.showToast({ title: '已收藏', icon: 'success' })
      return
    }
    if (msg.includes('未收藏')) {
      card.isFavorited = false
      uni.showToast({ title: '已取消收藏', icon: 'none' })
      return
    }
    console.error('Failed to toggle favorite on list:', e)
    uni.showToast({ title: msg || '收藏操作失败', icon: 'none' })
  } finally {
    card.favoriting = false
  }
}

// 状态选项配置
const statusOptions = [
  { value: 'applied', label: '已投递', icon: '📤', confirmMessage: '是否确认已投递？' },
  { value: 'interviewed', label: '已面试', icon: '💼', confirmMessage: '是否确认已面试？' },
  { value: 'onboarded', label: '已到岗', icon: '✅', confirmMessage: '是否确认已到岗？将显示您的账号昵称。' },
  { value: 'closed', label: '已关闭', icon: '🔒', confirmMessage: '是否确认关闭需求？将显示您的账号昵称。' },
]

// 处理列表页状态点击
const handleCardStatusClick = async (card: DemandCard, status: string) => {
  try {
    await requireNonGuest()
    const user = await getOrCreateUserProfile()
    
    const statusOption = statusOptions.find(s => s.value === status)
    if (!statusOption) return
    
    const alreadyMarked = card.userStatuses?.includes(status)
    
    // 取消逻辑
    if (alreadyMarked) {
      if (status === 'onboarded' || status === 'closed') {
        const confirmCancel = await new Promise<boolean>((resolve) => {
          uni.showModal({
            title: '取消状态',
            content: `是否取消“${statusOption.label}”？\n\n您的昵称：${user.nickname || '匿名用户'}`,
            confirmText: '取消标记',
            cancelText: '保留',
            success: (res) => resolve(res.confirm),
            fail: () => resolve(false),
          })
        })
        if (!confirmCancel) return
      }
      
      await unmarkDemandStatus(card.id, status as any, user.uid)
    } else {
      // 仅“已到岗(onboarded)”和“需求关闭(closed)”需要确认
      if (status === 'onboarded' || status === 'closed') {
        const confirm = await new Promise<boolean>((resolve) => {
          uni.showModal({
            title: '确认状态',
            content: `${statusOption.confirmMessage}\n\n您的昵称：${user.nickname || '匿名用户'}`,
            confirmText: '确认',
            cancelText: '取消',
            success: (res) => resolve(res.confirm),
            fail: () => resolve(false),
          })
        })
        
        if (!confirm) return
      }
      
      await markDemandStatus(card.id, status as any, user.nickname || '匿名用户')
    }
    
    // 等待数据库更新
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 刷新该卡片的状态数据
    await refreshCardStatusData(card)
    
    uni.showToast({ title: alreadyMarked ? '状态已取消' : '状态标记成功', icon: 'none' })
  } catch (e: any) {
    console.error('Failed to mark/unmark status:', e)
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    uni.showToast({ title: msg || '标记失败', icon: 'none' })
  }
}

// 处理列表页评价点击
const handleCardReliabilityClick = async (card: DemandCard, reliable: boolean) => {
  try {
    await requireNonGuest()
    const user = await getOrCreateUserProfile()
    
    // 检查是否已评价 -> 同评价则取消
    if (card.userReliability === reliable) {
      await unmarkDemandReliability(card.id, user.uid)
      await new Promise(resolve => setTimeout(resolve, 300))
      await refreshCardReliabilityData(card)
      uni.showToast({ title: '评价已取消', icon: 'none' })
      return
    }
    
    await markDemandReliability(card.id, reliable, user.nickname || '匿名用户')
    
    // 等待数据库更新
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 刷新该卡片的评价数据
    await refreshCardReliabilityData(card)
    
    uni.showToast({ title: reliable ? '已标记为靠谱' : '已标记为不靠谱', icon: 'none' })
  } catch (e: any) {
    console.error('Failed to mark reliability:', e)
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    uni.showToast({ title: msg || '评价失败', icon: 'none' })
  }
}

// 刷新单个卡片的状态数据
const refreshCardStatusData = async (card: DemandCard) => {
  try {
    const counts = await getDemandStatusCounts(card.id)
    card.statusCounts = {
      applied: counts.applied || 0,
      interviewed: counts.interviewed || 0,
      onboarded: counts.onboarded || 0,
      closed: counts.closed || 0,
    }
    
    const user = await getOrCreateUserProfile()
    const userStatusesList = await getUserDemandStatuses(card.id, user.uid)
    card.userStatuses = userStatusesList || []
  } catch (e) {
    console.error('Failed to refresh card status data:', e)
  }
}

// 刷新单个卡片的评价数据
const refreshCardReliabilityData = async (card: DemandCard) => {
  try {
    const counts = await getDemandReliabilityCounts(card.id)
    card.reliabilityCounts = {
      reliable: counts.reliable || 0,
      unreliable: counts.unreliable || 0,
    }
    
    const user = await getOrCreateUserProfile()
    const userRel = await getUserDemandReliability(card.id, user.uid)
    card.userReliability = userRel
  } catch (e) {
    console.error('Failed to refresh card reliability data:', e)
  }
}

// 刷新所有需求的标签
const handleRefreshTags = async () => {
  if (refreshingTags.value) return
  
  const confirm = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '刷新需求标签',
      content: '将使用新的识别规则重新解析近90天需求的标签（地区、人天价格等）。\n\n此操作可能需要一些时间，是否继续？',
      confirmText: '开始刷新',
      cancelText: '取消',
      success: (res) => {
        resolve(res.confirm)
      },
      fail: () => {
        resolve(false)
      },
    })
  })
  
  if (!confirm) return
  
  refreshingTags.value = true
  
  try {
    uni.showLoading({
      title: '正在刷新标签...',
      mask: true,
    })
    
    const result = await refreshAllDemandsTags()
    
    uni.hideLoading()
    
    let message = `刷新完成：成功 ${result.success} 条`
    if (result.failed > 0) {
      message += `，失败 ${result.failed} 条`
    }
    
    uni.showToast({
      title: message,
      icon: result.failed > 0 ? 'none' : 'success',
      duration: 3000,
    })
    
    // 刷新列表
    await loadFromCloud()
  } catch (e: any) {
    uni.hideLoading()
    console.error('Failed to refresh tags:', e)
    uni.showToast({
      title: e?.message || 'Failed to refresh tags',
      icon: 'none',
    })
  } finally {
    refreshingTags.value = false
  }
}
</script>

<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16rpx 24rpx 24rpx;
  background: linear-gradient(135deg, #0b1924 0%, #1b2a38 45%, #101820 100%);
}

.page-header {
  padding: 24rpx 8rpx 8rpx;
  color: #f5f5f5;
}

.page-title-row {
  flex-direction: row;
  align-items: center;
  display: flex;
  margin-bottom: 8rpx;
  justify-content: space-between;
}

.header-actions {
  display: flex;
  align-items: center;
}

.icon-btn {
  width: 56rpx;
  height: 56rpx;
  border-radius: 999rpx;
  background: rgba(245, 241, 232, 0.10);
  border: 2rpx solid rgba(245, 241, 232, 0.16);
  margin-left: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.refresh-btn {
  padding: 12rpx 24rpx;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  border-radius: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(59, 130, 246, 0.3);
  margin-right: 12rpx;
}

.refresh-btn--loading {
  opacity: 0.7;
  background: rgba(59, 130, 246, 0.5);
}

.refresh-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.publish-btn {
  padding: 12rpx 24rpx;
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  border-radius: 20rpx;
  box-shadow: 0 4rpx 12rpx rgba(76, 175, 80, 0.3);
}

.publish-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  border-width: 2rpx;
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.18);
  margin-right: 12rpx;
  color: #f8f3e6;
}

.page-title {
  font-size: 36rpx;
  font-weight: 700;
  letter-spacing: 1rpx;
  color: #fdf9f0;
}

.page-subtitle {
  font-size: 24rpx;
  color: #c5d0dd;
  margin-top: 4rpx;
}

.search-box {
  position: relative;
  margin: 16rpx 0;
  padding: 0 20rpx;
  z-index: 9999;
  pointer-events: auto;
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.search-input {
  flex: 1;
  width: auto;
  padding: 20rpx 72rpx 20rpx 24rpx;
  background: rgba(255, 255, 255, 0.1);
  border: 1rpx solid rgba(244, 162, 89, 0.65);
  border-radius: 24rpx;
  font-size: 26rpx;
  color: #e4edf7;
  box-sizing: border-box;
  pointer-events: auto;
}

.search-input:focus {
  border-color: #f4a259;
}

.search-input :deep(input),
.search-input :deep(.uni-input-input) {
  width: 100%;
  height: 100%;
  min-height: 44rpx;
  pointer-events: auto;
  background: transparent;
  border: 0;
  outline: none;
  color: inherit;
}

.search-input :deep(.uni-input-placeholder) {
  color: #94a3b8;
}

.search-action {
  position: relative;
  height: 44rpx;
  padding: 0 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 18rpx;
  background: rgba(59, 130, 246, 0.25);
  border: 1rpx solid rgba(59, 130, 246, 0.45);
  z-index: 3;
  pointer-events: auto;
}

.search-action-text {
  font-size: 22rpx;
  color: #bfdbfe;
  font-weight: 600;
}

.search-input::placeholder {
  color: #94a3b8;
}

.search-clear {
  position: absolute;
  right: 160rpx;
  top: 50%;
  transform: translateY(-50%);
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  z-index: 2;
  pointer-events: auto;
}

.search-clear-text {
  font-size: 24rpx;
  color: #e4edf7;
  font-weight: bold;
}

.filter-strip {
  margin-top: 16rpx;
  padding: 12rpx 0;
  border-radius: 18rpx;
  background-color: rgba(10, 16, 25, 0.9);
  box-shadow: 0 16rpx 40rpx rgba(0, 0, 0, 0.45);
  white-space: nowrap;
  position: relative;
  z-index: 1;
}

.card-comments-strip {
  margin-top: 10rpx;
}

.card-comments-list {
  flex-direction: row;
  display: flex;
}

.card-comment-pill {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  padding: 6rpx 14rpx;
  margin-right: 12rpx;
  border-radius: 999rpx;
  background-color: rgba(15, 23, 42, 0.9);
}

.card-comment-likes {
  font-size: 20rpx;
  color: #fbbf24;
  margin-right: 8rpx;
}

.card-comment-dislikes {
  font-size: 20rpx;
  color: #f97373;
  margin-right: 8rpx;
}

.card-comment-text {
  font-size: 20rpx;
  color: #e5e7eb;
  max-width: 440rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-group {
  display: inline-flex;
  align-items: center;
  margin-left: 24rpx;
}

.filter-label {
  font-size: 22rpx;
  color: #8fa2ba;
  margin-right: 12rpx;
}

.filter-chips {
  flex-direction: row;
  display: flex;
}

.filter-chips.tight .chip {
  margin-right: 8rpx;
}

.chip {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
  background-color: rgba(25, 58, 86, 0.9);
  margin-right: 12rpx;
}

.chip--active {
  background: linear-gradient(135deg, #ff6b35 0%, #f4a259 100%);
}

.chip--ghost {
  background-color: transparent;
  border-width: 2rpx;
  border-style: solid;
  border-color: rgba(143, 162, 186, 0.55);
}

.chip--active-ghost {
  border-color: #f4a259;
  background-color: rgba(244, 162, 89, 0.08);
}

.chip-text {
  font-size: 22rpx;
  color: #edf1f7;
  white-space: nowrap;
}

.card-list {
  flex: 1;
  margin-top: 20rpx;
  position: relative;
  z-index: 0;
}

.demand-card {
  border-radius: 24rpx;
  padding: 20rpx 20rpx 16rpx;
  margin-bottom: 18rpx;
  background: linear-gradient(145deg, #111c28 0%, #141f2c 50%, #0b151f 100%);
  box-shadow:
    0 22rpx 55rpx rgba(0, 0, 0, 0.65),
    0 0 0 1rpx rgba(255, 255, 255, 0.02);
}

.card-raw-text {
  font-size: 24rpx;
  line-height: 1.6;
  color: #e4edf7;
}

.card-tags {
  flex-direction: row;
  flex-wrap: wrap;
  display: flex;
  margin-top: 14rpx;
}

.tag {
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  margin-right: 10rpx;
  margin-bottom: 6rpx;
  background-color: rgba(35, 57, 80, 0.9);
}

.tag--primary {
  background-color: rgba(244, 162, 89, 0.22);
}

.tag--accent {
  background-color: rgba(51, 130, 119, 0.32);
}

.tag--rate {
  background: rgba(34, 197, 94, 0.18);
  border: 1rpx solid rgba(34, 197, 94, 0.35);
  color: #22c55e;
}

.tag--related {
  background: rgba(245, 158, 11, 0.18);
  border: 1rpx solid rgba(245, 158, 11, 0.35);
  color: #f59e0b;
}

.card-status-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
  padding: 8rpx 0;
}

.card-reliability-bar {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
  padding: 8rpx 0;
}

.card-favorite-btn {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60rpx;
  height: 56rpx;
  padding: 0 14rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
}

.card-favorite-btn--active {
  background: rgba(239, 68, 68, 0.18);
  border-color: rgba(239, 68, 68, 0.35);
}

.card-favorite-icon {
  font-size: 26rpx;
}

.card-status-item,
.card-reliability-item {
  display: flex;
  align-items: center;
  padding: 8rpx 16rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 16rpx;
  font-size: 22rpx;
  color: #94a3b8;
  transition: all 0.3s;
}

.card-status-item--active {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #60a5fa;
}

.card-status-item--onboarded.card-status-item--active {
  background: rgba(34, 197, 94, 0.22);
  border-color: #22c55e;
  color: #86efac;
}

.card-status-item--closed.card-status-item--active {
  background: rgba(239, 68, 68, 0.22);
  border-color: #ef4444;
  color: #fecdd3;
}

.guest-disabled {
  opacity: 0.45;
  filter: grayscale(1);
}

.card-reliability-item--active.card-reliability-item--reliable {
  background: rgba(34, 197, 94, 0.2);
  border-color: #22c55e;
  color: #4ade80;
}

.card-reliability-item--active.card-reliability-item--unreliable {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #f87171;
}

.card-status-icon,
.card-reliability-icon {
  margin-right: 6rpx;
  font-size: 24rpx;
}

.card-status-label,
.card-reliability-label {
  margin-right: 4rpx;
  font-size: 22rpx;
}

.card-status-count,
.card-reliability-count {
  font-size: 20rpx;
  color: #94a3b8;
}

.tag text {
  font-size: 20rpx;
  color: #dfe7f1;
}

.tag--rate text {
  color: #ffc107;
  font-weight: 600;
}

.card-footer {
  margin-top: 16rpx;
  padding-top: 12rpx;
  border-top-width: 1rpx;
  border-top-style: dashed;
  border-top-color: rgba(111, 136, 164, 0.6);
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  display: flex;
}

.provider {
  flex-direction: row;
  align-items: center;
  display: flex;
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  margin-right: 14rpx;
  overflow: hidden;
  background: radial-gradient(circle at 30% 20%, #f4a259 0%, #ff6b35 35%, #1b2a38 85%);
  position: relative;
}

.avatar-mask {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 36rpx;
  height: 36rpx;
  border-radius: 12rpx;
  transform: translate(-50%, -50%);
  border-width: 3rpx;
  border-style: solid;
  border-color: rgba(15, 23, 36, 0.9);
  background:
    linear-gradient(135deg, #f5f0e6 0%, #d9e2ec 100%);
}

.provider-text {
  max-width: 380rpx;
}

.provider-name {
  font-size: 22rpx;
  color: #f1f5f9;
}

.provider-meta {
  font-size: 20rpx;
  color: #97a6ba;
  margin-top: 2rpx;
}

.unlock-hint {
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  border-width: 2rpx;
  border-style: solid;
  border-color: rgba(244, 162, 89, 0.6);
  background-color: rgba(244, 162, 89, 0.08);
}

.unlock-hint-text {
   font-size: 20rpx;
   color: #f4a259;
 }

 .similar-hint {
   margin-top: 12rpx;
   padding: 10rpx 16rpx;
   background: rgba(59, 130, 246, 0.15);
   border-radius: 8rpx;
   border: 1rpx solid rgba(59, 130, 246, 0.3);
 }

 .similar-hint-text {
   font-size: 22rpx;
   color: #3b82f6;
   font-weight: 500;
 }
 </style>


