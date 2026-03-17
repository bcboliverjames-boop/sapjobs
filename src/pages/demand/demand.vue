<template>
  <view class="page sap-demand-page">
    <!-- 顶部统一 Header (第一行) -->
    <view class="page-header-unified">
      <view class="page-header-content">
        <view class="header-left" @tap="goBack">
          <uni-icons type="back" size="20" color="#F5F1E8" />
        </view>
        <text class="page-header-title">顾问需求广场</text>
        <view class="header-right"></view>
      </view>
    </view>

    <!-- 操作栏 (第二行) -->
    <view class="action-bar">
      <view class="publish-btn-wrapper" @tap="goToPublish">
        <text class="publish-btn-text">发布需求</text>
      </view>
      <view class="header-right-actions">
        <view v-if="isAdmin" class="refresh-btn" @tap="handleRefreshTags" :class="{ 'refresh-btn--loading': refreshingTags }">
          <text class="refresh-btn-text">{{ refreshingTags ? '刷新中...' : '🔄' }}</text>
        </view>
        <view class="icon-btn" @tap="goToAccount">
          <uni-icons type="person" size="18" color="#0B1924" />
        </view>
      </view>
    </view>

    <!-- 顶部固定区域 -->
    <view class="sticky-header" :class="{ 'sticky-header--folded': isFolded }">
      <!-- A. 搜索与按钮行 -->
      <view class="header-main-row">
        <view class="search-box">
          <input
            class="search-input"
            v-model="searchKeyword"
            type="text"
            placeholder="搜索需求内容..."
            confirm-type="search"
            @confirm="triggerSearch"
          />
          <view v-if="searchKeyword" class="search-clear" @tap="clearSearch">
            <text class="search-clear-text">✕</text>
          </view>
        </view>
        <view class="header-btns">
          <view class="fold-toggle-btn" @tap="toggleFold">
            <text>{{ isFolded ? '展开筛选' : '收起' }}</text>
            <uni-icons :type="isFolded ? 'arrowdown' : 'arrowup'" size="20" color="#FFFFFF" />
          </view>
        </view>
      </view>

      <!-- B. 大面板筛选区 (展开状态) -->
      <view class="filter-panel" v-if="!isFolded">
        <scroll-view scroll-y class="filter-panel-scroll">
          <!-- 模块 -->
          <view class="filter-section">
            <text class="filter-section-label">模块</text>
            <view class="filter-chips">
              <view
                v-for="m in modulesForUi"
                :key="m.code"
                class="panel-chip"
                :class="{ 'panel-chip--active': m.code === activeModule }"
                @tap="setModule(m.code)"
              >
                <text>{{ m.name }}</text>
              </view>
            </view>
          </view>

          <!-- 地区 -->
          <view class="filter-section">
            <text class="filter-section-label">地区</text>
            <view class="filter-chips">
              <view
                v-for="c in cities"
                :key="c"
                class="panel-chip"
                :class="{ 'panel-chip--active': c === activeCity }"
                @tap="setCity(c)"
              >
                <text>{{ c }}</text>
              </view>
            </view>
          </view>

          <!-- 周期 -->
          <view class="filter-section">
            <text class="filter-section-label">周期</text>
            <view class="filter-chips">
              <view
                v-for="d in durationRanges"
                :key="d.value"
                class="panel-chip"
                :class="{ 'panel-chip--active': d.value === activeDurationRange }"
                @tap="setDurationRange(d.value)"
              >
                <text>{{ d.label }}</text>
              </view>
            </view>
          </view>

          <!-- 年限 -->
          <view class="filter-section">
            <text class="filter-section-label">年限</text>
            <view class="filter-chips">
              <view
                v-for="y in yearRanges"
                :key="y.value"
                class="panel-chip"
                :class="{ 'panel-chip--active': y.value === activeYearRange }"
                @tap="setYearRange(y.value)"
              >
                <text>{{ y.label }}</text>
              </view>
            </view>
          </view>

          <!-- 合作方式 -->
          <view class="filter-section">
            <text class="filter-section-label">合作方式</text>
            <view class="filter-chips">
              <view
                v-for="m in cooperationModes"
                :key="m.value"
                class="panel-chip"
                :class="{ 'panel-chip--active': m.value === activeCooperationMode }"
                @tap="setCooperationMode(m.value)"
              >
                <text>{{ m.label }}</text>
              </view>
            </view>
          </view>

          <!-- 远程办公 -->
          <view class="filter-section">
            <text class="filter-section-label">远程/现场</text>
            <view class="filter-chips">
              <view
                v-for="r in remoteModes"
                :key="r.value"
                class="panel-chip"
                :class="{ 'panel-chip--active': r.value === activeRemoteMode }"
                @tap="setRemoteMode(r.value)"
              >
                <text>{{ r.label }}</text>
              </view>
            </view>
          </view>

          <!-- 语言 -->
          <view class="filter-section">
            <text class="filter-section-label">语言</text>
            <view class="filter-chips">
              <view
                v-for="l in languageOptions"
                :key="l.value"
                class="panel-chip"
                :class="{ 'panel-chip--active': l.value === activeLanguage }"
                @tap="setLanguage(l.value)"
              >
                <text>{{ l.label }}</text>
              </view>
            </view>
          </view>

          <!-- 时间范围 -->
          <view class="filter-section">
            <text class="filter-section-label">时间范围</text>
            <view class="filter-chips">
              <view
                v-for="t in timeRanges"
                :key="t.value"
                class="panel-chip"
                :class="{ 'panel-chip--active': t.value === activeTimeRange }"
                @tap="setTimeRange(t.value)"
              >
                <text>{{ t.label }}</text>
              </view>
            </view>
          </view>
        </scroll-view>

        <!-- 面板底部收起按钮 -->
        <view class="panel-footer panel-footer--center">
          <view class="fold-toggle-btn fold-toggle-btn--large" @tap="toggleFold">
            <uni-icons type="arrowup" size="24" color="#FFFFFF" />
          </view>
        </view>
      </view>

      <!-- C. 折叠后的简易行 (显示已选摘要) -->
      <view class="folded-summary" v-if="isFolded" @tap="toggleFold">
        <scroll-view scroll-x class="summary-scroll" show-scrollbar="false">
          <view class="summary-tags">
            <view class="summary-tag">{{ getModuleLabel(activeModule) }}</view>
            <view class="summary-tag">{{ activeCity }}</view>
            <view class="summary-tag">{{ getDurationLabel(activeDurationRange) }}</view>
            <view class="summary-tag">{{ getYearLabel(activeYearRange) }}</view>
            <view class="summary-tag">{{ getCooperationLabel(activeCooperationMode) }}</view>
            <view class="summary-tag">{{ getRemoteLabel(activeRemoteMode) }}</view>
            <view class="summary-tag">{{ getLanguageLabel(activeLanguage) }}</view>
            <view class="summary-tag">{{ getTimeLabel(activeTimeRange) }}</view>
          </view>
        </scroll-view>
      </view>
    </view>

    <!-- 需求卡片列表（使用假数据） -->
    <scroll-view
      class="card-list"
      scroll-y="true"
      :scroll-with-animation="true"
      lower-threshold="120"
      @scroll="handleListScroll"
      @scrolltolower="loadMore"
    >
      <view
        v-for="card in filteredDemands"
        :key="card.id"
        class="demand-card"
        @tap="goDetail(card)"
      >
        <!-- A. 原始信息区 -->
        <view class="card-raw">
          <view class="card-raw-header">
            <text class="card-raw-text">
              {{ card.raw_text }}
            </text>
            <view
              class="card-favorite-btn-inline"
              :class="{ 'card-favorite-btn--active': card.isFavorited, 'guest-disabled': isGuest }"
              @tap.stop="toggleCardFavorite(card)"
            >
              <text class="card-favorite-icon">{{ card.isFavorited ? '❤️' : '🤍' }}</text>
            </view>
          </view>
        </view>

         <!-- B. 结构化标签区 -->
         <view class="tags-grid card-tags">
           <view v-for="m in card.module_labels" :key="m" class="tag-item tag-module">
             <text class="tag-text">{{ m }}</text>
           </view>
           <view v-if="card.city" class="tag-item tag-city">
             <text class="tag-text">📍 {{ card.city }}</text>
           </view>
           <view v-if="card.duration_text" class="tag-item tag-duration">
             <text class="tag-text">⏱️ {{ card.duration_text }}</text>
           </view>
           <view v-if="card.years_text" class="tag-item tag-years">
             <text class="tag-text">🎓 {{ card.years_text }}</text>
           </view>
           <view v-if="card.language" class="tag-item tag-lang">
             <text class="tag-text">🌐 {{ card.language }}</text>
           </view>
           <view v-if="card.daily_rate" class="tag-item tag-rate">
             <text class="tag-text">💰 {{ formatDailyRate(card.daily_rate) }}</text>
           </view>
           <view v-if="card.cooperation_mode" class="tag-item tag-mode">
             <text class="tag-text">🤝 {{ card.cooperation_mode }}</text>
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
             <text
               class="card-status-count"
               :class="{ 'card-status-count--nonzero': (card.statusCounts?.applied || 0) > 0 }"
             >({{ card.statusCounts?.applied || 0 }})</text>
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
             <text
               class="card-status-count"
               :class="{ 'card-status-count--nonzero': (card.statusCounts?.interviewed || 0) > 0 }"
             >({{ card.statusCounts?.interviewed || 0 }})</text>
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
             <text
               class="card-status-count"
               :class="{ 'card-status-count--nonzero': (card.statusCounts?.onboarded || 0) > 0 }"
             >({{ card.statusCounts?.onboarded || 0 }})</text>
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
             <text
               class="card-status-count"
               :class="{ 'card-status-count--nonzero': (card.statusCounts?.closed || 0) > 0 }"
             >({{ card.statusCounts?.closed || 0 }})</text>
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
            <text
              class="card-reliability-count"
              :class="{ 'card-reliability-count--nonzero': (card.reliabilityCounts?.reliable || 0) > 0 }"
            >({{ card.reliabilityCounts?.reliable || 0 }})</text>
          </view>
          <view 
            class="card-reliability-item card-reliability-item--unreliable"
            :class="{ 'card-reliability-item--active': card.userReliability === false, 'guest-disabled': isGuest }"
            @tap.stop="handleCardReliabilityClick(card, false)"
          >
            <text class="card-reliability-icon">👎</text>
            <text class="card-reliability-label">不靠谱</text>
            <text
              class="card-reliability-count"
              :class="{ 'card-reliability-count--nonzero': (card.reliabilityCounts?.unreliable || 0) > 0 }"
            >({{ card.reliabilityCounts?.unreliable || 0 }})</text>
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
           <view class="tag tag--related">
             <text>关联需求数 {{ card.relatedCount }}</text>
           </view>
         </view>

         <!-- C. 信息提供者 + 联系方式解锁占位 -->
      </view>

      <view class="list-footer" v-if="loadingMore || !hasMore">
        <text v-if="loadingMore" class="list-footer-text">加载中...</text>
        <text v-else class="list-footer-text">没有更多了</text>
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
import { getSapModuleOptionsForUi, normalizeSapModuleToken, sapModuleCodeToLabel } from '../../utils/sap-modules'
import { getRewardPoints } from '../../utils/points-config'
import {
  markDemandStatus,
  unmarkDemandStatus,
  getDemandStatusCounts,
  getUserDemandStatuses,
  markDemandReliability,
  unmarkDemandReliability,
  getDemandReliabilityCounts,
  getUserDemandReliability,
  statusOptions,
} from '../../utils/demand-status'
import { getOrCreateUserProfile, updateUserProfile } from '../../utils/user'
import { ugcReactionToggle } from '../../utils/ugc'
import { isAdminUid } from '../../utils/admin'
import { safeNavigateBack } from '../../utils'

function getApiBase(): string {
  const fromEnv =
    (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
  if (fromEnv) return String(fromEnv)

  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) return 'https://api.sapboss.com'
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
  title: string;
  rawText: string;
  tags: string[];
  createdAt?: any;
  updatedAt?: any;
  raw?: any;
  raw_text?: string;
  canonical_raw_id?: string;
  city?: string;
  module_codes?: string[];
  module_labels?: string[];
  duration_text: string;
  years_text: string;
  language: string;
  daily_rate: string;
  richness_score?: number;
  is_remote: boolean | null;
  cooperation_mode: string;
  years_bucket: '' | '0-3' | '4-6' | '7-10' | '10+';
  duration_bucket: '' | 'SHORT' | 'MID' | 'LONG';
  extra_tags: string[];
  provider_name: string;
  relatedCount?: number;
  similarCount?: number; // 相似需求数量
  similarDemands?: Array<{ // 折叠的相似需求列表
    id?: string;
    raw_text?: string;
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
  statusCountsUpdatedAt?: number;
  reliabilityCounts?: {
    reliable: number;
    unreliable: number;
  };
  reliabilityCountsUpdatedAt?: number;
  userStatuses?: string[]; // 当前用户已标记的状态
  userReliability?: boolean | null; // 当前用户的评价
  reliabilityBusy?: boolean;
  statusBusy?: boolean;
  isFavorited?: boolean;
  favoriting?: boolean;
};

const RELIABILITY_OVERRIDE_TTL_MS = 600_000
const reliabilityOverrideCache: Map<string, { value: boolean | null; ts: number }> = new Map()

const RELIABILITY_OVERRIDE_STORAGE_PREFIX = 'sapjobs_reliability_override_v1:'
const RELIABILITY_TOUCHED_STORAGE_KEY = 'sapjobs_reliability_touched_v1'
const STATUS_TOUCHED_STORAGE_KEY = 'sapjobs_status_touched_v1'

const storageSet = (key: string, value: any) => {
  try {
    if (typeof uni !== 'undefined' && (uni as any).setStorageSync) {
      ;(uni as any).setStorageSync(key, value)
      return
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && (window as any).localStorage) {
      ;(window as any).localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {}
}

const touchReliabilityDemandId = (id: string) => {
  const key = String(id || '').trim()
  if (!key) return
  try {
    const now = Date.now()
    const raw = storageGet(RELIABILITY_TOUCHED_STORAGE_KEY)
    const list = Array.isArray(raw?.ids) ? raw.ids : []
    const next = [key, ...list.filter((x: any) => String(x || '').trim() && String(x || '').trim() !== key)].slice(0, 50)
    storageSet(RELIABILITY_TOUCHED_STORAGE_KEY, { ts: now, ids: next })
  } catch {}
}

const getTouchedReliabilityDemandIds = (): string[] => {
  try {
    const raw = storageGet(RELIABILITY_TOUCHED_STORAGE_KEY)
    if (!raw) return []
    const ts = Number(raw.ts || 0)
    if (!ts || Date.now() - ts > RELIABILITY_OVERRIDE_TTL_MS) {
      storageRemove(RELIABILITY_TOUCHED_STORAGE_KEY)
      return []
    }
    const ids = Array.isArray(raw.ids) ? raw.ids : []
    return ids.map((x: any) => String(x || '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

const getTouchedReliabilityTs = (): number => {
  try {
    const raw = storageGet(RELIABILITY_TOUCHED_STORAGE_KEY)
    const ts = Number(raw?.ts || 0)
    return Number.isFinite(ts) ? ts : 0
  } catch {
    return 0
  }
}

const touchStatusDemandId = (id: string) => {
  const key = String(id || '').trim()
  if (!key) return
  try {
    const now = Date.now()
    const raw = storageGet(STATUS_TOUCHED_STORAGE_KEY)
    const list = Array.isArray(raw?.ids) ? raw.ids : []
    const next = [key, ...list.filter((x: any) => String(x || '').trim() && String(x || '').trim() !== key)].slice(0, 50)
    storageSet(STATUS_TOUCHED_STORAGE_KEY, { ts: now, ids: next })
  } catch {}
}

const getTouchedStatusDemandIds = (): string[] => {
  try {
    const raw = storageGet(STATUS_TOUCHED_STORAGE_KEY)
    if (!raw) return []
    const ts = Number(raw.ts || 0)
    if (!ts || Date.now() - ts > STATUS_OVERRIDE_TTL_MS) {
      storageRemove(STATUS_TOUCHED_STORAGE_KEY)
      return []
    }
    const ids = Array.isArray(raw.ids) ? raw.ids : []
    return ids.map((x: any) => String(x || '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

const storageGet = (key: string): any => {
  try {
    if (typeof uni !== 'undefined' && (uni as any).getStorageSync) {
      return (uni as any).getStorageSync(key)
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && (window as any).localStorage) {
      const raw = (window as any).localStorage.getItem(key)
      if (!raw) return undefined
      return JSON.parse(raw)
    }
  } catch {}
  return undefined
}

const storageRemove = (key: string) => {
  try {
    if (typeof uni !== 'undefined' && (uni as any).removeStorageSync) {
      ;(uni as any).removeStorageSync(key)
      return
    }
  } catch {}
  try {
    if (typeof window !== 'undefined' && (window as any).localStorage) {
      ;(window as any).localStorage.removeItem(key)
    }
  } catch {}
}

const STATUS_OVERRIDE_TTL_MS = 120_000
const statusOverrideCache: Map<string, { value: string[]; ts: number }> = new Map()

const getInteractionId = (card: DemandCard | null | undefined): string => {
  if (!card) return ''
  const raw = String((card as any).canonical_raw_id || '').trim()
  return raw || String(card.id || '').trim()
}

const setReliabilityOverride = (id: string, value: boolean | null) => {
  const key = String(id || '').trim()
  if (!key) return
  const payload = { value, ts: Date.now() }
  reliabilityOverrideCache.set(key, payload)
  storageSet(`${RELIABILITY_OVERRIDE_STORAGE_PREFIX}${key}`, payload)
  touchReliabilityDemandId(key)
}

const getReliabilityOverride = (id: string): boolean | null | undefined => {
  const key = String(id || '').trim()
  if (!key) return undefined
  const now = Date.now()
  const hit = reliabilityOverrideCache.get(key)
  if (hit) {
    if (now - hit.ts > RELIABILITY_OVERRIDE_TTL_MS) {
      reliabilityOverrideCache.delete(key)
      storageRemove(`${RELIABILITY_OVERRIDE_STORAGE_PREFIX}${key}`)
      return undefined
    }
    return hit.value
  }

  const stored = storageGet(`${RELIABILITY_OVERRIDE_STORAGE_PREFIX}${key}`)
  if (!stored) return undefined
  const ts = Number(stored.ts || 0)
  if (!ts || now - ts > RELIABILITY_OVERRIDE_TTL_MS) {
    storageRemove(`${RELIABILITY_OVERRIDE_STORAGE_PREFIX}${key}`)
    return undefined
  }
  const value = stored.value === true ? true : stored.value === false ? false : null
  reliabilityOverrideCache.set(key, { value, ts })
  return value
}

const setStatusOverride = (id: string, value: string[]) => {
  const key = String(id || '').trim()
  if (!key) return
  statusOverrideCache.set(key, { value: Array.isArray(value) ? value.slice() : [], ts: Date.now() })
}

const getStatusOverride = (id: string): string[] | undefined => {
  const key = String(id || '').trim()
  if (!key) return undefined
  const hit = statusOverrideCache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.ts > STATUS_OVERRIDE_TTL_MS) {
    statusOverrideCache.delete(key)
    return undefined
  }
  return hit.value
}

const BASE_MODULES = [{ code: 'ALL', name: '全部' }, ...getSapModuleOptionsForUi({ includeOther: false })]

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

const loading = ref(true)
const allDemands = ref<DemandCard[]>([])
const cities = ref<string[]>(['全部'])

const updateDynamicCities = () => {
  const freq = new Map<string, number>()
  const add = (name: string) => {
    const k = String(name || '').trim()
    if (!k) return
    freq.set(k, (freq.get(k) || 0) + 1)
  }

  // 从当前加载的所有需求中提取城市标签
  allDemands.value.forEach((card) => {
    const raw = String(card.city || '').trim()
    if (!raw) return
    if (raw.includes('/')) {
      raw
        .split('/')
        .map((x) => String(x || '').trim())
        .filter(Boolean)
        .forEach((x) => add(x))
      return
    }
    add(raw)
  })

  const specials = ['全国', '远程', '海外', '欧洲', '菲律宾']
  const all = Array.from(freq.keys()).filter((x) => x !== '全部')
  const sorted = all
    .slice()
    .sort((a, b) => {
      const aSpecial = specials.includes(a)
      const bSpecial = specials.includes(b)
      if (aSpecial && !bSpecial) return -1
      if (!aSpecial && bSpecial) return 1
      const fa = freq.get(a) || 0
      const fb = freq.get(b) || 0
      if (fb !== fa) return fb - fa
      return a.localeCompare(b, 'zh-Hans-CN')
    })

  cities.value = ['全部', ...sorted]

  if (!cities.value.includes(String(activeCity.value || '').trim())) {
    activeCity.value = '全部'
  }
}

// 监听数据变化更新城市列表
watch(allDemands, () => {
  updateDynamicCities()
}, { deep: true })

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

const isFolded = ref(false)
const lastScrollTop = ref(0)

const toggleFold = () => {
  isFolded.value = !isFolded.value
}

const getModuleLabel = (code: string) => {
  const found = modulesForUi.value.find(m => m.code === code)
  return found ? found.name : '全部模块'
}

const getYearLabel = (value: string) => {
  const found = yearRanges.find(y => y.value === value)
  return found ? found.label : '全部年限'
}

const getCooperationLabel = (value: string) => {
  const found = cooperationModes.value.find(m => m.value === value)
  return found ? found.label : '全部合作'
}

const getDurationLabel = (value: string) => {
  const found = durationRanges.find(d => d.value === value)
  return found ? found.label : '全部周期'
}

const getTimeLabel = (value: string) => {
  const found = timeRanges.find(t => t.value === value)
  return found ? found.label : '全部时间'
}

const getLanguageLabel = (value: string) => {
  const found = languageOptions.find(l => l.value === value)
  return found ? found.label : '全部语言'
}

const getRemoteLabel = (value: string) => {
  const found = remoteModes.find(r => r.value === value)
  return found ? found.label : '远程/现场'
}

const handleListScroll = (e: any) => {
  const detail = (e && (e.detail || e.target)) || {}
  const scrollTop = Number(detail.scrollTop || 0)
  const clientHeight = Number(detail.clientHeight || detail.offsetHeight || 0)
  const scrollHeight = Number(detail.scrollHeight || 0)
  const nearBottom = scrollHeight - clientHeight - scrollTop < 200

  // A. 处理筛选面板折叠逻辑
  // 向上滚动超过 50px 且当前是展开状态，则折叠
  if (scrollTop > 50 && scrollTop > lastScrollTop.value && !isFolded.value) {
    isFolded.value = true
  }
  // 向下滚动（回到顶部）则自动展开
  if (scrollTop < 20 && isFolded.value) {
    isFolded.value = false
  }
  lastScrollTop.value = scrollTop

  // B. 处理瀑布流加载逻辑
  // H5 下 scrolltolower 在部分情况下不触发，这里做兜底：接近底部时主动触发 loadMore
  if (!hasMore.value) return
  if (loading.value || loadingMore.value) return

  if (!scrollHeight || !clientHeight) return

  if (!nearBottom) return

  const now = Date.now()
  if (now - lastNearBottomTriggerAt.value < 1200) return
  lastNearBottomTriggerAt.value = now
  loadMore()
}

const nextOffset = ref(0)
const loadingMore = ref(false)
const hasMore = ref(true)
const pageSize = 80
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

const isLocalhostRuntime = (): boolean => {
  try {
    if (typeof window === 'undefined') return false
    const host = String((window as any).location && (window as any).location.hostname)
    return /^(localhost|127\.0\.0\.1)$/i.test(host)
  } catch {
    return false
  }
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

const isLocationLikeTag = (raw: string): boolean => {
  const s = String(raw || '').trim()
  if (!s) return false
  if (normalizeSapModuleToken(s)) return false
  if (s === '全国' || s === '远程' || s === '海外' || s === '欧洲' || s === '菲律宾') return true
  if (/[\u4e00-\u9fa5]{2,6}/.test(s) && /(?:市|区|县|州|盟|旗)$/.test(s)) return true
  if (/^[\u4e00-\u9fa5]{2,4}$/.test(s)) return true
  return false
}

const safeJsonArray = (v: any): string[] => {
  if (!v) return []
  if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean)
  try {
    const obj = typeof v === 'string' ? JSON.parse(v) : v
    if (!Array.isArray(obj)) return []
    return obj.map((x) => String(x || '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

const isBucketLikeTag = (tag: string): boolean => {
  const t = String(tag || '').trim().toUpperCase()
  if (!t) return false
  if (t === 'LONG' || t === 'MID' || t === 'SHORT') return true
  if (/^\d{1,2}-\d{1,2}$/.test(t)) return true
  if (t === '10+' || t === '10年以上' || t === '8年以上') return true
  return false
}

const sanitizeExtraTags = (tags: string[]): string[] => {
  const raw = Array.isArray(tags) ? tags : []
  const out: string[] = []
  for (const it of raw) {
    const s = String(it || '').trim()
    if (!s) continue
    if (isBucketLikeTag(s)) continue
    if (out.includes(s)) continue
    out.push(s)
    if (out.length >= 6) break
  }
  return out
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
  const hit: string[] = []
  for (const t of tags) {
    const k = String(t || '').trim()
    if (!k) continue
    if (LOCATION_SET.has(k) || isLocationLikeTag(k)) {
      if (!hit.includes(k)) hit.push(k)
      if (hit.length >= 4) break
    }
  }
  return hit.join('/')
}

const computeLocalRichnessScore = (rawText: string, base: any): number => {
  try {
    const raw = String(rawText || '').trim()
    const parsed = parseDemandText(raw)
    const moduleCodes = Array.isArray(parsed?.module_codes) ? parsed.module_codes : []
    const city = String((base && base.city) || parsed?.city || '').trim()
    const duration = String((base && base.duration_text) || parsed?.duration_text || '').trim()
    const years = String((base && base.years_text) || parsed?.years_text || '').trim()
    const lang = String((base && base.language) || parsed?.language || '').trim()
    const rate = String((base && (base.daily_rate || base.daily_rate_text)) || parsed?.daily_rate || '').trim()
    const coop = String((base && base.cooperation_mode) || '').trim()
    const remote = (base && typeof base.is_remote === 'boolean') ? base.is_remote : parsed?.is_remote

    let score = 0
    if (raw.length >= 30) score += 10
    if (raw.length >= 60) score += 10
    if (moduleCodes.length > 0) score += 20
    if (city) score += 10
    if (duration) score += 10
    if (years) score += 10
    if (lang) score += 10
    if (rate) score += 10
    if (coop) score += 5
    if (remote === true || remote === false) score += 5

    return Math.max(0, Math.min(100, Math.round(score)))
  } catch {
    return 0
  }
}

const extractCityFromRawText = (rawText: string): string => {
  const text = String(rawText || '').trim()
  if (!text) return ''
  if (/菲律宾|philippines/i.test(text)) return '菲律宾'
  if (/欧洲|europe/i.test(text)) return '欧洲'
  if (/海外|overseas|国外/i.test(text)) return '海外'

  // 优先使用内置解析器（支持多城市/省份）
  try {
    const parsed = parseDemandText(text)
    const c = String(parsed?.city || '').trim()
    if (c) return c
  } catch {
    // ignore
  }

  // 高概率位置：模块括号后紧跟城市，如 “【WM】宁德 5年以上 ...”
  try {
    const m1 = text.match(/】([\u4e00-\u9fa5]{2,4})(?=\s|\d|[\u4e00-\u9fa5])/)
    if (m1 && m1[1]) {
      const cand = String(m1[1]).trim()
      if (cand && isLocationLikeTag(cand)) return cand
    }
  } catch {}

  // 关键词提示：地点/地区/城市
  try {
    const m2 = text.match(/(?:地点|地区|城市)[:：\s]*([\u4e00-\u9fa5]{2,6})/)
    if (m2 && m2[1]) {
      const cand = String(m2[1]).trim().replace(/(市|区|县|州|盟|旗)$/, '')
      if (cand && isLocationLikeTag(cand)) return cand
    }
  } catch {}

  // 兜底：扫描国内城市/地区关键词（避免仅靠 tags/attrs 导致“合肥”等丢失）
  for (const k of LOCATION_KEYWORDS) {
    if (!k) continue
    if (text.includes(k)) return k
  }

  // 进一步兜底：识别“xx市/xx区/xx县/xx州”等尾缀城市
  try {
    const m = text.match(/(?:^|[\s,，。/\\\[\]（）()])([\u4e00-\u9fa5]{2,4})(?:市|区|县|州|盟|旗)/)
    if (m && m[1]) return String(m[1]).trim()
  } catch {}
  return ''
}

const toModuleLabel = (code: string): string => sapModuleCodeToLabel(code)

const deriveYearsBucket = (yearsText: string): '' | '0-3' | '4-6' | '7-10' | '10+' => {
  const s = String(yearsText || '').trim()
  if (!s) return ''
  if (/不限|无要求|不限年限/i.test(s)) return ''
  const nums = s
    .replace(/年以上/g, '+')
    .match(/\d+(?:\.\d+)?/g)
    ?.map((x) => Number(x))
    .filter((n) => Number.isFinite(n))
  if (!nums || !nums.length) return ''
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  if (s.includes('+') || /以上/.test(s)) {
    if (min >= 10) return '10+'
    if (min >= 7) return '7-10'
    if (min >= 4) return '4-6'
    return '0-3'
  }
  if (/\d+\s*[-~至到]\s*\d+/.test(s) || nums.length >= 2) {
    if (max <= 3) return '0-3'
    if (min >= 4 && max <= 6) return '4-6'
    if (min >= 7 && max <= 10) return '7-10'
    if (min >= 10) return '10+'
    if (max <= 6) return '4-6'
    if (max <= 10) return '7-10'
    return '10+'
  }
  const n = nums[0]
  if (n <= 3) return '0-3'
  if (n <= 6) return '4-6'
  if (n <= 10) return '7-10'
  return '10+'
}

const deriveDurationBucket = (durationText: string): '' | 'SHORT' | 'MID' | 'LONG' => {
  const s = String(durationText || '').trim()
  if (!s) return ''
  if (/不限|长期|长期稳定/i.test(s)) return 'LONG'
  const nums = s
    .match(/\d+(?:\.\d+)?/g)
    ?.map((x) => Number(x))
    .filter((n) => Number.isFinite(n))
  if (!nums || !nums.length) return ''
  const max = Math.max(...nums)
  if (/天/.test(s)) {
    const days = max
    if (days <= 90) return 'SHORT'
    if (days <= 180) return 'MID'
    return 'LONG'
  }
  const months = max
  if (months <= 3) return 'SHORT'
  if (months <= 6) return 'MID'
  return 'LONG'
}

const normalizeLanguageLabel = (langRaw: string): '' | '英语' | '日语' => {
  const s = String(langRaw || '').trim()
  if (!s) return ''
  if (/日语|japanese|\bjp\b/i.test(s)) return '日语'
  if (/英语|英文|english|\ben\b/i.test(s)) return '英语'
  return ''
}

const normalizeCooperationModeLabel = (coopRaw: string, rawText: string): string => {
  const s = String(coopRaw || '').trim()
  const t = String(rawText || '').trim()
  const src = `${s} ${t}`.toLowerCase()

  if (!s && !t) return ''

  if (/\bfree\b/.test(src) || /自由顾问/.test(src)) return 'FREE'
  if (/甲方入职/.test(src)) return '甲方入职'
  if (/乙方入职/.test(src)) return '乙方入职'
  if (/入职/.test(src)) return '入职'
  if (/兼职/.test(src) || /part[-\s]?time/.test(src)) return '兼职'
  if (/外包/.test(src) || /vendor|outsourc/.test(src)) return '外包'

  // 保留原始值（避免误归类）
  if (s) return /^free$/i.test(s) ? 'FREE' : s
  return ''
}

// 将云端或本地的原始记录映射到页面用的卡片类型
const mapToCard = (item: any, index: number): DemandCard => {
  const city = String(item.city || '').trim()
  const durationText = String(item.duration_text || '').trim()
  const yearsText = String(item.years_text || '').trim()
  const rawText = String(item.raw_text || '').trim()

  const parsed = parseDemandText(rawText)
  const parsedCity = String(parsed?.city || '').trim()
  const parsedDurationText = String(parsed?.duration_text || '').trim()

  const language = normalizeLanguageLabel(String(item.language || ''))
  const cooperation_mode = normalizeCooperationModeLabel(String(item.cooperation_mode || ''), rawText)

  const moduleCodes = (() => {
    const raw = (item as any)?.module_codes
    if (Array.isArray(raw) && raw.length) {
      return raw
        .map((x: any) => String(x || '').trim())
        .map((x: string) => normalizeSapModuleToken(x) || x.toUpperCase())
        .filter(Boolean)
    }

    try {
      const fromUnique = extractModulesFromUnique(item as any)
      if (fromUnique && fromUnique.length) return fromUnique
    } catch {
      // ignore
    }

    const parsed = parseDemandText(rawText)
    const base = (parsed && (parsed as any).module_codes) || []
    return (base || [])
      .map((x: any) => String(x || '').trim())
      .map((x: string) => normalizeSapModuleToken(x) || x.toUpperCase())
      .filter(Boolean)
  })()

  const moduleLabels = moduleCodes.map(toModuleLabel).filter(Boolean)

  const richnessScoreRaw = (item as any)?.richness_score
  const richnessFromBackend = Number.isFinite(Number(richnessScoreRaw)) ? Number(richnessScoreRaw) : 0
  const richness_score = richnessFromBackend > 0 ? richnessFromBackend : computeLocalRichnessScore(rawText, item)

  const isRemote = (() => {
    if (typeof item.is_remote === 'boolean') return item.is_remote
    if (city === '远程' || city === '在家') return true
    if (/远程/i.test(rawText)) return true
    return null
  })()

  const years_bucket: DemandCard['years_bucket'] =
    item.years_bucket === '0-3' || item.years_bucket === '4-6' || item.years_bucket === '7-10' || item.years_bucket === '10+'
      ? item.years_bucket
      : deriveYearsBucket(yearsText)

  const duration_bucket: DemandCard['duration_bucket'] =
    item.duration_bucket === 'SHORT' || item.duration_bucket === 'MID' || item.duration_bucket === 'LONG'
      ? item.duration_bucket
      : deriveDurationBucket(durationText)

  const finalDurationText = (() => {
    if (parsedDurationText && /周期|工期|合同|项目|时长|为期|duration/i.test(rawText)) return parsedDurationText
    return durationText || parsedDurationText
  })()

  const finalCity = (() => {
    // 当解析器识别出多地点（如 北京/西安/重庆），优先使用解析结果
    if (parsedCity && parsedCity.includes('/')) return parsedCity
    return city || parsedCity || extractCityFromRawText(rawText) || extractCityFromUnique(item as any) || ''
  })()

  return {
    id: String((item as any)?._id || (item as any)?.id || (item as any)?.unique_demand_id || index),
    title: String((item as any)?.title || '').trim() || String(rawText || '').trim(),
    rawText,
    tags: [],
    raw_text: rawText,
    canonical_raw_id: String((item as any)?.canonical_raw_id || '').trim() || undefined,
    module_labels: moduleLabels,
    module_codes: moduleCodes,
    city: finalCity,
    duration_text: finalDurationText,
    years_text: yearsText || String((parsed && parsed.years_text) || ''),
    language,
    daily_rate: String(item.daily_rate || '').trim(),
    richness_score,
    is_remote: isRemote,
    cooperation_mode,
    years_bucket: deriveYearsBucket(yearsText),
    duration_bucket: deriveDurationBucket(durationText),
    extra_tags: sanitizeExtraTags(safeJsonArray((item as any)?.extra_tags_json || (item as any)?.extra_tags || [])),
    provider_name: String((item as any)?.provider_name || (item as any)?.publisher_name || '未知'),
    createdAt: (item as any)?.createdAt || (item as any)?.created_time || (item as any)?.message_time || null,
    updatedAt: (item as any)?.updatedAt || (item as any)?.last_updated_time || (item as any)?.updated_at || null,
  }
}

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

function buildQueryString(params: Record<string, string>): string {
  const pairs: string[] = []
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null) return
    pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  })
  return pairs.join('&')
}

const fetchUniqueDemandsPage = async (opts: {
  offset: number
  limit: number
  startTs: number | null
  endTs: number
  field: string
}): Promise<SapUniqueDemandDoc[]> => {
  const base = String(API_BASE).replace(/\/+$/, '')
  const limit = Math.max(1, Math.min(200, opts.limit))
  const offset = Math.max(0, opts.offset)

  if (opts.startTs !== null) {
    const qs = buildQueryString({
      startTs: String(opts.startTs),
      endTs: String(opts.endTs),
      field: String(opts.field),
      order: 'desc',
      onlyValid: '1',
      limit: String(limit),
      offset: String(offset),
    })
    const resp: any = await requestJson({
      url: `${base}/unique_demands/range?${qs}`,
      method: 'GET',
    })
    if (!resp || !resp.ok || !Array.isArray(resp.demands)) {
      throw new Error((resp && resp.error) || 'UNIQUE_DEMANDS_RANGE_FAILED')
    }
    return resp.demands as SapUniqueDemandDoc[]
  }

  const qs = buildQueryString({
    orderBy: String(opts.field),
    order: 'desc',
    onlyValid: '1',
    limit: String(limit),
    offset: String(offset),
  })
  const resp: any = await requestJson({
    url: `${base}/unique_demands/all?${qs}`,
    method: 'GET',
  })
  if (!resp || !resp.ok || !Array.isArray(resp.demands)) {
    throw new Error((resp && resp.error) || 'UNIQUE_DEMANDS_ALL_FAILED')
  }
  return resp.demands as SapUniqueDemandDoc[]
}

const enrichCards = async (cards: DemandCard[]) => {
  const demandIds = cards.map((d) => getInteractionId(d)).filter(Boolean) as string[]
  const statusCountsMap = new Map<string, any>()
  const reliabilityCountsMap = new Map<string, any>()

  const COUNTS_CACHE_TTL_MS = 60_000
  type CachedCounts = { v: any; ts: number }
  const statusCountsCache: Map<string, CachedCounts> = (enrichCards as any)._statusCountsCache || new Map()
  const reliabilityCountsCache: Map<string, CachedCounts> = (enrichCards as any)._reliabilityCountsCache || new Map()
  ;(enrichCards as any)._statusCountsCache = statusCountsCache
  ;(enrichCards as any)._reliabilityCountsCache = reliabilityCountsCache

  const getFresh = (cache: Map<string, CachedCounts>, id: string) => {
    const hit = cache.get(id)
    if (!hit) return undefined
    if (Date.now() - Number(hit.ts || 0) > COUNTS_CACHE_TTL_MS) {
      cache.delete(id)
      return undefined
    }
    return hit.v
  }

  const runInBatches = async (ids: string[], batchSize: number, worker: (id: string) => Promise<void>) => {
    const size = Math.max(1, Math.min(30, batchSize))
    for (let i = 0; i < ids.length; i += size) {
      const chunk = ids.slice(i, i + size)
      await Promise.all(chunk.map((id) => worker(id)))
    }
  }

  if (demandIds.length > 0) {
    demandIds.forEach((id) => {
      const st = getFresh(statusCountsCache, id)
      const rel = getFresh(reliabilityCountsCache, id)
      if (st !== undefined) statusCountsMap.set(id, st)
      if (rel !== undefined) reliabilityCountsMap.set(id, rel)
    })

    const missingIds = demandIds.filter((id) => !statusCountsMap.has(id) || !reliabilityCountsMap.has(id))
    // 不阻塞首屏渲染：后台补齐 counts，且做并发限流（避免 2N 个请求同时起飞）
    runInBatches(missingIds, 8, async (id) => {
      const requestTs = Date.now()
      try {
        const [statusCounts, reliabilityCounts] = await Promise.all([
          getDemandStatusCounts(id),
          getDemandReliabilityCounts(id),
        ])
        statusCountsCache.set(id, { v: statusCounts, ts: requestTs })
        reliabilityCountsCache.set(id, { v: reliabilityCounts, ts: requestTs })
        statusCountsMap.set(id, statusCounts)
        reliabilityCountsMap.set(id, reliabilityCounts)

        const card = cards.find((c) => getInteractionId(c) === id)
        if (card) {
          const lastStatusTs = Number(card.statusCountsUpdatedAt || 0)
          if (lastStatusTs <= requestTs) {
            card.statusCounts = statusCounts
            card.statusCountsUpdatedAt = requestTs
          }
          const lastTs = Number(card.reliabilityCountsUpdatedAt || 0)
          if (lastTs <= requestTs) {
            card.reliabilityCounts = reliabilityCounts
            card.reliabilityCountsUpdatedAt = requestTs
          }
        }
      } catch (e) {
        console.error(`Failed to load status/reliability for demand ${id}:`, e)
        // 不要把“失败”缓存成 0：否则从详情返回/刷新时可能被短暂网络/后端抖动锁死为 0（60s TTL）
        // 这里保持缺省，让下一次 enrich/refresh 有机会重新拉取服务端真实 counts。
        statusCountsCache.delete(id)
        reliabilityCountsCache.delete(id)
        statusCountsMap.delete(id)
        reliabilityCountsMap.delete(id)
      }
    }).catch(() => {})
  }

  let authUid = ''
  try {
    const state: any = await ensureLogin()
    const u = state && state.user
    if (u && !isGuestUser(u)) {
      authUid = String((u as any).uid || '').trim()
    }
  } catch {}

  if (authUid) {
    await Promise.all(
      cards.map(async (card) => {
        const key = getInteractionId(card)
        card.statusCounts = statusCountsMap.get(key) || { applied: 0, interviewed: 0, onboarded: 0, closed: 0 }
        card.reliabilityCounts = reliabilityCountsMap.get(key) || { reliable: 0, unreliable: 0 }
        try {
          const [userStatuses, userReliability] = await Promise.all([
            getUserDemandStatuses(key, authUid),
            getUserDemandReliability(key, authUid),
          ])
          card.userStatuses = userStatuses || []
          const override = getReliabilityOverride(key)
          const normalized = userReliability === true ? true : userReliability === false ? false : null
          card.userReliability = override !== undefined ? override : normalized
        } catch (e) {
          console.error(`Failed to load user status/reliability for demand ${card.id}:`, e)
          card.userStatuses = []
          const override = getReliabilityOverride(key)
          card.userReliability = override !== undefined ? override : null
        }
      })
    )
  } else {
    cards.forEach((card) => {
      const key = getInteractionId(card)
      card.statusCounts = statusCountsMap.get(key) || { applied: 0, interviewed: 0, onboarded: 0, closed: 0 }
      card.reliabilityCounts = reliabilityCountsMap.get(key) || { reliable: 0, unreliable: 0 }
      card.userStatuses = []
      const override = getReliabilityOverride(key)
      card.userReliability = override !== undefined ? override : null
    })
  }

  let favoriteSet = new Set<string>()
  if (authUid && demandIds.length > 0) {
    favoriteSet = await checkFavoritesStatus(demandIds)
  }
  cards.forEach((card) => {
    const key = getInteractionId(card)
    card.isFavorited = favoriteSet.has(key)
    card.favoriting = false
    card.reliabilityBusy = false
  })

  await computeRelatedCounts(cards)
}

const loadCommentsForDemandIds = async (ids: string[]) => {
  try {
    await ensureLogin()
    const uniq = Array.from(new Set(ids.map((x) => String(x || '').trim()).filter(Boolean)))
    if (!uniq.length) return

    const base = String(API_BASE).replace(/\/+$/, '')
    const resp: any = await requestJson({
      url: `${base}/demand_comments`,
      method: 'POST',
      data: {
        demandIds: uniq,
        limit: 200,
      },
    })

    const rows: any[] = resp && resp.ok && Array.isArray(resp.comments) ? resp.comments : []
    const nextMap = { ...(commentsByDemand.value || {}) } as any

    uniq.forEach((id) => {
      nextMap[id] = []
    })

    ;(rows || []).forEach((doc: any) => {
      const dId = doc.demand_id
      if (!dId) return
      if (!nextMap[dId]) nextMap[dId] = []
      if (nextMap[dId].length < 10) {
        nextMap[dId].push({
          _id: doc._id,
          demand_id: dId,
          content: doc.content,
          likes: doc.likes || 0,
          dislikes: doc.dislikes || 0,
          createdAtText: doc.createdAt ? new Date(doc.createdAt).toLocaleDateString('zh-CN') : '',
        })
      }
    })

    commentsByDemand.value = nextMap
  } catch (e) {
    console.error('Failed to load demand comments:', e)
  }
}

const loadFromCloud = async (opts?: { append?: boolean }) => {
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

    const offset = opts?.append ? nextOffset.value : 0
    const docs = await fetchUniqueDemandsPage({
      offset,
      limit: pageSize,
      startTs,
      endTs,
      field,
    })

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
          if (isBucketLikeTag(t)) continue
          if (out.includes(t)) continue
          out.push(t)
          if (out.length >= 6) break
        }
        return sanitizeExtraTags(out)
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
          years_bucket: (yearsBucketFromAttrs === '0-3' || yearsBucketFromAttrs === '4-6' || yearsBucketFromAttrs === '7-10' || yearsBucketFromAttrs === '10+')
            ? (yearsBucketFromAttrs as any)
            : deriveYearsBucket(yearsFromAttrs || parsed.years_text || ''),
          duration_bucket: (durationBucketFromAttrs === 'SHORT' || durationBucketFromAttrs === 'MID' || durationBucketFromAttrs === 'LONG')
            ? (durationBucketFromAttrs as any)
            : deriveDurationBucket(durationFromAttrs || parsed.duration_text || ''),
          extra_tags: extraTags,
          provider_name: (d as any).publisher_name || '未知',
          createdAt,
          updatedAt,
          similarCount: 0,
          similarDemands: [],
        },
        offset + idx
      )
    })

    await enrichCards(cards)

    if (opts?.append) {
      const existing = allDemands.value || []
      allDemands.value = [...existing, ...cards]
    } else {
      allDemands.value = cards
      commentsByDemand.value = {}
    }

    nextOffset.value = offset + cards.length
    hasMore.value = cards.length >= pageSize
    await loadCommentsForDemandIds(cards.map((d) => d.id))
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

const reloadFromCloud = async () => {
  loading.value = true
  nextOffset.value = 0
  hasMore.value = true
  loadingMore.value = false
  await loadFromCloud({ append: false })
}

const loadMore = async () => {
  if (loading.value) return
  if (!hasMore.value) return
  if (loadingMore.value) return
  loadingMore.value = true
  try {
    await loadFromCloud({ append: true })
  } catch {
    // ignore
  } finally {
    loadingMore.value = false
  }
}

const lastNearBottomTriggerAt = ref(0)

const loadCommentsForDemands = async () => {
  try {
    await ensureLogin()
    const ids = allDemands.value.map((d) => d.id).filter(Boolean)
    if (!ids.length) return

    const base = String(API_BASE).replace(/\/+$/, '')
    const resp: any = await requestJson({
      url: `${base}/demand_comments`,
      method: 'POST',
      data: {
        demandIds: ids,
        limit: 200,
      },
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
  reloadFromCloud()

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
    isAdmin.value = isLocalhostRuntime() || isAdminUid(String((state && state.user && (state.user as any).uid) || '').trim())

    // When switching from guest -> logged-in, refresh list so favorites/status become interactive.
    if (prevGuest && !nextGuest) {
      await reloadFromCloud()
    }
  } catch {
    isGuest.value = false
    isAdmin.value = false
  }
}

// 页面显示时刷新数据（从登录/发布页返回时会触发）
onShow(async () => {
  await refreshAuthState()
  // 从详情/个人中心返回时：即使页面被销毁重建，也要刷新一次，避免回到初始态
  await loadFromCloud({ append: false })

  // 强制校准近期交互过的卡片（避免边框/底色/数字被重置）
  const touchedIds = getTouchedReliabilityDemandIds()
  const touchedTs = getTouchedReliabilityTs()

  // 若“详情页”发生了新的评价操作，但列表页仍残留更旧的本地 override，会导致高亮与详情不一致。
  // 这里仅在 override 时间早于 touched 时间时，清理 override，让服务端真实状态覆盖。
  try {
    for (const id of touchedIds.slice(0, 50)) {
      const key = String(id || '').trim()
      if (!key) continue
      const hit = reliabilityOverrideCache.get(key)
      if (hit && touchedTs && hit.ts && hit.ts < touchedTs) {
        reliabilityOverrideCache.delete(key)
        storageRemove(`${RELIABILITY_OVERRIDE_STORAGE_PREFIX}${key}`)
      }
    }
  } catch {}

  const matchTouchedCard = (card: DemandCard, id: string): boolean => {
    const key = String(id || '').trim()
    if (!key) return false
    const inter = String(getInteractionId(card) || '').trim()
    const raw = String((card as any).canonical_raw_id || '').trim()
    const cid = String((card as any).id || '').trim()
    return inter === key || raw === key || cid === key
  }

  const candidates = touchedIds
    .map((id) => allDemands.value.find((c) => matchTouchedCard(c, id)))
    .filter(Boolean) as DemandCard[]
  await Promise.all(candidates.slice(0, 20).map((c) => refreshCardReliabilityData(c)))

  const touchedStatusIds = getTouchedStatusDemandIds()
  const statusCandidates = touchedStatusIds
    .map((id) => allDemands.value.find((c) => matchTouchedCard(c, id)))
    .filter(Boolean) as DemandCard[]
  await Promise.all(statusCandidates.slice(0, 20).map((c) => refreshCardStatusData(c)))
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
  reloadFromCloud()
})

watch(activeTimeField, () => {
  reloadFromCloud()
})

onMounted(async () => {
  await refreshAuthState()
})

onLoad((options) => {
  const module = String((options as any)?.module || '').trim()
  const tr = String((options as any)?.timeRange || '').trim().toUpperCase()
  const tf = String((options as any)?.timeField || '').trim().toUpperCase()

  if (module) {
    const code = normalizeSapModuleToken(module) || module
    const up = String(code || '').trim().toUpperCase()
    if (up !== 'OTHER' && up !== 'ALL') {
      if (!BASE_MODULES.some((m) => m.code === code) && !extraModules.value.some((m) => m.code === code)) {
        extraModules.value = [...extraModules.value, { code, name: code }]
      }
      activeModule.value = code
    } else {
      activeModule.value = 'ALL'
    }
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

    const normalizeCityToken = (raw: string): string => {
      const s = String(raw || '').trim()
      if (!s) return ''
      return s.replace(/(市|地区|自治州|自治县|县|区|省)$/g, '').trim()
    }

    const isOverseasCity = (raw: string): boolean => {
      const s = String(raw || '').trim()
      if (!s) return false
      if (s === '海外') return true
      if (s === '欧洲' || s === '菲律宾') return true
      if (/新加坡|马来西亚|日本|韩国|泰国|越南|印度尼西亚|印尼|印度|澳大利亚|英国|德国|法国|荷兰|瑞士|西班牙|意大利|瑞典|挪威|芬兰|丹麦|俄罗斯|美国|加拿大|墨西哥|巴西/.test(s)) return true
      if (/\b(singapore|malaysia|japan|korea|thailand|vietnam|indonesia|india|australia|uk|england|germany|france|netherlands|switzerland|spain|italy|sweden|norway|finland|denmark|russia|usa|united states|canada|mexico|brazil)\b/i.test(s)) return true
      return false
    }

    const byCity = (() => {
      const active = String(activeCity.value || '').trim()
      if (active === '全部' || active === '全国') return true
      if (active === '远程') return d.is_remote === true
      if (active === '海外') {
        return isOverseasCity(String(d.city || ''))
      }
      const a = normalizeCityToken(active)
      if (!a) return true
      const rawCity = String(d.city || '').trim()
      if (!rawCity) return false
      const tokens = rawCity
        .split('/')
        .map((x) => normalizeCityToken(x))
        .filter(Boolean)
      if (!tokens.length) return false
      return tokens.includes(a)
    })()

    const byRemote =
      activeRemoteMode.value === 'ALL' ||
      (activeRemoteMode.value === 'REMOTE' && d.is_remote === true) ||
      (activeRemoteMode.value === 'ONSITE' && (d.is_remote === false || d.is_remote === null))

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

  const dayKey = (ts: number): string => {
    try {
      const d = new Date(ts)
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    } catch {
      return ''
    }
  }

  return list.slice().sort((a, b) => {
    const ta = pickSortTs(a as any)
    const tb = pickSortTs(b as any)
    if (tb !== ta) return tb - ta

    // 方案 A：同一天内用 richness_score 作为二级排序（越丰富越靠前）
    const da = dayKey(ta)
    const db = dayKey(tb)
    if (da && db && da === db) {
      const ra = Number((a as any).richness_score || 0)
      const rb = Number((b as any).richness_score || 0)
      if (rb !== ra) return rb - ra
    }

    // 稳定兜底：按 id 倒序（避免完全相等时排序不稳定）
    const ida = String((a as any).id || '')
    const idb = String((b as any).id || '')
    return idb.localeCompare(ida)
  })
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
    reloadFromCloud()
  } catch {
    return
  }
}

const clearSearch = () => {
  searchKeyword.value = ''
  reloadFromCloud()
}

const setModule = (code: string) => {
  activeModule.value = code
  reloadFromCloud()
}

const setCity = (city: string) => {
  activeCity.value = city
  reloadFromCloud()
}

const setTimeRange = (val: TimeRange) => {
  activeTimeRange.value = val
  reloadFromCloud()
}

const setTimeField = (val: TimeField) => {
  activeTimeField.value = val
  reloadFromCloud()
}

const setRemoteMode = (val: RemoteMode) => {
  activeRemoteMode.value = val
  reloadFromCloud()
}

const setCooperationMode = (val: CooperationModeOpt) => {
  activeCooperationMode.value = val
  reloadFromCloud()
}

const setYearRange = (val: YearRange) => {
  activeYearRange.value = val
  reloadFromCloud()
}

const setDurationRange = (val: DurationRange) => {
  activeDurationRange.value = val
  reloadFromCloud()
}

const setLanguage = (val: LanguageOpt) => {
  activeLanguage.value = val
  reloadFromCloud()
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

const goBack = () => {
  safeNavigateBack({ delta: 1 })
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

  const key = getInteractionId(card)
  if (!key) return

  card.favoriting = true
  try {
    await requireNonGuest()
    if (card.isFavorited) {
      await removeFavorite(key)
      card.isFavorited = false
      uni.showToast({ title: '已取消收藏', icon: 'none' })
    } else {
      await addFavorite(key)
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

// 处理列表页状态点击
const handleCardStatusClick = async (card: DemandCard, status: string) => {
  if (!card?.id) return
  if (card.statusBusy) return

  const key = getInteractionId(card)
  if (!key) return

  const statusOption = statusOptions.find(s => s.value === status)
  if (!statusOption) return

  const prevUserStatuses = Array.isArray(card.userStatuses) ? [...card.userStatuses] : []
  const alreadyMarked = prevUserStatuses.includes(status)

  // 点击即反馈：先做乐观高亮/取消高亮（鉴权/接口失败再回滚）
  const has = (card.userStatuses || []).includes(status)
  const next = has ? (card.userStatuses || []).filter((x) => x !== status) : [...(card.userStatuses || []), status]
  card.userStatuses = next
  setStatusOverride(key, next)
  touchStatusDemandId(key)

  try {
    card.statusBusy = true
    await requireNonGuest()
    const user = await getOrCreateUserProfile()

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
        if (!confirmCancel) {
          card.userStatuses = prevUserStatuses
          setStatusOverride(key, prevUserStatuses)
          return
        }
      }
      await unmarkDemandStatus(key, status as any, user.uid)
      refreshCardStatusData(card).catch(() => {})
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
        
        if (!confirm) {
          card.userStatuses = prevUserStatuses
          setStatusOverride(key, prevUserStatuses)
          return
        }
      }
      await markDemandStatus(key, status as any, user.nickname || '匿名用户')

      // 标记/修改后以服务端为准刷新 counts
      refreshCardStatusData(card).catch(() => {})

      // 增加积分逻辑（不阻塞 UI：积分更新失败不影响标记本身）
      const points = getRewardPoints('markDemandStatus')
      if (points > 0) {
        updateUserProfile({}, { addPoints: points }).catch(() => {})
      }
    }

    // 异步校准：后台统计可能延迟，做重试刷新以避免“详情=2 列表=1”
    const refreshStatusWithRetry = async () => {
      const startTs = Date.now()
      const baseCounts = JSON.stringify(card.statusCounts || {})
      const baseUser = JSON.stringify(card.userStatuses || [])
      const tries = [200, 400, 800, 1200, 1800, 2600, 3400]
      for (let i = 0; i < tries.length; i++) {
        await new Promise((r) => setTimeout(r, tries[i]))
        await refreshCardStatusData(card)
        // counts 或 userStatuses 任一发生变化即可视为“已同步到服务端结果”（避免“只变用户态不变 counts”时重试失效）
        const nextCounts = JSON.stringify(card.statusCounts || {})
        const nextUser = JSON.stringify(card.userStatuses || [])
        if (
          (card as any).statusCountsUpdatedAt &&
          (card as any).statusCountsUpdatedAt >= startTs &&
          (nextCounts !== baseCounts || nextUser !== baseUser)
        ) {
          return
        }
      }
    }
    refreshStatusWithRetry().catch(() => {})

    const points = !alreadyMarked ? getRewardPoints('markDemandStatus') : 0
    if (!alreadyMarked && points > 0) {
      uni.showToast({ title: `标记成功，积分 +${points}`, icon: 'success' })
    } else {
      uni.showToast({ title: alreadyMarked ? '状态已取消' : '状态标记成功', icon: 'none' })
    }
  } catch (e: any) {
    console.error('Failed to mark/unmark status:', e)
    // 失败回滚（尽量不影响用户继续操作）
    try {
      card.userStatuses = prevUserStatuses
      setStatusOverride(key, prevUserStatuses) // Use interaction key instead of card.id
    } catch {}
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    uni.showToast({ title: msg || '标记失败', icon: 'none' })
  } finally {
    card.statusBusy = false
  }
}

// 处理列表页评价点击
const handleCardReliabilityClick = async (card: DemandCard, reliable: boolean) => {
  if (!card?.id) return
  if (card.reliabilityBusy) return

  const key = getInteractionId(card)
  if (!key) return

  const prevUserReliability = card.userReliability
  const prevReliabilityCounts = { ...(card.reliabilityCounts || {}) } as any
  const prevOverride = getReliabilityOverride(key)

  // 点击即反馈：先做乐观高亮/取消高亮（鉴权/接口失败再回滚）
  const nextUserReliability = card.userReliability === reliable ? null : reliable
  card.userReliability = nextUserReliability
  setReliabilityOverride(key, nextUserReliability)
  touchReliabilityDemandId(key)

  try {
    card.reliabilityBusy = true
    await requireNonGuest()
    const user = await getOrCreateUserProfile()
    
    // 检查是否已评价 -> 同评价则取消
    if (nextUserReliability === null) {
      await unmarkDemandReliability(key, user.uid)

      // 取消评价：扣回积分
      const cancelPoints = getRewardPoints('markDemandReliability')
      if (cancelPoints > 0) {
        updateUserProfile({}, { addPoints: -cancelPoints }).catch(() => {})
      }

      // 取消后以服务端为准刷新 counts
      refreshCardReliabilityData(card).catch(() => {})

      if (cancelPoints > 0) {
        uni.showToast({ title: `评价已取消，积分 -${cancelPoints}`, icon: 'none' })
      } else {
        uni.showToast({ title: '评价已取消', icon: 'none' })
      }
    } else {
      await markDemandReliability(key, reliable, user.nickname || '匿名用户')

      // 只有“首次评价（从 null -> true/false）”才加积分；从 true<->false 视为修改，不重复加分
      const rewardPoints = prevUserReliability === null ? getRewardPoints('markDemandReliability') : 0
      if (rewardPoints > 0) {
        updateUserProfile({}, { addPoints: rewardPoints }).catch(() => {})
        uni.showToast({ title: `评价成功，积分 +${rewardPoints}`, icon: 'success' })
      } else {
        uni.showToast({ title: reliable ? '已标记为靠谱' : '已标记为不靠谱', icon: 'none' })
      }

      // 标记/修改后以服务端为准刷新 counts
      refreshCardReliabilityData(card).catch(() => {})
    }

    // 异步校准：做重试刷新，确保列表最终与详情一致
    const refreshRelWithRetry = async () => {
      const startTs = Date.now()
      const baseCounts = JSON.stringify(card.reliabilityCounts || {})
      const baseUser = JSON.stringify(card.userReliability)
      const tries = [200, 400, 800, 1200, 1800, 2600, 3400, 4200, 5200, 6200]
      for (let i = 0; i < tries.length; i++) {
        await new Promise((r) => setTimeout(r, tries[i]))
        await refreshCardReliabilityData(card)
        const nextCounts = JSON.stringify(card.reliabilityCounts || {})
        const nextUser = JSON.stringify(card.userReliability)
        if (
          (card as any).reliabilityCountsUpdatedAt &&
          (card as any).reliabilityCountsUpdatedAt >= startTs &&
          (nextCounts !== baseCounts || nextUser !== baseUser)
        ) {
          return
        }
      }
    }
    refreshRelWithRetry().catch(() => {})
  } catch (e: any) {
    console.error('Failed to mark reliability:', e)
    // 失败回滚
    try {
      card.userReliability = prevUserReliability
      card.reliabilityCounts = prevReliabilityCounts
      if (prevOverride !== undefined) setReliabilityOverride(key, prevOverride)
    } catch {}
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    uni.showToast({ title: msg || '评价失败', icon: 'none' })
  } finally {
    card.reliabilityBusy = false
  }
}

// 刷新单个卡片的状态数据
const refreshCardStatusData = async (card: DemandCard) => {
  try {
    const key = getInteractionId(card)
    const counts = await getDemandStatusCounts(key)
    card.statusCounts = {
      applied: counts.applied || 0,
      interviewed: counts.interviewed || 0,
      onboarded: counts.onboarded || 0,
      closed: counts.closed || 0,
    }
    card.statusCountsUpdatedAt = Date.now()
    
    const user = await getOrCreateUserProfile()
    const userStatusesList = await getUserDemandStatuses(key, user.uid)
    const override = getStatusOverride(key)
    card.userStatuses = override !== undefined ? override : (userStatusesList || [])
  } catch (e) {
    console.error('Failed to refresh card status data:', e)
  }
}

// 刷新单个卡片的评价数据
const refreshCardReliabilityData = async (card: DemandCard) => {
  try {
    const key = getInteractionId(card)
    const counts = await getDemandReliabilityCounts(key)
    card.reliabilityCounts = {
      reliable: counts.reliable || 0,
      unreliable: counts.unreliable || 0,
    }
    card.reliabilityCountsUpdatedAt = Date.now()
    
    const user = await getOrCreateUserProfile()
    const userRel = await getUserDemandReliability(key, user.uid)
    const override = getReliabilityOverride(key)
    // 若近期有本地 override，则优先保留，避免后端延迟覆盖导致高亮“闪退”
    if (override !== undefined) {
      card.userReliability = override
    } else {
      card.userReliability = userRel === true ? true : userRel === false ? false : null
    }
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
    min-height: 100vh;
    padding: 0;
    background: #F5F1E8;
  }
  
  .page-header-unified {
    background: #0B1924;
    height: 88rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    position: sticky;
    top: 0;
    z-index: 1010;
    width: 100%;
  }
  
  .page-header-content {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0 24rpx;
  }
  
  .header-left,
  .header-right {
    width: 120rpx;
    display: flex;
    align-items: center;
  }
  
  .header-right {
    justify-content: flex-end;
  }
  
  .page-header-title {
    color: #FFFFFF;
    font-size: 32rpx;
    font-weight: 800;
  }
  
  .sticky-header {
    position: sticky;
    top: 88rpx;
    z-index: 1000;
    background: #F5F1E8;
    padding: 16rpx 24rpx 12rpx;
    border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  }
  
  .header-main-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 16rpx;
  }
  
  .search-box {
    flex: 1;
    height: 72rpx;
    background: #FFFFFF;
    border-radius: 14rpx;
    display: flex;
    align-items: center;
    padding: 0 24rpx;
    border: 1rpx solid rgba(15, 23, 42, 0.08);
  }
  
  .search-input {
    flex: 1;
    height: 100%;
    font-size: 26rpx;
    color: #0f172a;
  }

  .search-clear {
    width: 52rpx;
    height: 52rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 26rpx;
    background: #F3F4F6;
  }

  .search-clear-text {
    font-size: 26rpx;
    color: #64748B;
    line-height: 1;
  }

  .header-btns {
    display: flex;
    align-items: center;
  }
  
  .fold-toggle-btn {
    display: flex;
    align-items: center;
    gap: 8rpx;
    font-size: 24rpx;
    color: #FFFFFF;
    background: #D97706;
    padding: 0 18rpx;
    height: 72rpx;
    border-radius: 14rpx;
  }

  .fold-toggle-btn--large {
    width: 140rpx;
    justify-content: center;
  }
  
  .filter-panel {
    margin-top: 20rpx;
    display: flex;
    flex-direction: column;
    background: #FFFFFF;
    border-radius: 16rpx;
    padding: 16rpx;
    border: 1rpx solid rgba(15, 23, 42, 0.06);
  }

  .filter-panel-scroll {
    max-height: 620rpx;
    padding-right: 8rpx;
    background: #FFFFFF;
  }
  
  .filter-section {
    margin-bottom: 24rpx;
  }
  
  .filter-section-label {
    font-size: 24rpx;
    color: #0B1924;
    font-weight: 800;
    font-family: "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin-bottom: 12rpx;
    display: block;
  }
  
  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
  }
  
  .panel-chip {
    padding: 8rpx 20rpx;
    background: #F3F4F6;
    border: 1rpx solid rgba(15, 23, 42, 0.06);
    border-radius: 12rpx;
    font-size: 22rpx;
    color: #475569;
  }
  
  .panel-chip--active {
    background: #D97706;
    border-color: #D97706;
    color: #FFFFFF;
  }

  .panel-chip--active text {
    color: #FFFFFF;
  }
  
  .folded-summary {
    margin-top: 12rpx;
    display: flex;
    flex-direction: row;
    gap: 12rpx;
    overflow-x: auto;
    background: #F5F1E8;
    padding: 10rpx 0 2rpx;
  }

  .summary-scroll {
    width: 100%;
  }

  .summary-tags {
    display: flex;
    flex-direction: row;
    gap: 12rpx;
    padding: 0 8rpx;
  }
  
  .summary-tag {
    font-size: 20rpx;
    background: rgba(217, 119, 6, 0.18);
    border: 1rpx solid rgba(217, 119, 6, 0.35);
    padding: 6rpx 14rpx;
    border-radius: 12rpx;
    white-space: nowrap;
    color: #B45309;
  }

  .action-bar {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    padding: 16rpx 24rpx;
    background: #F5F1E8;
    border-bottom: 1rpx solid rgba(15, 23, 42, 0.06);
  }

  .publish-btn-wrapper {
    background: #16A34A;
    padding: 12rpx 26rpx;
    border-radius: 12rpx;
  }

  .publish-btn-text {
    color: #FFFFFF;
    font-size: 26rpx;
    font-weight: 700;
  }

  .header-right-actions {
    display: flex;
    align-items: center;
    gap: 16rpx;
  }

  .icon-btn {
    width: 64rpx;
    height: 64rpx;
    border-radius: 14rpx;
    background: #FFFFFF;
    border: 1rpx solid rgba(15, 23, 42, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-btn {
    width: 64rpx;
    height: 64rpx;
    border-radius: 14rpx;
    background: #FFFFFF;
    border: 1rpx solid rgba(15, 23, 42, 0.08);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .refresh-btn--loading {
    opacity: 0.6;
  }

  .refresh-btn-text {
    font-size: 24rpx;
    color: #0f172a;
  }

  .panel-footer {
    padding-top: 12rpx;
  }

  .panel-footer--center {
    display: flex;
    justify-content: center;
  }
  
  .card-list {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding-bottom: 40rpx;
  }
  
  .demand-card {
    background: #FFFFFF;
    margin: 20rpx 24rpx;
    padding: 32rpx;
    border-radius: 24rpx;
    box-shadow: 0 6rpx 18rpx rgba(0, 0, 0, 0.06);
  }

  .card-raw-header {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 16rpx;
  }
  
  .card-raw-text {
    flex: 1;
    font-size: 28rpx;
    color: #1e293b;
    line-height: 1.65;
  }

  .card-favorite-btn-inline {
    margin-left: auto;
    width: 56rpx;
    height: 56rpx;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 28rpx;
    background: #F8FAFC;
    border: 1rpx solid rgba(15, 23, 42, 0.06);
    flex: none;
  }

  .card-favorite-btn--active {
    background: rgba(239, 68, 68, 0.08);
    border-color: rgba(239, 68, 68, 0.18);
  }

  .card-favorite-icon {
    font-size: 28rpx;
    line-height: 1;
  }
  
  .tags-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 20rpx;
  }
  
  .tag-item {
    padding: 6rpx 16rpx;
    border-radius: 8rpx;
    background: #F1F5F9;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .tag-text {
    font-size: 22rpx;
    color: #475569;
    font-weight: 600;
    line-height: 1.4;
  }
  
  .tag-module { background: #E0F2FE; }
  .tag-module .tag-text { color: #0369A1; }
  .tag-city { background: #FEF3C7; }
  .tag-city .tag-text { color: #92400E; }
  .tag-duration { background: #F3E8FF; }
  .tag-duration .tag-text { color: #7E22CE; }
  .tag-years { background: #DCFCE7; }
  .tag-years .tag-text { color: #15803D; }
  .tag-lang { background: #E0F2FE; }
  .tag-lang .tag-text { color: #0369A1; }
  .tag-rate { background: #FFE4E6; }
  .tag-rate .tag-text { color: #BE123C; }
  .tag-mode { background: #F1F5F9; }
  .tag-mode .tag-text { color: #475569; }
  .tag-extra { background: #F8FAFC; }
  .tag-extra .tag-text { color: #64748B; }
  
  .card-status-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin-top: 24rpx;
    padding-top: 24rpx;
    border-top: 1rpx solid #F1F5F9;
  }
  
  .card-status-item {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 10rpx 20rpx;
    background: #F8FAFC;
    border-radius: 12rpx;
    border: 1rpx solid #E2E8F0;
  }
  
  .card-status-label {
    font-size: 22rpx;
    color: #475569;
    font-weight: 600;
  }
  
  .card-status-count {
    font-size: 20rpx;
    color: #94A3B8;
  }

  .card-status-count--nonzero {
    color: #64748B;
    font-weight: 700;
  }

  .card-status-item--active {
    border-color: rgb(191, 219, 254);
    background: rgb(239, 246, 255);
  }

  .card-status-item--active .card-status-label {
    color: #2563EB;
  }

  .card-status-item--active .card-status-count--nonzero {
    color: #2563EB;
    font-weight: 800;
  }
  
  .card-reliability-bar {
    display: flex;
    gap: 12rpx;
    margin-top: 16rpx;
  }
  
  .card-reliability-item {
    display: flex;
    align-items: center;
    gap: 8rpx;
    padding: 8rpx 20rpx;
    background: #F8FAFC;
    border-radius: 12rpx;
    border: 1rpx solid #E2E8F0;
  }
  
  .card-reliability-label {
    font-size: 22rpx;
    color: #475569;
    font-weight: 600;
  }
  
  .card-reliability-count {
    font-size: 20rpx;
    color: #94A3B8;
  }

  .card-reliability-count--nonzero {
    color: #64748B;
    font-weight: 700;
  }

  .card-reliability-item--reliable.card-reliability-item--active {
    border-color: #A7F3D0;
    background: #ECFDF5;
  }

  .card-reliability-item--unreliable.card-reliability-item--active {
    border-color: rgb(254, 202, 202);
    background: rgb(254, 242, 242);
  }

  .card-reliability-item--reliable.card-reliability-item--active .card-reliability-label {
    color: #059669;
  }

  .card-reliability-item--reliable.card-reliability-item--active .card-reliability-count--nonzero {
    color: #059669;
    font-weight: 800;
  }

  .card-reliability-item--unreliable.card-reliability-item--active .card-reliability-label {
    color: #DC2626;
  }

  .card-reliability-item--unreliable.card-reliability-item--active .card-reliability-count--nonzero {
    color: #DC2626;
    font-weight: 800;
  }
  
  .list-footer {
    padding: 48rpx 0;
    text-align: center;
  }
  
  .list-footer-text {
    font-size: 24rpx;
    color: #94A3B8;
  }
</style>
