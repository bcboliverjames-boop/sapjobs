<template>
  <view class="page detail-page">
    <view class="page-header-unified">
      <view class="page-header-content">
        <view class="header-left" @tap="goBack">
          <uni-icons type="back" size="20" color="#F5F1E8" />
        </view>
        <text class="page-header-title">需求详情</text>
        <view class="header-right"></view>
      </view>
    </view>

    <scroll-view class="content-scroll" scroll-y="true">
      <view v-if="loading" class="loading-state">
        <text class="loading-text">正在调取原文...</text>
      </view>

      <view v-else-if="!demand" class="empty-state">
        <text class="empty-text">未找到对应的需求记录</text>
      </view>

      <view v-else class="detail-container">
        <!-- 原文与状态合并卡片 -->
        <view class="detail-card combined-header-card">
          <view class="card-header">
            <view class="header-main-info">
              <view class="card-dot"></view>
              <text class="card-title">原始需求原文</text>
            </view>
            <view
              class="favorite-action-btn"
              @tap.stop="toggleFavorite"
              :class="{ 'favorite-action-btn--active': isFavorited, 'guest-disabled': isGuest }"
            >
              <uni-icons :type="isFavorited ? 'heart-filled' : 'heart'" size="20" :color="isFavorited ? '#ef4444' : '#64748b'" />
              <text class="fav-text">{{ isFavorited ? '已收藏' : '收藏' }}</text>
            </view>
          </view>
          
          <view class="raw-content">
            <text class="raw-text">{{ demand.raw_text }}</text>
          </view>

          <!-- 结构化标签 -->
          <view class="tags-grid detail-tags-margin">
            <view v-for="m in filteredModuleLabels" :key="m" class="tag-item tag-module">
              <text class="tag-text">{{ m }}</text>
            </view>
            <view v-if="demand.city" class="tag-item tag-city">
              <text class="tag-text">📍 {{ demand.city }}</text>
            </view>
            <view v-if="demand.duration_text" class="tag-item tag-duration">
              <text class="tag-text">⏱️ {{ demand.duration_text }}</text>
            </view>
            <view v-if="demand.years_text" class="tag-item tag-years">
              <text class="tag-text">🎓 {{ demand.years_text }}</text>
            </view>
            <view v-if="demand.language" class="tag-item tag-lang">
              <text class="tag-text">🌐 {{ demand.language }}</text>
            </view>
            <view v-if="demand.daily_rate" class="tag-item tag-rate">
              <text class="tag-text">💰 {{ formatDailyRate(demand.daily_rate) }}</text>
            </view>
            <view v-if="(demand as any).cooperation_mode" class="tag-item tag-mode">
              <text class="tag-text">🤝 {{ (demand as any).cooperation_mode }}</text>
            </view>
            <view v-for="t in filteredExtraTags" :key="t" class="tag-item tag-extra">
              <text class="tag-text">{{ t }}</text>
            </view>
          </view>

          <view class="card-footer">
            <text class="time-label">发布时间：{{ demand.createdAt ? formatTime(demand.createdAt) : '未知' }}</text>
            <text class="richness-label">丰富度：{{ Number((demand as any)?.richness_score || 0) }}</text>
          </view>

          <!-- 交付状态与靠谱评价 (原第二块，现合并至第一块底部) -->
          <view class="combined-status-section">
            <view class="status-divider"></view>
            <view class="status-header">
              <view class="card-dot"></view>
              <text class="status-title">交付状态与靠谱评价</text>
            </view>
            
            <view class="compact-status-row">
              <view 
                v-for="status in statusOptions" 
                :key="status.value"
                class="compact-status-btn"
                :class="[
                  { 'compact-status-btn--active': userStatuses.includes(status.value) }
                ]"
                @tap.stop="handleStatusClick(status)"
              >
                <text class="csb-icon">{{ status.icon }}</text>
                <text class="csb-label">{{ status.label }}</text>
                <text
                  class="csb-count"
                  :class="{ 'csb-count--nonzero': (statusCounts[status.value] || 0) > 0 }"
                >({{ statusCounts[status.value] || 0 }})</text>
              </view>
            </view>
            
            <view class="compact-reliability-row compact-status-row">
              <view 
                class="compact-status-btn"
                :class="{ 'compact-status-btn--active': userReliability === true }"
                @tap.stop="handleReliabilityClick(true)"
              >
                <text class="csb-icon">👍</text>
                <text class="csb-label">靠谱</text>
                <text
                  class="csb-count"
                  :class="{ 'csb-count--nonzero': (reliabilityCounts.reliable || 0) > 0 }"
                >({{ reliabilityCounts.reliable || 0 }})</text>
              </view>
              <view 
                class="compact-status-btn"
                :class="{ 'compact-status-btn--active': userReliability === false }"
                @tap.stop="handleReliabilityClick(false)"
              >
                <text class="csb-icon">👎</text>
                <text class="csb-label">不靠谱</text>
                <text
                  class="csb-count"
                  :class="{ 'csb-count--nonzero': (reliabilityCounts.unreliable || 0) > 0 }"
                >({{ reliabilityCounts.unreliable || 0 }})</text>
              </view>
            </view>
          </view>
        </view>

        <!-- 关联需求卡片 -->
        <view v-if="relatedDemands.length > 0" class="detail-card related-card">
          <view class="card-header card-header--left">
            <view class="card-dot"></view>
            <text class="card-title">关联需求（{{ relatedDemands.length }} 条）</text>
          </view>
          
          <view v-if="!canViewContact" class="contact-lock-hint" @tap.stop="showContactAccessInfo">
            <uni-icons type="locked" size="14" color="#D97706" />
            <text class="lock-text">登录并达到 {{ VIEW_CONTACT_THRESHOLD }} 积分后可解锁联系方式</text>
          </view>
          
          <view class="related-list">
            <view 
              v-for="(item, index) in relatedDemands" 
              :key="item.id || index"
              class="related-item"
              @tap="goToRelatedDemandDetail(item)"
            >
              <view class="related-item-head">
                <text class="related-source">来源：{{ getRelatedProviderName(item) }}</text>
                <text class="related-sim">{{ item.isSelf ? '100%' : Math.round(item.similarity * 100) + '%' }} 相似</text>
              </view>
              <text class="related-excerpt">{{ item.raw_text }}</text>
              
              <view v-if="canViewContact || isSelfProvider(item)" class="contact-box" @tap.stop>
                <view v-if="!hasRelatedContactInfo(item)" class="contact-empty">发布者暂未提供联系方式</view>
                <view v-else>
                  <view
                    v-if="!isSelfProvider(item) && getRelatedProviderProfile(item) && !canShareProviderContact(getRelatedProviderProfile(item))"
                    class="contact-empty"
                  >发布者未开放联系方式</view>
                  <view v-else>
                    <view v-if="!isSelfProvider(item) && !isContactUnlocked(item)" class="unlock-action" @tap.stop="unlockRelatedContact(item)">
                      <text class="unlock-btn-text">点击消耗积分解锁联系方式</text>
                    </view>
                    <view v-else class="contact-details">
                      <view v-if="getRelatedWechatId(item)" class="contact-line" @tap.stop="copyContact('wechat', getRelatedWechatId(item))">
                        <text class="c-label">微信：</text>
                        <text class="c-value">{{ getRelatedWechatId(item) }}</text>
                        <text class="c-copy">复制</text>
                      </view>
                      <view v-if="getRelatedQqNumber(item)" class="contact-line" @tap.stop="copyContact('qq', getRelatedQqNumber(item))">
                        <text class="c-label">QQ：</text>
                        <text class="c-value">{{ getRelatedQqNumber(item) }}</text>
                        <text class="c-copy">复制</text>
                      </view>
                      <view v-if="getRelatedContactRemark(item)" class="contact-line" @tap.stop>
                        <text class="c-label">备注：</text>
                        <text class="c-value">{{ getRelatedContactRemark(item) }}</text>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>

        <!-- 底部说明 -->
        <view class="legal-info">
          <view class="info-row" @tap.stop="goToReport">
            <uni-icons type="info" size="14" color="rgba(11, 25, 36, 0.4)" />
            <text class="info-text">投诉举报</text>
          </view>
          <text class="info-sep">|</text>
          <view class="info-row" @tap.stop="goToContact">
            <uni-icons type="email" size="14" color="rgba(11, 25, 36, 0.4)" />
            <text class="info-text">联系我们</text>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import {
  fetchSapDemandById,
  SAMPLE_DEMANDS,
  type SapDemandRecord,
} from '../../utils/sap-demands'
import { parseDemandText } from '../../utils/demand-parser'
import { fetchUniqueDemandById, type SapUniqueDemandDoc } from '../../utils/sap-unique-demands'
import { ensureLogin, requireNonGuest, isGuestUser } from '../../utils/cloudbase'
import { getOrCreateUserProfile, getProfilesByIds, getUserProfileOnly, updateUserProfile, type UserProfile } from '../../utils/user'
import { getThresholdPoints, getPointsConfig, getRewardPoints } from '../../utils/points-config'
import { addFavorite, removeFavorite, isFavorite } from '../../utils/favorites'
import { navigateTo, safeNavigateBack } from '../../utils'
import { calculateTextSimilarity, checkSimilarDemandsByPolicy } from '../../utils/demand-similarity'
import { unlockContact } from '../../utils/ugc'
import { sapModuleCodeToLabel, normalizeSapModuleToken } from '../../utils/sap-modules'
import {
  markDemandStatus,
  unmarkDemandStatus,
  getDemandStatusCounts,
  getUserDemandStatuses,
  getLatestStatusNicknames,
  markDemandReliability,
  unmarkDemandReliability,
  getDemandReliabilityCounts,
  getUserDemandReliability,
} from '../../utils/demand-status'

const loading = ref(true)
const demand = ref<SapDemandRecord | null>(null)
const isGuest = ref(false)
const demandId = ref<string>('')
const uniqueDemandId = ref<string>('')
const viewerProfile = ref<UserProfile | null>(null)
const currentRawId = ref<string>('')
const relatedProfilesById = ref<Record<string, UserProfile>>({})

const filteredModuleLabels = computed(() => {
  const base = (demand.value && Array.isArray((demand.value as any).module_labels) ? (demand.value as any).module_labels : []) as any[]
  return base
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((x) => {
      const up = x.toUpperCase()
      if (up === 'OTHER') return false
      if (x === '其他') return false
      const norm = normalizeSapModuleToken(x)
      if (norm && String(norm).toUpperCase() === 'OTHER') return false
      return true
    })
})

const filteredExtraTags = computed(() => {
  const base = (demand.value && Array.isArray((demand.value as any).extra_tags) ? (demand.value as any).extra_tags : []) as any[]
  const drop = new Set(['OTHER', 'LONG'])
  return base
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((x) => !drop.has(x.toUpperCase()))
})

const refreshAuthState = async () => {
  try {
    const prevGuest = !!isGuest.value
    const state: any = await ensureLogin()
    const nextGuest = !!(state && isGuestUser(state.user))
    isGuest.value = nextGuest

    // When switching from guest -> logged-in, reload auth-bound states.
    if (prevGuest && !nextGuest) {
      try {
        viewerProfile.value = await getUserProfileOnly()
      } catch {
        viewerProfile.value = null
      }
      try {
        loadUnlockState()
      } catch {}
      try {
        await loadStatusData()
      } catch {}
      try {
        await loadReliabilityData()
      } catch {}
      try {
        if (demandId.value) {
          isFavorited.value = await resolveFavoriteState([uniqueDemandId.value, demandId.value, currentRawId.value])
        }
      } catch {}
    }
  } catch {
    isGuest.value = false
  }
}

onShow(async () => {
  await refreshAuthState()
})

const goBack = () => {
  let redirectUrl = ''
  try {
    const pages = (typeof getCurrentPages === 'function' ? getCurrentPages() : []) as any[]
    if (!pages || pages.length <= 1) {
      uni.reLaunch({ url: '/pages/demand/demand' })
      return
    }
    const current = pages && pages.length ? pages[pages.length - 1] : null
    const opts = (current && (current.options || (current.$page && current.$page.options))) || {}
    if (opts && opts.redirect) redirectUrl = decodeURIComponent(String(opts.redirect))
  } catch {
    // ignore
  }

  if (redirectUrl) {
    uni.reLaunch({ url: redirectUrl })
    return
  }

  safeNavigateBack({ delta: 1 })
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

const richnessScoreDisplay = computed(() => {
  const d: any = demand.value as any
  if (!d) return 0
  const backend = Number.isFinite(Number(d.richness_score)) ? Number(d.richness_score) : 0
  if (backend > 0) return backend
  return computeLocalRichnessScore(String(d.raw_text || ''), d)
})

// 格式化时间
const formatTime = (time: Date | string) => {
  if (!time) return ''
  const date = time instanceof Date ? time : new Date(time)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const statusOptions = [
  { value: 'applied', label: '已投递', icon: '📤', confirmMessage: '是否确认已投递？' },
  { value: 'interviewed', label: '已面试', icon: '💼', confirmMessage: '是否确认已面试？' },
  { value: 'onboarded', label: '已到岗', icon: '✅', confirmMessage: '是否确认已到岗？将显示您的账号昵称。' },
  { value: 'closed', label: '已关闭', icon: '🔒', confirmMessage: '是否确认关闭需求？将显示您的账号昵称。' },
]

const statusCounts = ref<Record<string, number>>({
  applied: 0,
  interviewed: 0,
  onboarded: 0,
  closed: 0,
})
const userStatuses = ref<string[]>([])
const statusNicknames = ref<Record<string, string>>({})
const reliabilityCounts = ref({ reliable: 0, unreliable: 0 })
const userReliability = ref<boolean | null>(null)
const reliabilityBusy = ref(false)

const RELIABILITY_TOUCHED_STORAGE_KEY = 'sapjobs_reliability_touched_v1'
const STATUS_TOUCHED_STORAGE_KEY = 'sapjobs_status_touched_v1'

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

const touchStatusDemandIds = (...ids: Array<string | undefined | null>) => {
  try {
    ids
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .forEach((id) => touchStatusDemandId(id))
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

const touchReliabilityDemandIds = (...ids: Array<string | undefined | null>) => {
  try {
    ids
      .map((x) => String(x || '').trim())
      .filter(Boolean)
      .forEach((id) => touchReliabilityDemandId(id))
  } catch {}
}

type RelatedDemandItem = {
  id?: string
  unique_demand_id?: string
  raw_text: string
  createdAt?: Date | string
  provider_user_id?: string
  provider_name: string
  wechat_id?: string
  qq_number?: string
  contact_remark?: string
  similarity: number
  isSelf?: boolean
}

const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const parseJsonObj = (v: any): any => {
  if (!v) return null
  if (typeof v === 'object') return v
  try {
    const s = String(v || '').trim()
    if (!s) return null
    return JSON.parse(s)
  } catch {
    return null
  }
}

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

const lookupUniqueIdByRawId = async (rawId: string): Promise<string> => {
  const rid = String(rawId || '').trim()
  if (!rid) return ''
  try {
    const base = (() => {
      try {
        if (typeof window !== 'undefined') {
          const host = String(window.location && window.location.hostname)
          if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
            const forced =
              (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
            const forcedTrim = String(forced || '').trim()
            if (forcedTrim) return forcedTrim
            return 'https://api.sapboss.com'
          }
        }
      } catch {}
      const fromEnv =
        (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
      if (fromEnv) return String(fromEnv)
      return 'https://api.sapboss.com'
    })()

    const resp: any = await new Promise((resolve, reject) => {
      uni.request({
        url: `${String(base).replace(/\/+$/, '')}/unique_demands/by_raw/${encodeURIComponent(rid)}`,
        method: 'GET',
        header: { 'Content-Type': 'application/json' },
        success: (res) => resolve((res as any)?.data),
        fail: (err) => reject(err),
      })
    })

    if (resp && resp.ok && resp.uniqueId) return String(resp.uniqueId || '').trim()
    return ''
  } catch {
    return ''
  }
}

const toModuleLabel = (code: string): string => {
  const c = String(code || '').trim().toUpperCase()
  if (!c) return ''
  if (c === 'OTHER') return ''
  return sapModuleCodeToLabel(c)
}

const extractCityFromUnique = (doc: SapUniqueDemandDoc, rawText: string): string => {
  const attrs = parseJsonObj((doc as any)?.attributes_json)
  const cityFromAttrs = attrs ? String(attrs.city || '').trim() : ''

  const tags = safeJsonArray((doc as any)?.tags_json)
  const cityFromTags = tags.find((t) => ['远程', '海外', '欧洲', '菲律宾'].includes(String(t || '').trim()))
  const base = cityFromAttrs || (cityFromTags ? String(cityFromTags) : '')

  const raw = String(rawText || '')
  const cityFromRaw = /菲律宾|philippines/i.test(raw)
    ? '菲律宾'
    : /欧洲|europe/i.test(raw)
      ? '欧洲'
      : /海外|overseas|国外/i.test(raw)
        ? '海外'
        : ''

  if (base === '海外' && (cityFromRaw === '欧洲' || cityFromRaw === '菲律宾')) return cityFromRaw
  return base || cityFromRaw || ''
}

const mapUniqueToDemand = (doc: SapUniqueDemandDoc): SapDemandRecord => {
  const rawText = String(doc?.raw_text || '').trim()
  const attrs = parseJsonObj((doc as any)?.attributes_json) || null
  const parsed = parseDemandText(rawText)

  const moduleCodes = (() => {
    const fromAttrs = attrs && Array.isArray(attrs.module_codes) ? attrs.module_codes : null
    const base = fromAttrs || parsed.module_codes || []
    return (base || [])
      .map((x: any) => String(x || '').trim())
      .map((x: string) => normalizeSapModuleToken(x) || String(x || '').trim().toUpperCase())
      .filter((x: string) => {
        const v = String(x || '').trim()
        if (!v) return false
        return v.toUpperCase() !== 'OTHER'
      })
  })()
  const moduleLabels = moduleCodes.map(toModuleLabel).filter(Boolean)

  const durationText = attrs ? String(attrs.duration_text || '').trim() : ''
  const yearsText = attrs ? String(attrs.years_text || '').trim() : ''
  const languageTag = attrs ? String(attrs.language_tag || '').trim() : ''
  const dailyRateText = attrs ? String(attrs.daily_rate_text || '').trim() : ''
  const cooperationModeText = attrs ? String(attrs.cooperation_mode || '').trim() : ''

  const tagsFromDoc = safeJsonArray((doc as any)?.tags_json)
  const extraTags = (() => {
    const base = tagsFromDoc.map((x) => String(x || '').trim()).filter(Boolean)
    const drop = new Set<string>()
    moduleLabels.forEach((x) => drop.add(String(x || '').trim()))
    drop.add('OTHER')
    drop.add('LONG')
    const cityFromAttrs = attrs ? String(attrs.city || '').trim() : ''
    if (cityFromAttrs) drop.add(cityFromAttrs)
    if (durationText) drop.add(durationText)
    if (yearsText) drop.add(yearsText)
    if (languageTag) drop.add(languageTag)
    if (dailyRateText) drop.add(dailyRateText)
    if (cooperationModeText) drop.add(cooperationModeText)
    const out: string[] = []
    for (const t of base) {
      if (!t) continue
      if (drop.has(t)) continue
      if (drop.has(String(t).trim().toUpperCase())) continue
      if (out.includes(t)) continue
      out.push(t)
      if (out.length >= 10) break
    }
    return out
  })()

  return {
    id: (doc as any)?._id,
    raw_text: rawText,
    module_labels: moduleLabels,
    module_codes: moduleCodes,
    city: extractCityFromUnique(doc, rawText) || (attrs ? String(attrs.city || '').trim() : '') || parsed.city || '',
    duration_text: durationText || parsed.duration_text || '',
    years_text: yearsText || parsed.years_text || '',
    language: languageTag || parsed.language || '',
    daily_rate: dailyRateText || parsed.daily_rate || '',
    richness_score: Number.isFinite(Number((doc as any)?.richness_score)) ? Number((doc as any)?.richness_score) : 0,
    cooperation_mode: cooperationModeText,
    provider_name: (doc as any)?.provider_name || (doc as any)?.publisher_name || '未知',
    provider_user_id: (doc as any)?.provider_user_id || (doc as any)?.provider_id || undefined,
    createdAt: (doc as any)?.created_time || (doc as any)?.message_time,
    updatedAt: (doc as any)?.last_updated_time || (doc as any)?.updated_at,
    ...(extraTags.length ? ({ extra_tags: extraTags } as any) : ({ extra_tags: [] } as any)),
  }
}

// 获取查看联系方式的积分门槛
const VIEW_CONTACT_THRESHOLD = getThresholdPoints('viewContact')

const canViewContact = computed(() => {
  return (viewerProfile.value?.points || 0) >= VIEW_CONTACT_THRESHOLD
})

const contactUnlockedMap = ref<Record<string, boolean>>({})
const unlockingContactKey = ref<string>('')

const getUnlockStorageKey = () => {
  const uid = String(viewerProfile.value?.uid || '').trim()
  const did = String(demandId.value || '').trim()
  return `contact_unlock_${uid || 'anon'}_${did || 'unknown'}`
}

const loadUnlockState = () => {
  try {
    const key = getUnlockStorageKey()
    const raw = uni.getStorageSync(key)
    const parsed = raw ? JSON.parse(String(raw)) : null
    if (parsed && typeof parsed === 'object') {
      contactUnlockedMap.value = parsed
    }
  } catch (e) {
    console.error('Failed to load contact unlock state:', e)
  }
}

const persistUnlockState = () => {
  try {
    const key = getUnlockStorageKey()
    uni.setStorageSync(key, JSON.stringify(contactUnlockedMap.value || {}))
  } catch (e) {
    console.error('Failed to persist contact unlock state:', e)
  }
}

const unlockKeyOf = (item: RelatedDemandItem) => {
  const did = String(demandId.value || '').trim()
  const pid = String(item.provider_user_id || '').trim()
  return `${did}__${pid}`
}

const isContactUnlocked = (item: RelatedDemandItem) => {
  const pid = String(item.provider_user_id || '').trim()
  if (!pid) return false
  return Boolean(contactUnlockedMap.value[unlockKeyOf(item)])
}

const unlockRelatedContact = async (item: RelatedDemandItem) => {
  if (!canViewContact.value) {
    showContactAccessInfo()
    return
  }
  const pid = String(item.provider_user_id || '').trim()
  if (!pid) return

  const key = unlockKeyOf(item)
  if (contactUnlockedMap.value[key]) return
  if (unlockingContactKey.value) return

  const confirm = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '解锁联系方式',
      content: '联系方式仅用于项目沟通，请勿骚扰、勿引流、勿泄露。若遇到违规信息，请在页面底部“投诉举报”反馈。\n\n是否继续解锁？',
      confirmText: '同意并解锁',
      cancelText: '取消',
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false),
    })
  })
  if (!confirm) return

  unlockingContactKey.value = key
  try {
    const r: any = await unlockContact({
      demand_id: String(demandId.value || '').trim(),
      target_provider_user_id: pid,
      target_raw_id: String(item.id || '').trim() || undefined,
    })

    const ok = r && r.success
    if (!ok) {
      const err = String((r && r.error) || 'UNLOCK_FAILED')
      if (err === 'INSUFFICIENT_POINTS') {
        uni.showToast({ title: '积分不足，无法解锁', icon: 'none' })
        return
      }
      if (err === 'DAILY_LIMIT') {
        uni.showToast({ title: '今日解锁次数已达上限，请明天再试', icon: 'none' })
        return
      }
      uni.showToast({ title: '解锁失败，请稍后重试', icon: 'none' })
      return
    }

    contactUnlockedMap.value[key] = true
    persistUnlockState()
    uni.showToast({ title: '已解锁', icon: 'success' })
  } catch (e) {
    console.error('Failed to unlock contact:', e)
    uni.showToast({ title: '解锁失败，请稍后重试', icon: 'none' })
  } finally {
    unlockingContactKey.value = ''
  }
}

// 收藏相关
const isFavorited = ref(false)
const favoriting = ref(false)

const resolveFavoriteState = async (ids: string[]): Promise<boolean> => {
  const uniq = Array.from(new Set(ids.map((x) => String(x || '').trim()).filter(Boolean)))
  for (const id of uniq) {
    try {
      const ok = await isFavorite(id)
      if (ok) return true
    } catch (e) {
      console.error('Failed to check favorite state:', e)
    }
  }
  return false
}

// 相似需求相关
const similarDemands = ref<Array<{
  id?: string
  unique_demand_id?: string
  raw_text: string
  createdAt: Date | string
  createdAtTime?: number
  provider_user_id?: string
  provider_name: string
  similarity: number
  isSelf?: boolean
}>>([])

const relatedDemands = computed<RelatedDemandItem[]>(() => {
  const base = demand.value
  const out: RelatedDemandItem[] = []

  if (base) {
    out.push({
      id: currentRawId.value || undefined,
      unique_demand_id: undefined,
      raw_text: base.raw_text,
      createdAt: (base as any).createdAt || (base as any).updatedAt || new Date(),
      provider_user_id: (base as any).provider_user_id,
      provider_name: (base as any).provider_name || '未知',
      wechat_id: String((base as any).wechat_id || '').trim() || undefined,
      qq_number: String((base as any).qq_number || '').trim() || undefined,
      contact_remark: String((base as any).contact_remark || '').trim() || undefined,
      similarity: 1,
      isSelf: true,
    })
  }

  const self = out[0]
  const selfId = String(self?.id || '').trim()
  const selfProvider = String(self?.provider_user_id || '').trim()
  const selfText = String(self?.raw_text || '').trim()
  const normRawText = (v: string): string => {
    const s = String(v || '')
      .replace(/[\s\u00A0]+/g, '')
      .replace(/[\-—–~～_:：；;，,。.!！?？/\\|]+/g, '')
      .trim()
    return s
  }
  const selfTextNorm = normRawText(selfText)

  const others: RelatedDemandItem[] = (similarDemands.value || [])
    .map((s) => ({
      id: s.id,
      unique_demand_id: s.unique_demand_id,
      raw_text: s.raw_text,
      createdAt: s.createdAt,
      provider_user_id: s.provider_user_id,
      provider_name: s.provider_name,
      wechat_id: String((s as any).wechat_id || '').trim() || undefined,
      qq_number: String((s as any).qq_number || '').trim() || undefined,
      contact_remark: String((s as any).contact_remark || '').trim() || undefined,
      similarity: s.similarity,
      isSelf: false,
    }))
    .filter((x) => {
      if (!self) return true
      if (selfId && x.id && String(x.id).trim() === selfId) return false
      const sameProvider = selfProvider && String(x.provider_user_id || '').trim() === selfProvider
      const simToSelf = calculateTextSimilarity(selfText, String(x.raw_text || ''))
      const xTextNorm = normRawText(String(x.raw_text || '').trim())
      if (selfTextNorm && xTextNorm && xTextNorm === selfTextNorm) return false
      if (simToSelf === 1 && sameProvider) return false
      return true
    })

  // Ensure unique raw_text among others to avoid rendering visually identical items multiple times.
  const seenText = new Set<string>()
  const dedupedOthers: RelatedDemandItem[] = []
  for (const it of others) {
    const key = normRawText(String(it.raw_text || '').trim())
    if (key && seenText.has(key)) continue
    if (key) seenText.add(key)
    dedupedOthers.push(it)
  }

  return [...out, ...dedupedOthers]
})

const loadRelatedProfiles = async (items: RelatedDemandItem[]) => {
  try {
    await ensureLogin()
    const ids = Array.from(new Set(items.map((x) => String(x.provider_user_id || '').trim()).filter(Boolean)))
    if (!ids.length) {
      relatedProfilesById.value = {}
      return
    }

    relatedProfilesById.value = await getProfilesByIds(ids)
  } catch (e) {
    console.error('Failed to load related provider profiles:', e)
  }
}

onLoad(async (options) => {
  const uniqueId = (options && (options as any).uniqueId) as string | undefined
  const id = (options && (options as any).id) as string | undefined
  try {
    await refreshAuthState()

    loading.value = true
    demand.value = null
    demandId.value = ''
    uniqueDemandId.value = ''
    currentRawId.value = ''
    if (uniqueId) {
      await ensureLogin()
      const decodedUniqueId = safeDecodeURIComponent(String(uniqueId))
      uniqueDemandId.value = decodedUniqueId
      demandId.value = decodedUniqueId
      const u = await fetchUniqueDemandById(decodedUniqueId)
      if (u) {
        let mapped = mapUniqueToDemand(u)

        const canonicalRawId = String((u as any)?.canonical_raw_id || '').trim()
        if (canonicalRawId) {
          try {
            const raw = await fetchSapDemandById(canonicalRawId)
            if (raw && raw.raw_text) {
              currentRawId.value = canonicalRawId
              // Use raw id as the canonical interaction key (favorites/contact unlock/status)
              demandId.value = canonicalRawId
              const parsed = parseDemandText(String(raw.raw_text || '').trim())
              const moduleCodes = (parsed.module_codes || [])
                .map((x) => String(x || '').trim().toUpperCase())
                .filter(Boolean)
              const moduleLabels = moduleCodes.map((c) => {
                if (c === 'FICO') return 'FI/CO'
                if (c === 'OTHER') return '其他'
                return c
              })

              mapped = {
                ...mapped,
                raw_text: String(raw.raw_text || '').trim(),
                module_codes: moduleCodes,
                module_labels: moduleLabels,
                city: parsed.city || '',
                duration_text: parsed.duration_text || '',
                years_text: parsed.years_text || '',
                language: parsed.language || '',
                daily_rate: parsed.daily_rate || '',
                richness_score:
                  (raw as any)?.richness_score !== undefined && (raw as any)?.richness_score !== null
                    ? Number((raw as any).richness_score)
                    : Number((mapped as any).richness_score || 0),
                provider_name: raw.provider_name || mapped.provider_name,
                provider_user_id: raw.provider_user_id || mapped.provider_user_id,
                wechat_id: raw.wechat_id || mapped.wechat_id,
                qq_number: raw.qq_number || mapped.qq_number,
                contact_remark: raw.contact_remark || mapped.contact_remark,
                createdAt: raw.createdAt || mapped.createdAt,
                updatedAt: raw.updatedAt || mapped.updatedAt,
              }
            }
          } catch (e) {
            console.error('Failed to load canonical raw demand:', e)
          }
        }

        demand.value = mapped
        viewerProfile.value = await getUserProfileOnly()
        loadUnlockState()
        await loadSimilarDemands(mapped.raw_text, currentRawId.value || undefined, undefined)
        await loadStatusData()
        await loadReliabilityData()
        try {
          isFavorited.value = await isFavorite(demandId.value)
        } catch (e) {
          console.error('Failed to check favorite state:', e)
        }
        return
      }

      // uniqueId was provided but record not found.
      demand.value = null
      return
    }

    if (id) {
      const decodedId = safeDecodeURIComponent(String(id))

      // If id looks like a unique demand doc_id (raw_ud_ prefix), redirect to uniqueId flow
      if (/^raw_ud_/i.test(decodedId)) {
        uniqueDemandId.value = decodedId
        demandId.value = decodedId
        const u = await fetchUniqueDemandById(decodedId)
        if (u) {
          let mapped = mapUniqueToDemand(u)
          const canonicalRawId = String((u as any)?.canonical_raw_id || '').trim()
          if (canonicalRawId) {
            try {
              const raw = await fetchSapDemandById(canonicalRawId)
              if (raw && raw.raw_text) {
                currentRawId.value = canonicalRawId
                demandId.value = canonicalRawId
                const parsed = parseDemandText(String(raw.raw_text || '').trim())
                const moduleCodes = (parsed.module_codes || [])
                  .map((x) => String(x || '').trim().toUpperCase())
                  .filter(Boolean)
                const moduleLabels = moduleCodes.map((c) => {
                  if (c === 'FICO') return 'FI/CO'
                  if (c === 'OTHER') return '其他'
                  return c
                })
                mapped = {
                  ...mapped,
                  raw_text: String(raw.raw_text || '').trim(),
                  module_codes: moduleCodes,
                  module_labels: moduleLabels,
                  city: parsed.city || '',
                  duration_text: parsed.duration_text || '',
                  years_text: parsed.years_text || '',
                  language: parsed.language || '',
                  daily_rate: parsed.daily_rate || '',
                  richness_score:
                    (raw as any)?.richness_score !== undefined && (raw as any)?.richness_score !== null
                      ? Number((raw as any).richness_score)
                      : Number((mapped as any).richness_score || 0),
                  provider_name: raw.provider_name || mapped.provider_name,
                  provider_user_id: raw.provider_user_id || mapped.provider_user_id,
                  wechat_id: raw.wechat_id || mapped.wechat_id,
                  qq_number: raw.qq_number || mapped.qq_number,
                  contact_remark: raw.contact_remark || mapped.contact_remark,
                  createdAt: raw.createdAt || mapped.createdAt,
                  updatedAt: raw.updatedAt || mapped.updatedAt,
                }
              }
            } catch (e) {
              console.error('Failed to load canonical raw demand:', e)
            }
          }
          demand.value = mapped
          viewerProfile.value = await getUserProfileOnly()
          loadUnlockState()
          await loadSimilarDemands(mapped.raw_text, currentRawId.value || undefined, undefined)
          await loadStatusData()
          await loadReliabilityData()
          try {
            isFavorited.value = await isFavorite(demandId.value)
          } catch (e) {
            console.error('Failed to check favorite state:', e)
          }
          return
        }
        demand.value = null
        return
      }

      demandId.value = decodedId
      let fromCloud: SapDemandRecord | null = null
      try {
        fromCloud = await fetchSapDemandById(decodedId)
      } catch (e) {
        console.error('Failed to load raw demand by id, will fallback via unique table canonical_raw_id mapping:', e)
        fromCloud = null
      }
      if (!fromCloud) {
        // Raw record may be deleted; fallback via unique table canonical_raw_id mapping.
        const uid = await lookupUniqueIdByRawId(decodedId)
        if (uid) {
          uniqueDemandId.value = uid
          demandId.value = uid
          const u = await fetchUniqueDemandById(uid)
          if (u) {
            const mapped = mapUniqueToDemand(u)
            demand.value = mapped
            viewerProfile.value = await getUserProfileOnly()
            loadUnlockState()
            await loadSimilarDemands(mapped.raw_text, undefined, undefined)
            await loadStatusData()
            await loadReliabilityData()
            isFavorited.value = await resolveFavoriteState([uid, decodedId])
            return
          }
        }
      } else {
        demand.value = fromCloud
        currentRawId.value = decodedId

        const linkedUnique = String((fromCloud as any)?.unique_demand_id || '').trim()
        if (linkedUnique) {
          uniqueDemandId.value = linkedUnique
        }

        viewerProfile.value = await getUserProfileOnly()
        loadUnlockState()
        // 加载相似需求
        await loadSimilarDemands(fromCloud.raw_text, decodedId, fromCloud.provider_user_id)
        // 加载状态和评价数据
        await loadStatusData()
        await loadReliabilityData()
        // 检查收藏状态
        isFavorited.value = await resolveFavoriteState([uniqueDemandId.value, decodedId])
        return
      }

      // id was provided but record not found.
      demand.value = null
      return
    }

    // No id/uniqueId provided; keep legacy demo fallback.
    demand.value = SAMPLE_DEMANDS[0] || null
    viewerProfile.value = await getUserProfileOnly()
  } catch (e) {
    console.error('Failed to load demand detail:', e)
    demand.value = null
  } finally {
    loading.value = false
  }
})

// 加载状态数据
const loadStatusData = async () => {
  if (!demandId.value) return
  try {
    const counts = await getDemandStatusCounts(demandId.value)
    statusCounts.value = counts
    
    // 拉取最新标记者昵称（仅对已到岗/需求关闭展示）
    const latestNames = await getLatestStatusNicknames(demandId.value, ['onboarded', 'closed'])
    statusNicknames.value = latestNames as Record<string, string>
    
    const state: any = await ensureLogin().catch(() => null as any)
    const isGuestLocal = !!(state && state.user && (state.user as any)._isGuest)
    if (isGuestLocal) {
      userStatuses.value = []
      return
    }

    const user = await getOrCreateUserProfile()
    const userStatusesList = await getUserDemandStatuses(demandId.value, user.uid)
    userStatuses.value = userStatusesList
  } catch (e) {
    console.error('Failed to load status data:', e)
  }
}

// 加载评价数据
const loadReliabilityData = async () => {
  if (!demandId.value) return
  try {
    const counts = await getDemandReliabilityCounts(demandId.value)
    // 确保评价数量都有值，即使为0
    reliabilityCounts.value = {
      reliable: counts.reliable || 0,
      unreliable: counts.unreliable || 0,
    }
    
    const state: any = await ensureLogin().catch(() => null as any)
    const isGuestLocal = !!(state && state.user && (state.user as any)._isGuest)
    if (isGuestLocal) {
      userReliability.value = null
      return
    }

    const user = await getOrCreateUserProfile()
    const userRel = await getUserDemandReliability(demandId.value, user.uid)
    userReliability.value = userRel === true ? true : userRel === false ? false : null
  } catch (e: any) {
    console.error('Failed to load reliability data:', e)
    // 设置默认值
    reliabilityCounts.value = {
      reliable: 0,
      unreliable: 0,
    }
  }
}

// 处理状态点击
const handleStatusClick = async (status: typeof statusOptions[0]) => {
  if (!demandId.value) return
  if (isGuest.value) {
    uni.showToast({ title: '游客模式无法标记状态', icon: 'none' })
    return
  }

  // 让广场页 onShow 必定命中并刷新（兼容 canonical/raw/unique 三种 key）
  touchStatusDemandIds(demandId.value, uniqueDemandId.value, currentRawId.value)

  try {
    await requireNonGuest()
    const user = await getOrCreateUserProfile()

    const primaryId = String(demandId.value || '').trim()
    const secondaryId = String(uniqueDemandId.value || '').trim()
    const extraIds = secondaryId && secondaryId !== primaryId ? [secondaryId] : []
    
    // 先刷新用户状态列表，确保数据是最新的
    await loadStatusData()
    
    // 如果已标记，则执行取消逻辑
    if (userStatuses.value.includes(status.value)) {
      if (status.value === 'onboarded' || status.value === 'closed') {
        const confirmCancel = await new Promise<boolean>((resolve) => {
          uni.showModal({
            title: '取消状态',
            content: `是否取消“${status.label}”？\n\n您的昵称：${user.nickname || '匿名用户'}`,
            confirmText: '取消标记',
            cancelText: '保留',
            success: (res) => resolve(res.confirm),
            fail: () => resolve(false),
          })
        })
        if (!confirmCancel) return
      }
      
      await unmarkDemandStatus(primaryId, status.value as any, user.uid)
      for (const id of extraIds) {
        try {
          await unmarkDemandStatus(id, status.value as any, user.uid)
        } catch {}
      }
      touchStatusDemandIds(demandId.value, uniqueDemandId.value, currentRawId.value)
      await new Promise(resolve => setTimeout(resolve, 500))
      await loadStatusData()
      uni.showToast({ title: '状态已取消', icon: 'none' })
      return
    }
    
    // 仅“已到岗(onboarded)”和“需求关闭(closed)”需要确认，其余直接提交
    if (status.value === 'onboarded' || status.value === 'closed') {
      const confirm = await new Promise<boolean>((resolve) => {
        uni.showModal({
          title: '确认状态',
          content: `${status.confirmMessage}\n\n您的昵称：${user.nickname || '匿名用户'}`,
          confirmText: '确认',
          cancelText: '取消',
          success: (res) => resolve(res.confirm),
          fail: () => resolve(false),
        })
      })
      
      if (!confirm) return
    }
    
    console.log('开始标记状态:', status.value)
    await markDemandStatus(primaryId, status.value as any, user.nickname || '匿名用户')
    for (const id of extraIds) {
      try {
        await markDemandStatus(id, status.value as any, user.nickname || '匿名用户')
      } catch {}
    }
    console.log('状态标记完成')

    touchStatusDemandIds(demandId.value, uniqueDemandId.value, currentRawId.value)
    
    // 等待一小段时间，确保数据库已更新
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 刷新状态数据（包括数量和用户状态）
    console.log('开始刷新状态数据')
    await loadStatusData()
    console.log('状态数据刷新完成，当前数量:', statusCounts.value)
    
    uni.showToast({ title: '状态标记成功', icon: 'success' })
  } catch (e: any) {
    console.error('Failed to mark/unmark status:', e)
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    uni.showToast({ title: msg || '标记失败', icon: 'none' })
  }
}

// 处理评价点击
const handleReliabilityClick = async (reliable: boolean) => {
  if (!demandId.value) return
  if (reliabilityBusy.value) return

  const prevUserReliability = userReliability.value
  const prevCounts = { ...(reliabilityCounts.value || { reliable: 0, unreliable: 0 }) }

  // 点击即反馈：先做乐观高亮/取消高亮（鉴权/接口失败再回滚）
  const nextUserReliability = userReliability.value === reliable ? null : reliable
  userReliability.value = nextUserReliability

  try {
    reliabilityBusy.value = true
    await requireNonGuest()
    const user = await getOrCreateUserProfile()

    const primaryId = String(demandId.value || '').trim()
    const secondaryId = String(uniqueDemandId.value || '').trim()
    const extraIds = secondaryId && secondaryId !== primaryId ? [secondaryId] : []

    if (nextUserReliability === null) {
      await unmarkDemandReliability(primaryId, user.uid)
      for (const id of extraIds) {
        try {
          await unmarkDemandReliability(id, user.uid)
        } catch {}
      }

      touchReliabilityDemandIds(demandId.value, uniqueDemandId.value, currentRawId.value)

      // 取消评价：扣回积分
      const points = getRewardPoints('markDemandReliability')
      if (points > 0) {
        updateUserProfile({}, { addPoints: -points }).catch(() => {})
      }

      // 取消后以服务端为准刷新 counts
      loadReliabilityData().catch(() => {})

      if (points > 0) {
        uni.showToast({ title: `评价已取消，积分 -${points}`, icon: 'none' })
      } else {
        uni.showToast({ title: '评价已取消', icon: 'none' })
      }
    } else {
      await markDemandReliability(primaryId, reliable, user.nickname || '匿名用户')
      for (const id of extraIds) {
        try {
          await markDemandReliability(id, reliable, user.nickname || '匿名用户')
        } catch {}
      }

      touchReliabilityDemandIds(demandId.value, uniqueDemandId.value, currentRawId.value)

      // 只有“首次评价（从 null -> true/false）”才加积分；从 true<->false 视为修改，不重复加分
      const points = prevUserReliability === null ? getRewardPoints('markDemandReliability') : 0
      if (points > 0) {
        updateUserProfile({}, { addPoints: points }).catch(() => {})
        uni.showToast({ title: `评价成功，积分 +${points}`, icon: 'success' })
      } else {
        uni.showToast({ title: reliable ? '已标记为靠谱' : '已标记为不靠谱', icon: 'none' })
      }

      // 标记/修改后以服务端为准刷新 counts
      loadReliabilityData().catch(() => {})
    }

    // 异步校准：做重试刷新，确保最终与服务端一致
    const refreshRelWithRetry = async () => {
      const tries = [200, 400, 800, 1200]
      for (let i = 0; i < tries.length; i++) {
        await new Promise((r) => setTimeout(r, tries[i]))
        await loadReliabilityData()
        if (userReliability.value === true || userReliability.value === false || userReliability.value === null) return
      }
    }
    refreshRelWithRetry().catch(() => {})
  } catch (e: any) {
    console.error('Failed to mark reliability:', e)
    // 失败回滚
    try {
      userReliability.value = prevUserReliability
      reliabilityCounts.value = prevCounts as any
    } catch {}
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    uni.showToast({ title: msg || '评价失败', icon: 'none' })
  } finally {
    reliabilityBusy.value = false
  }
}

// 复制联系方式
const copyContact = (type: 'wechat' | 'qq', value: string) => {
  if (!value) return
  try {
    uni.setClipboardData({
      data: value,
      success: () => {
        uni.showToast({
          title: `${type === 'wechat' ? '微信' : 'QQ'}号已复制`,
          icon: 'success',
          duration: 2000
        })
      }
    })
  } catch (e) {
    console.error('Failed to copy:', e)
    uni.showToast({
      title: '复制失败，请手动复制',
      icon: 'none',
    })
  }
}

const emitFavoriteChanged = () => {
  if (!demandId.value) return
  try {
    uni.$emit('favoriteChanged', { demandId: demandId.value, isFavorited: isFavorited.value })
  } catch (e) {
    console.error('Failed to emit favoriteChanged:', e)
  }
}

// 切换收藏状态
const toggleFavorite = async () => {
  if (!demandId.value) return
  if (favoriting.value) return
  
  favoriting.value = true
  try {
    await requireNonGuest()

    const rawId = String(currentRawId.value || '').trim()
    const uniqueId = String(uniqueDemandId.value || '').trim()
    const addId = uniqueId || String(demandId.value || '').trim()
    const removeIds = Array.from(new Set([addId, rawId, uniqueId].map((x) => String(x || '').trim()).filter(Boolean)))
    
    if (isFavorited.value) {
      for (const rid of removeIds) {
        try {
          await removeFavorite(rid)
        } catch (e: any) {
          const msg = String(e?.message || '')
          if (msg.includes('未收藏')) continue
          throw e
        }
      }
      isFavorited.value = false
      emitFavoriteChanged()
      uni.showToast({ title: '已取消收藏', icon: 'success' })
    } else {
      await addFavorite(addId)
      isFavorited.value = true
      emitFavoriteChanged()
      uni.showToast({ title: '收藏成功', icon: 'success' })
    }
  } catch (e: any) {
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    if (msg.includes('已经收藏')) {
      isFavorited.value = true
      emitFavoriteChanged()
      uni.showToast({ title: '收藏成功', icon: 'success' })
    } else if (msg.includes('未收藏')) {
      isFavorited.value = false
      emitFavoriteChanged()
      uni.showToast({ title: '已取消收藏', icon: 'success' })
    } else {
      console.error('Failed to toggle favorite:', e)
      uni.showToast({ title: msg || '操作失败', icon: 'none' })
    }
  } finally {
    favoriting.value = false
  }
}

const showContactAccessInfo = () => {
  if (canViewContact.value) return
  
  // 显示解锁提示对话框
  const currentPoints = viewerProfile.value?.points || 0
  const needPoints = Math.max(0, VIEW_CONTACT_THRESHOLD - currentPoints)
  
  // 从配置读取积分规则
  const config = getPointsConfig()
  const rulesText = `积分规则：\n• 注册成功：+${config.rewards.register} 分\n• 完善个人资料：+${config.rewards.completeProfile} 分\n• 发布需求：+${config.rewards.publishDemand} 分\n• 评价/标记需求：+${config.rewards.markDemandStatus} 分\n\n查看联系方式需要 ${VIEW_CONTACT_THRESHOLD} 积分`
  
  let message = ''
  if (!viewerProfile.value) {
    message = `需要登录后才能查看联系方式\n\n${rulesText}`
  } else {
    message = `当前积分：${currentPoints} 分\n还需积分：${needPoints} 分\n\n${rulesText}`
  }
  
  uni.showModal({
    title: '查看联系方式',
    content: message,
    showCancel: true,
    cancelText: '知道了',
    confirmText: viewerProfile.value ? '去完善资料' : '去登录',
    success: (res) => {
      if (res.confirm) {
        if (viewerProfile.value) {
          // 跳转到个人中心
          uni.navigateTo({
            url: '/pages/profile/profile'
          })
        } else {
          // 跳转到登录页
          uni.navigateTo({
            url: '/pages/login/password-login'
          })
        }
      }
    }
  })
}

// 加载相似需求（同一用户只显示一次，保留最早的需求）
const loadSimilarDemands = async (rawText: string, currentId?: string, currentUserId?: string) => {
  try {
    const userDemandMap = new Map<string, any>() // 用于记录每个用户最早的需求

    const similarityCheck = await checkSimilarDemandsByPolicy({
      rawText,
      currentUserId,
      days: 60,
      limit: 200,
      threshold: 0.85,
      rule: 'text',
    })

    const demands = (similarityCheck && similarityCheck.similarDemands) || []
    for (const d of demands) {
      const id = String((d as any)?.id || '').trim()
      if (currentId && id && id === String(currentId || '').trim()) {
        continue
      }

      const dText = String((d as any)?.raw_text || '')
      const similarity = typeof (d as any)?.similarity === 'number' ? (d as any).similarity : calculateTextSimilarity(rawText, dText)
      if (similarity < 0.85) continue

      const userId = String((d as any)?.provider_user_id || 'unknown')
      const createdAt = (d as any)?.createdAt
      const demandTime = createdAt ? new Date(createdAt).getTime() : 0

      if (!userDemandMap.has(userId) || (userDemandMap.get(userId).createdAtTime > demandTime)) {
        userDemandMap.set(userId, {
          id,
          unique_demand_id: (d as any)?.unique_demand_id,
          raw_text: dText,
          createdAt,
          provider_user_id: userId,
          provider_name: String((d as any)?.provider_name || '未知'),
          similarity: Math.round(similarity * 100) / 100,
          createdAtTime: demandTime,
        })
      }
    }
    
    // 将 Map 转换为数组，并按创建时间排序（最早的在前）
    const list = Array.from(userDemandMap.values()).sort((a, b) => {
      return a.createdAtTime - b.createdAtTime
    })

    // 注意：不允许在“无相似需求”时随意选择一条 raw 需求并强制标记 100%。
    // uniqueId 无相似的兜底展示逻辑由 relatedDemands computed 统一处理（展示唯一表自身）。
    similarDemands.value = list

    await loadRelatedProfiles(relatedDemands.value)
  } catch (e) {
    console.error('Failed to load similar demands:', e)
  }
}

// 格式化时间已在上方定义
// 跳转到需求详情
const goToDemandDetail = (id?: string) => {
  if (!id) return
  navigateTo(`/pages/demand/detail?id=${id}`)
}

const goToRelatedDemandDetail = (item: RelatedDemandItem) => {
  if (!item) return

  const rawId = String(item.id || '').trim()
  const uniqueId = String(item.unique_demand_id || '').trim()

  // 防止重复打开当前页
  if (uniqueId && String(demandId.value || '').trim() === uniqueId) return
  if (rawId && currentRawId.value && rawId === String(currentRawId.value || '').trim()) return

  if (uniqueId) {
    navigateTo(`/pages/demand/detail?uniqueId=${encodeURIComponent(uniqueId)}`)
    return
  }

  if (rawId) {
    navigateTo(`/pages/demand/detail?id=${encodeURIComponent(rawId)}`)
  }
}

const goToReport = () => {
  const id = demandId.value
  let query = ''
  if (id) {
    query = `demandId=${encodeURIComponent(id)}`
  }

  const sourceUrl = typeof window !== 'undefined' && window?.location?.href ? window.location.href : ''
  if (sourceUrl) {
    query = query ? `${query}&sourceUrl=${encodeURIComponent(sourceUrl)}` : `sourceUrl=${encodeURIComponent(sourceUrl)}`
  }

  const url = query ? `/pages/legal/report?${query}` : '/pages/legal/report'
  uni.navigateTo({ url })
}

const goToContact = () => {
  uni.navigateTo({ url: '/pages/legal/contact' })
}

const getRelatedProviderProfile = (item: RelatedDemandItem): UserProfile | null => {
  const pid = String(item.provider_user_id || '').trim()
  if (!pid) return null
  const viewerUid = String(viewerProfile.value?.uid || '').trim()
  if (viewerUid && pid === viewerUid) return viewerProfile.value
  return relatedProfilesById.value[pid] || null
}

const getRelatedWechatId = (item: RelatedDemandItem): string => {
  const fromItem = String(item?.wechat_id || '').trim()
  if (fromItem) return fromItem
  const p = getRelatedProviderProfile(item)
  return String(p?.wechat_id || '').trim()
}

const getRelatedQqNumber = (item: RelatedDemandItem): string => {
  const fromItem = String(item?.qq_number || '').trim()
  if (fromItem) return fromItem
  const p = getRelatedProviderProfile(item)
  return String(p?.qq_id || '').trim()
}

const getRelatedContactRemark = (item: RelatedDemandItem): string => {
  return String(item?.contact_remark || '').trim()
}

const hasRelatedContactInfo = (item: RelatedDemandItem): boolean => {
  return Boolean(getRelatedWechatId(item) || getRelatedQqNumber(item) || getRelatedContactRemark(item))
}

const canShareProviderContact = (p: UserProfile | null): boolean => {
  if (!p) return false
  const raw = (p as any).can_share_contact
  const alt = (p as any).allow_show_contact ?? (p as any).allowShowContact
  const val = raw !== undefined && raw !== null ? raw : alt

  // 保持与 getOrCreateUserProfile / getUserProfileOnly 的缺省策略一致：
  // 若字段缺失，视为允许展示，避免前后端字段差异导致误判“未开放”。
  if (val === undefined || val === null) return true
  if (val === true) return true
  if (val === false) return false
  if (val === 1 || val === '1') return true
  if (val === 0 || val === '0') return false
  return Boolean(val)
}

const isSelfProvider = (item: RelatedDemandItem): boolean => {
  const pid = String(item.provider_user_id || '').trim()
  if (!pid) return false
  const viewerUid = String(viewerProfile.value?.uid || '').trim()
  if (!viewerUid) return false
  return pid === viewerUid
}

const getRelatedProviderName = (item: RelatedDemandItem): string => {
  const p = getRelatedProviderProfile(item)
  const nameFromProfile = String(p?.nickname || '').trim()
  const nameFromItem = String((item as any)?.provider_name || '').trim()
  const bad = new Set(['', '未知', '匿名', '匿名用户'])

  if (nameFromProfile && !bad.has(nameFromProfile)) return nameFromProfile
  if (nameFromItem && !bad.has(nameFromItem)) return nameFromItem
  return '未知'
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
</script>

<style lang="scss" scoped>
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
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

.header-left, .header-right {
  width: 120rpx;
  display: flex;
  align-items: center;
}

.header-right {
  justify-content: flex-end;
}

.page-header-title {
  color: #F5F1E8;
  font-size: 32rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
  flex: 1;
  text-align: center;
}

.header-right {
  justify-content: flex-end;
}

.content-scroll {
  flex: 1;
  height: 0;
}

.detail-container {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.detail-card {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 30rpx;
  border: 2rpx solid rgba(11, 25, 36, 0.05);
  box-shadow: 0 4rpx 16rpx rgba(11, 25, 36, 0.03);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.header-main-info {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.favorite-action-btn {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 20rpx;
  background: #f8fafc;
  border: 1rpx solid #e2e8f0;
  border-radius: 99rpx;
  transition: all 0.2s;
}

.favorite-action-btn--active {
  background: #fff1f2;
  border-color: #fecdd3;
}

.fav-text {
  font-size: 22rpx;
  color: #64748b;
  font-weight: 700;
}

.favorite-action-btn--active .fav-text {
  color: #ef4444;
}

.detail-tags-margin {
  margin-top: 20rpx;
}

/* 紧凑状态按钮 */
.compact-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 20rpx;
}

.compact-status-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 10rpx 16rpx;
  background: #f8fafc;
  border: 1rpx solid #f1f5f9;
  border-radius: 8rpx;
  transition: all 0.2s;
}

.card-header--left {
  justify-content: flex-start !important;
  gap: 12rpx;
}

.compact-status-btn--active {
  background: #eff6ff;
  border-color: #bfdbfe;
}

/* 兼容靠谱按钮的高亮颜色 */
.compact-reliability-row .compact-status-btn--active:first-child {
  background: #ecfdf5;
  border-color: #a7f3d0;
}
.compact-reliability-row .compact-status-btn--active:first-child .csb-label { color: #059669; }

.compact-reliability-row .compact-status-btn--active:last-child {
  background: #fef2f2;
  border-color: #fecaca;
}
.compact-reliability-row .compact-status-btn--active:last-child .csb-label { color: #dc2626; }

.csb-icon { font-size: 24rpx; }
.csb-label { font-size: 22rpx; color: #475569; font-weight: 600; }
.csb-count { font-size: 20rpx; color: #94a3b8; }

.csb-count--nonzero { color: #64748b; font-weight: 700; }

.compact-status-btn--active .csb-label { color: #2563eb; }

.compact-status-btn--active .csb-count--nonzero { color: #2563eb; font-weight: 800; }

/* 详情页：靠谱/不靠谱时让非 0 数字随按钮高亮颜色 */
.compact-reliability-row .compact-status-btn--active:first-child .csb-count--nonzero { color: #059669; font-weight: 800; }
.compact-reliability-row .compact-status-btn--active:last-child .csb-count--nonzero { color: #dc2626; font-weight: 800; }

/* 紧凑评价按钮 */
.compact-reliability-row {
  display: flex;
  gap: 12rpx;
}

.compact-rel-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  height: 64rpx;
  background: #f8fafc;
  border: 1rpx solid #f1f5f9;
  border-radius: 8rpx;
}

.compact-rel-btn--active {
  background: #f0f9ff;
  border-color: #bae6fd;
}

.crb-label {
  font-size: 24rpx;
  color: #475569;
  font-weight: 700;
}

.compact-rel-btn--active .crb-label { color: #0369a1; }

.card-dot {
  width: 8rpx;
  height: 24rpx;
  background: #D97706;
  border-radius: 4rpx;
}

.card-title {
  font-size: 28rpx;
  font-weight: 800;
  color: #0B1924;
}

.raw-content {
  background: #F9FAFB;
  padding: 24rpx;
  border-radius: 12rpx;
  border: 1rpx solid #F3F4F6;
}

.raw-text {
  font-size: 28rpx;
  line-height: 1.6;
  color: #374151;
  word-break: break-all;
}

.card-footer {
  margin-top: 20rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.time-label {
  font-size: 22rpx;
  color: #9CA3AF;
}

.richness-label {
  font-size: 22rpx;
  color: #9CA3AF;
  text-align: right;
}

/* 标签网格 */
.tags-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.tag-item {
  padding: 10rpx 20rpx;
  border-radius: 8rpx;
  font-size: 24rpx;
  font-weight: 600;
}

.tag-module { background: #E0F2FE; color: #0369A1; }
.tag-city { background: #F0FDF4; color: #15803D; }
.tag-duration { background: #FEF3C7; color: #B45309; }
.tag-years { background: #F5F3FF; color: #6D28D9; }
.tag-lang { background: #ECFDF5; color: #047857; }
.tag-rate { background: #FFF1F2; color: #BE123C; }
.tag-mode { background: #F3F4F6; color: #4B5563; }
.tag-extra { background: #F9FAFB; color: #6B7280; border: 1rpx solid #E5E7EB; }

/* 状态 Pill */
.status-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
  margin-bottom: 30rpx;
}

.status-pill {
  display: flex;
  align-items: center;
  padding: 20rpx;
  background: #F9FAFB;
  border: 2rpx solid #F3F4F6;
  border-radius: 16rpx;
  transition: all 0.2s;
}

.status-pill--active {
  background: #FEF3C7;
  border-color: #FCD34D;
}

.status-icon {
  font-size: 32rpx;
  margin-right: 16rpx;
}

.status-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.status-name {
  font-size: 24rpx;
  font-weight: 700;
  color: #4B5563;
}

.status-num {
  font-size: 20rpx;
  color: #9CA3AF;
}

.status-user {
  font-size: 20rpx;
  color: #D97706;
  font-weight: 600;
}

/* 靠谱按钮 */
.reliability-row {
  display: flex;
  gap: 20rpx;
}

.rel-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  height: 80rpx;
  border-radius: 12rpx;
  background: #F9FAFB;
  border: 2rpx solid #F3F4F6;
}

.rel-btn--up.rel-btn--active { background: #DCFCE7; border-color: #86EFAC; color: #166534; }
.rel-btn--down.rel-btn--active { background: #FEE2E2; border-color: #FCA5A5; color: #991B1B; }

.rel-text {
  font-size: 26rpx;
  font-weight: 700;
}

/* 关联列表 */
.contact-lock-hint {
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 16rpx;
  background: #FFFBEB;
  border: 1rpx solid #FEF3C7;
  border-radius: 12rpx;
  margin-bottom: 24rpx;
}

.lock-text {
  font-size: 22rpx;
  color: #D97706;
  font-weight: 600;
}

.related-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.related-item {
  padding: 20rpx;
  background: #F9FAFB;
  border-radius: 12rpx;
  border: 1rpx solid #F3F4F6;
}

.related-item-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.related-source { font-size: 22rpx; color: #9CA3AF; }
.related-sim { font-size: 22rpx; font-weight: 800; color: #D97706; }

.related-excerpt {
  font-size: 26rpx;
  color: #4B5563;
  line-height: 1.5;
  margin-bottom: 20rpx;
}

.contact-box {
  border-top: 1rpx dashed #E5E7EB;
  padding-top: 20rpx;
}

.contact-empty {
  font-size: 22rpx;
  color: #9CA3AF;
  text-align: center;
}

.unlock-action {
  background: #0B1924;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
}

.unlock-btn-text {
  color: #F5F1E8;
  font-size: 22rpx;
  font-weight: 700;
}

.contact-details {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.contact-line {
  display: flex;
  align-items: center;
  background: #FFFFFF;
  padding: 12rpx 20rpx;
  border-radius: 8rpx;
  border: 1rpx solid #E5E7EB;
}

.c-label { font-size: 24rpx; color: #6B7280; }
.c-value { font-size: 24rpx; font-weight: 700; color: #0B1924; flex: 1; }
.c-copy { font-size: 20rpx; color: #3B82F6; font-weight: 600; }

.status-divider {
  height: 2rpx;
  background: rgba(11, 25, 36, 0.06);
  margin: 24rpx 0;
}

.status-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12rpx;
  margin-bottom: 24rpx;
}

.status-title {
  font-size: 28rpx;
  font-weight: 800;
  color: #111827;
}

.combined-status-section {
  margin-top: 12rpx;
}

.legal-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20rpx;
  margin: 40rpx 0 60rpx;
}

.info-row { display: flex; align-items: center; gap: 8rpx; }
.info-text { font-size: 22rpx; color: #9CA3AF; }
.info-sep { color: #E5E7EB; font-size: 20rpx; }

.loading-state, .empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.loading-text, .empty-text {
  font-size: 26rpx;
  color: #9CA3AF;
}
</style>


