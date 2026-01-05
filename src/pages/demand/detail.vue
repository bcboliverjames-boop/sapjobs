<template>
  <view class="page detail-page">
    <view class="header">
      <text class="badge">SAP 需求详情</text>
      <text class="title">原始需求内容</text>
      <text class="subtitle">
        下方展示从微信群 / QQ 群整理的完整原文和已识别的关键信息。
      </text>
    </view>

    <scroll-view class="content" scroll-y="true">
      <view v-if="loading" class="loading">
        <text class="loading-text">加载中...</text>
      </view>

      <view v-else-if="!demand" class="empty">
        <text class="empty-text">未找到对应的需求记录。</text>
      </view>

      <view v-else class="card">
        <view class="section">
          <view class="raw-header">
            <text class="section-title">原文</text>
            <view
              class="favorite-btn favorite-btn--compact"
              @tap.stop="toggleFavorite"
              :class="{ 'favorite-btn--active': isFavorited, 'guest-disabled': isGuest }"
            >
              <text class="favorite-icon">{{ isFavorited ? '❤️' : '🤍' }}</text>
            </view>
          </view>
          <text class="raw-text">
            {{ demand.raw_text }}
          </text>
        </view>

        <view class="section">
          <text class="section-title">结构化信息</text>
          <view class="tags">
            <view v-for="m in demand.module_labels" :key="m" class="tag tag--primary">
              <text>{{ m }}</text>
            </view>
            <view v-if="demand.city" class="tag">
              <text>{{ demand.city }}</text>
            </view>
            <view v-if="demand.duration_text" class="tag">
              <text>{{ demand.duration_text }}</text>
            </view>
            <view v-if="demand.years_text" class="tag">
              <text>{{ demand.years_text }}</text>
            </view>
            <view v-if="demand.language" class="tag tag--accent">
              <text>{{ demand.language }}</text>
            </view>
            <view v-if="demand.daily_rate" class="tag tag--rate">
              <text>💰 {{ formatDailyRate(demand.daily_rate) }}</text>
            </view>
          </view>
        </view>

        <!-- 状态栏和评价栏 -->
        <view class="section">
          <text class="section-title">状态与评价</text>
          
          <!-- 状态栏 -->
          <view class="status-bar">
            <view 
              v-for="status in statusOptions" 
              :key="status.value"
              class="status-item"
              :class="[
                `status-item--${status.value}`,
                { 'status-item--active': userStatuses.includes(status.value) },
                { 'guest-disabled': isGuest }
              ]"
              @tap.stop="handleStatusClick(status)"
            >
              <text class="status-icon">{{ status.icon }}</text>
              <text class="status-label">{{ status.label }}</text>
              <text class="status-count">({{ statusCounts[status.value] || 0 }})</text>
              <text 
                v-if="(status.value === 'onboarded' || status.value === 'closed') && statusNicknames[status.value]"
                class="status-nickname"
              >
                · {{ statusNicknames[status.value] }}
              </text>
            </view>
          </view>
          
          <!-- 评价栏 -->
          <view class="reliability-bar">
            <view 
              class="reliability-item reliability-item--reliable"
              :class="{ 'reliability-item--active': userReliability === true, 'guest-disabled': isGuest }"
              @tap.stop="handleReliabilityClick(true)"
            >
              <text class="reliability-icon">👍</text>
              <text class="reliability-label">靠谱</text>
              <text class="reliability-count">({{ reliabilityCounts.reliable || 0 }})</text>
            </view>
            <view 
              class="reliability-item reliability-item--unreliable"
              :class="{ 'reliability-item--active': userReliability === false, 'guest-disabled': isGuest }"
              @tap.stop="handleReliabilityClick(false)"
            >
              <text class="reliability-icon">👎</text>
              <text class="reliability-label">不靠谱</text>
              <text class="reliability-count">({{ reliabilityCounts.unreliable || 0 }})</text>
            </view>
          </view>
        </view>

        <!-- 关联需求区域 -->
        <view v-if="relatedDemands.length > 0" class="section">
          <view class="section-header">
            <view class="section-title-row">
              <text class="section-title">
                📋 关联需求（{{ relatedDemands.length }} 条）
              </text>
              <text v-if="!canViewContact" class="section-subtitle" @tap.stop="showContactAccessInfo">
                登录并达到 {{ VIEW_CONTACT_THRESHOLD }} 积分后显示联系方式
              </text>
            </view>
          </view>
          
          <view class="similar-demands-list">
            <view 
              v-for="(item, index) in relatedDemands" 
              :key="item.id || index"
              class="similar-demand-item"
              @tap="goToRelatedDemandDetail(item)"
            >
              <view class="similar-demand-header">
                <text class="similar-demand-provider">来自：{{ getRelatedProviderName(item) }}</text>
                <text v-if="item.isSelf" class="similar-demand-similarity">相似度 100%</text>
                <text v-else class="similar-demand-similarity">相似度 {{ Math.round(item.similarity * 100) }}%</text>
              </view>
              <text class="similar-demand-text">{{ item.raw_text }}</text>
              <text v-if="item.createdAt" class="similar-demand-time">{{ formatTime(item.createdAt) }}</text>

              <view v-if="canViewContact" class="related-contact" @tap.stop>
                <view v-if="!getRelatedProviderProfile(item)" class="provider-meta">
                  发布者未注册或档案未同步，暂无法展示联系方式
                </view>
                <view v-else>
                  <view v-if="!getRelatedProviderProfile(item)?.can_share_contact" class="provider-meta">
                    发布者未开放联系方式
                  </view>
                  <view v-else-if="!getRelatedProviderProfile(item)?.wechat_id && !getRelatedProviderProfile(item)?.qq_id" class="provider-meta">
                    发布者暂未提供联系方式
                  </view>
                  <view v-else>
                    <view v-if="!isContactUnlocked(item)" class="unlock-row" @tap.stop>
                      <button class="unlock-btn" :class="{ 'guest-disabled': isGuest }" @tap.stop="unlockRelatedContact(item)">点击解锁联系方式</button>
                      <text class="unlock-hint">解锁后可复制微信/QQ（仅用于项目沟通，请勿骚扰）</text>
                    </view>
                    <view v-else class="related-contact-inner">
                      <view v-if="getRelatedProviderProfile(item)?.wechat_id" class="contact-item" @tap.stop="copyContact('wechat', String(getRelatedProviderProfile(item)?.wechat_id))">
                        <text class="contact-label">微信：</text>
                        <text class="contact-value">{{ getRelatedProviderProfile(item)?.wechat_id }}</text>
                        <text class="contact-copy">点击复制</text>
                      </view>
                      <view v-if="getRelatedProviderProfile(item)?.qq_id" class="contact-item" @tap.stop="copyContact('qq', String(getRelatedProviderProfile(item)?.qq_id))">
                        <text class="contact-label">QQ：</text>
                        <text class="contact-value">{{ getRelatedProviderProfile(item)?.qq_id }}</text>
                        <text class="contact-copy">点击复制</text>
                      </view>
                    </view>
                  </view>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="section-title">评论</text>
          <view class="empty">
            <text class="empty-text">评论功能暂未开放。</text>
          </view>
        </view>

        <view class="legal-footer">
          <view class="legal-links">
            <view class="legal-link" @tap.stop="goToReport">
              <uni-icons type="info" size="14" color="rgba(197, 208, 221, 0.75)" />
              <text class="legal-link-text">投诉举报</text>
            </view>
            <text class="legal-dot">·</text>
            <view class="legal-link" @tap.stop="goToContact">
              <uni-icons type="email" size="14" color="rgba(197, 208, 221, 0.75)" />
              <text class="legal-link-text">联系我们</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  fetchSapDemandById,
  SAMPLE_DEMANDS,
  type SapDemandRecord,
} from '../../utils/sap-demands'
import { parseDemandText } from '../../utils/demand-parser'
import { fetchUniqueDemandById, type SapUniqueDemandDoc } from '../../utils/sap-unique-demands'
import { ensureLogin, requireNonGuest, isGuestUser } from '../../utils/cloudbase'
import { getOrCreateUserProfile, getProfilesByIds, getUserProfileOnly, type UserProfile } from '../../utils/user'
import { getThresholdPoints, getPointsConfig } from '../../utils/points-config'
import { addFavorite, removeFavorite, isFavorite } from '../../utils/favorites'
import { navigateTo } from '../../utils'
import { calculateTextSimilarity, checkSimilarDemandsByPolicy } from '../../utils/demand-similarity'
import { unlockContact } from '../../utils/ugc'
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
const viewerProfile = ref<UserProfile | null>(null)
const currentRawId = ref<string>('')
const relatedProfilesById = ref<Record<string, UserProfile>>({})

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

type RelatedDemandItem = {
  id?: string
  unique_demand_id?: string
  raw_text: string
  createdAt?: Date | string
  provider_user_id?: string
  provider_name: string
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

const mapUniqueToDemand = (doc: SapUniqueDemandDoc): SapDemandRecord => {
  const rawText = String(doc?.raw_text || '').trim()
  const parsed = parseDemandText(rawText)
  const moduleCodes = (parsed.module_codes || []).map((x) => String(x || '').trim().toUpperCase()).filter(Boolean)
  const moduleLabels = moduleCodes.map((c) => {
    if (c === 'FICO') return 'FI/CO'
    if (c === 'OTHER') return '其他'
    return c
  })

  return {
    id: (doc as any)?._id,
    raw_text: rawText,
    module_labels: moduleLabels,
    module_codes: moduleCodes,
    city: parsed.city || '',
    duration_text: parsed.duration_text || '',
    years_text: parsed.years_text || '',
    language: parsed.language || '',
    daily_rate: parsed.daily_rate || '',
    provider_name: (doc as any)?.publisher_name || '未知',
    provider_user_id: (doc as any)?.provider_id || undefined,
    createdAt: (doc as any)?.created_time || (doc as any)?.message_time,
    updatedAt: (doc as any)?.last_updated_time || (doc as any)?.updated_at,
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
      similarity: 1,
      isSelf: true,
    })
  }

  const self = out[0]
  const selfId = String(self?.id || '').trim()
  const selfProvider = String(self?.provider_user_id || '').trim()
  const selfText = String(self?.raw_text || '').trim()

  const others: RelatedDemandItem[] = (similarDemands.value || [])
    .map((s) => ({
      id: s.id,
      unique_demand_id: s.unique_demand_id,
      raw_text: s.raw_text,
      createdAt: s.createdAt,
      provider_user_id: s.provider_user_id,
      provider_name: s.provider_name,
      similarity: s.similarity,
      isSelf: false,
    }))
    .filter((x) => {
      if (!self) return true
      if (selfId && x.id && String(x.id).trim() === selfId) return false
      const sameProvider = selfProvider && String(x.provider_user_id || '').trim() === selfProvider
      const simToSelf = calculateTextSimilarity(selfText, String(x.raw_text || ''))
      if (simToSelf === 1 && sameProvider) return false
      return true
    })

  return [...out, ...others]
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
    try {
      const state: any = await ensureLogin()
      isGuest.value = !!(state && isGuestUser(state.user))
    } catch {
      isGuest.value = false
    }

    loading.value = true
    demand.value = null
    if (uniqueId) {
      await ensureLogin()
      const decodedUniqueId = safeDecodeURIComponent(String(uniqueId))
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
                provider_name: raw.provider_name || mapped.provider_name,
                provider_user_id: raw.provider_user_id || mapped.provider_user_id,
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
    }

    if (id) {
      const decodedId = safeDecodeURIComponent(String(id))
      demandId.value = decodedId
      const fromCloud = await fetchSapDemandById(decodedId)
      if (fromCloud) {
        demand.value = fromCloud
        currentRawId.value = decodedId
        viewerProfile.value = await getUserProfileOnly()
        loadUnlockState()
        // 加载相似需求
        await loadSimilarDemands(fromCloud.raw_text, decodedId, fromCloud.provider_user_id)
        // 加载状态和评价数据
        await loadStatusData()
        await loadReliabilityData()
        // 检查收藏状态
        try {
          isFavorited.value = await isFavorite(decodedId)
        } catch (e) {
          console.error('Failed to check favorite state:', e)
        }
        return
      }
    }
    // 没有 id 或云端找不到时，退回本地示例
    demand.value = SAMPLE_DEMANDS[0] || null
    viewerProfile.value = await getUserProfileOnly()
  } catch (e) {
    console.error('Failed to load demand detail:', e)
    demand.value = SAMPLE_DEMANDS[0] || null
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
    userReliability.value = userRel
  } catch (e) {
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
  try {
    await requireNonGuest()
    const user = await getOrCreateUserProfile()
    
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
      
      await unmarkDemandStatus(demandId.value!, status.value as any, user.uid)
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
    await markDemandStatus(demandId.value!, status.value as any, user.nickname || '匿名用户')
    console.log('状态标记完成')
    
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
  try {
    await requireNonGuest()
    const user = await getOrCreateUserProfile()
    
    // 先刷新用户评价，确保数据是最新的
    await loadReliabilityData()
    
    // 如果已评价且相同，则取消
    if (userReliability.value === reliable) {
      await unmarkDemandReliability(demandId.value!, user.uid)
      await new Promise(resolve => setTimeout(resolve, 300))
      await loadReliabilityData()
      uni.showToast({ title: '评价已取消', icon: 'none' })
      return
    }
    
    console.log('开始标记评价:', reliable)
    await markDemandReliability(demandId.value!, reliable, user.nickname || '匿名用户')
    console.log('评价标记完成')
    
    // 等待一小段时间，确保数据库已更新
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // 刷新评价数据（包括数量和用户评价）
    console.log('开始刷新评价数据')
    await loadReliabilityData()
    console.log('评价数据刷新完成，当前数量:', reliabilityCounts.value)
    
    uni.showToast({ title: reliable ? '已标记为靠谱' : '已标记为不靠谱', icon: 'success' })
  } catch (e: any) {
    console.error('Failed to mark reliability:', e)
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    uni.showToast({ title: msg || '评价失败', icon: 'none' })
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
    
    if (isFavorited.value) {
      await removeFavorite(demandId.value)
      isFavorited.value = false
      emitFavoriteChanged()
      uni.showToast({ title: '已取消收藏', icon: 'success' })
    } else {
      await addFavorite(demandId.value)
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
  const rulesText = `积分规则：\n• 注册成功：+${config.rewards.register} 分\n• 完善个人资料：+${config.rewards.completeProfile} 分\n• 发布需求：+${config.rewards.publishDemand} 分\n\n查看联系方式需要 ${VIEW_CONTACT_THRESHOLD} 积分`
  
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
  return relatedProfilesById.value[pid] || null
}

const getRelatedProviderName = (item: RelatedDemandItem): string => {
  const p = getRelatedProviderProfile(item)
  const nameFromProfile = String(p?.nickname || '').trim()
  const bad = new Set(['', '未知', '匿名', '匿名用户'])

  if (nameFromProfile && !bad.has(nameFromProfile)) return nameFromProfile
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

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  padding: 16rpx 24rpx 24rpx;
  background: linear-gradient(135deg, #0b1924 0%, #1b2a38 45%, #101820 100%);
}

.header {
  padding: 24rpx 8rpx 12rpx;
  color: #f5f5f5;
  position: relative;
}

.header-favorite {
  position: absolute;
  top: 24rpx;
  right: 12rpx;
  z-index: 2;
}

.badge {
  font-size: 20rpx;
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  border-width: 2rpx;
  border-style: solid;
  border-color: rgba(255, 255, 255, 0.18);
  color: #f8f3e6;
}

.title {
  margin-top: 8rpx;
  font-size: 34rpx;
  font-weight: 700;
  color: #fdf9f0;
}

.subtitle {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #c5d0dd;
}

.content {
  flex: 1;
  margin-top: 8rpx;
}

.loading,
.empty {
  padding: 40rpx 20rpx;
  align-items: center;
  justify-content: center;
  display: flex;
}

.loading-text,
.empty-text {
  font-size: 26rpx;
  color: #c5d0dd;
}

.card {
  margin-top: 8rpx;
  border-radius: 24rpx;
  padding: 24rpx 22rpx 18rpx;
  background: linear-gradient(145deg, #111c28 0%, #141f2c 50%, #0b151f 100%);
  box-shadow:
    0 22rpx 55rpx rgba(0, 0, 0, 0.65),
    0 0 0 1rpx rgba(255, 255, 255, 0.02);
}

.section {
  margin-bottom: 20rpx;
}

.section-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10rpx;
}

.section-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #e4edf7;
  display: block;
}

.section-title-row {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: wrap;
  gap: 12rpx;
}

.section-subtitle {
  font-size: 22rpx;
  padding: 6rpx 14rpx;
  font-weight: 600;
  border-radius: 999rpx;
  border: 1rpx solid rgba(244, 162, 89, 0.55);
  background: rgba(244, 162, 89, 0.16);
  color: #f4a259;
  box-shadow: 0 8rpx 20rpx rgba(0, 0, 0, 0.25);
}

.raw-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  gap: 12rpx;
  margin-bottom: 10rpx;
}

.raw-header .section-title {
  display: inline-block;
}

.favorite-btn {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  transition: all 0.2s;
}

.favorite-btn--compact {
  padding: 2rpx 8rpx;
  border-radius: 999rpx;
  gap: 0;
}

.favorite-btn--active {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}

.favorite-icon {
  font-size: 24rpx;
}

.favorite-text {
  font-size: 22rpx;
  color: #e4edf7;
}

.favorite-btn--active .favorite-text {
  color: #ef4444;
}

.raw-text {
  font-size: 24rpx;
  line-height: 1.7;
  color: #e4edf7;
}

.tags {
  flex-direction: row;
  flex-wrap: wrap;
  display: flex;
}

.tag {
  padding: 4rpx 12rpx;
  border-radius: 999rpx;
  margin-right: 10rpx;
  margin-bottom: 8rpx;
  background-color: rgba(35, 57, 80, 0.9);
}

.tag--primary {
  background-color: rgba(244, 162, 89, 0.22);
}

.tag--accent {
   background-color: rgba(51, 130, 119, 0.32);
 }

 .tag--rate {
   background-color: rgba(255, 193, 7, 0.25);
   border: 1rpx solid rgba(255, 193, 7, 0.4);
 }

 .tag text {
   font-size: 20rpx;
   color: #dfe7f1;
 }

 .tag--rate text {
   color: #ffc107;
   font-weight: 600;
 }

.status-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 16rpx;
}

.status-item {
  display: flex;
  align-items: center;
  padding: 12rpx 20rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 16rpx;
  font-size: 24rpx;
  color: #c5d0dd;
  transition: all 0.3s;
}

.status-item--active {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #60a5fa;
}

.status-item--onboarded.status-item--active {
  background: rgba(34, 197, 94, 0.22);
  border-color: #22c55e;
  color: #86efac;
}

.status-item--closed.status-item--active {
  background: rgba(239, 68, 68, 0.22);
  border-color: #ef4444;
  color: #fecdd3;
}

.status-icon {
  margin-right: 8rpx;
  font-size: 28rpx;
}

.legal-footer {
  margin-top: 8rpx;
  padding-top: 14rpx;
  border-top: 1rpx solid rgba(255, 255, 255, 0.06);
}

.legal-links {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-start;
}

.legal-link {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8rpx;
  padding: 6rpx 8rpx;
  border-radius: 12rpx;
  background: transparent;
}

.legal-link-text {
  font-size: 22rpx;
  color: rgba(197, 208, 221, 0.78);
}

.legal-dot {
  margin: 0 10rpx;
  font-size: 20rpx;
  color: rgba(197, 208, 221, 0.5);
}

.compliance-actions {
  display: flex;
  flex-direction: row;
  gap: 12rpx;
  margin-top: 12rpx;
}

.compliance-btn {
  flex: 1;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 10rpx;
  padding: 14rpx 16rpx;
  border-radius: 16rpx;
  background: rgba(255, 255, 255, 0.06);
  border: 1rpx solid rgba(255, 255, 255, 0.12);
}

.compliance-btn--danger {
  background: rgba(239, 68, 68, 0.16);
  border-color: rgba(239, 68, 68, 0.35);
}

.compliance-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #e4edf7;
}

.status-label {
  margin-right: 4rpx;
}

.status-count {
  font-size: 22rpx;
  color: #94a3b8;
}

.status-nickname {
  margin-left: 6rpx;
  font-size: 20rpx;
  color: #e5e7eb;
}

.reliability-bar {
  display: flex;
  gap: 12rpx;
  margin-top: 16rpx;
}

.reliability-item {
  display: flex;
  align-items: center;
  padding: 12rpx 20rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 16rpx;
  font-size: 24rpx;
  color: #c5d0dd;
}

.reliability-item--active.reliability-item--reliable {
  background: rgba(34, 197, 94, 0.2);
  border-color: #22c55e;
  color: #4ade80;
}

.reliability-item--active.reliability-item--unreliable {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #f87171;
}

.guest-disabled {
  opacity: 0.45;
  filter: grayscale(1);
}

.reliability-icon {
  margin-right: 8rpx;
  font-size: 28rpx;
}

.reliability-label {
  margin-right: 4rpx;
}

.reliability-count {
  font-size: 22rpx;
  color: #94a3b8;
}

.provider {
  flex-direction: row;
  align-items: flex-start;
  display: flex;
  padding: 16rpx;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12rpx;
  cursor: pointer;
  transition: background 0.2s;
}

.provider:active {
  background: rgba(255, 255, 255, 0.05);
}

.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 999rpx;
  margin-right: 14rpx;
  overflow: hidden;
  background: radial-gradient(circle at 30% 20%, #f4a259 0%, #ff6b35 35%, #1b2a38 85%);
  position: relative;
  flex-shrink: 0;
}

.avatar--unlocked {
  background: rgba(76, 175, 80, 0.2);
  border: 2rpx solid rgba(76, 175, 80, 0.4);
}

.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.avatar-mask {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4rpx);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-lock-icon {
  font-size: 32rpx;
  opacity: 0.8;
}

.provider-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.provider-name {
  font-size: 22rpx;
  color: #f1f5f9;
  font-weight: 500;
}

.provider-meta {
  font-size: 20rpx;
  color: #97a6ba;
  line-height: 1.5;
}

.provider-contact {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 4rpx;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 12rpx;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 8rpx;
  border: 1rpx solid rgba(76, 175, 80, 0.2);
}

.contact-label {
  font-size: 20rpx;
  color: #97a6ba;
  font-weight: 500;
}

.contact-value {
  font-size: 20rpx;
  color: #4caf50;
  font-weight: 600;
  flex: 1;
}

.contact-copy {
  font-size: 18rpx;
  color: #4caf50;
  opacity: 0.8;
}

.contact-warning {
  font-size: 18rpx;
  color: #ff9800;
  margin-top: 4rpx;
  opacity: 0.9;
}

.provider-locked {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.unlock-hint {
  font-size: 18rpx;
  color: #4caf50;
  margin-top: 4rpx;
  text-decoration: underline;
}

.message-btn {
  margin-top: 16rpx;
  padding: 12rpx 24rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 20rpx;
  display: inline-block;
}

.message-btn-text {
  font-size: 24rpx;
  font-weight: 600;
  color: #fff;
}

.comment-list {
  margin-top: 10rpx;
}

.comment-item {
  padding: 14rpx 0;
  border-bottom: 1rpx solid rgba(148, 163, 184, 0.35);
}

.comment-item:last-of-type {
  border-bottom-width: 0;
}

.comment-author {
  font-size: 22rpx;
  color: #e5e7eb;
}

.comment-content {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: #e5e7eb;
}

.comment-time {
  margin-top: 2rpx;
  font-size: 20rpx;
  color: #94a3b8;
}

.comment-actions {
  margin-top: 6rpx;
  flex-direction: row;
  display: flex;
  gap: 24rpx;
}

.action-btn {
  font-size: 22rpx;
  color: #cbd5f5;
}

.action-btn--reply {
  color: #1e40af;
  font-weight: 500;
}

.reply-list {
  margin-top: 12rpx;
  margin-bottom: 8rpx;
  padding: 12rpx 0 12rpx 24rpx;
  border-left: 3rpx solid rgba(148, 163, 184, 0.5);
  background-color: rgba(15, 23, 42, 0.3);
  border-radius: 8rpx;
}

.reply-item {
  margin-bottom: 10rpx;
  padding: 6rpx 0;
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  flex-wrap: wrap;
}

.reply-item:last-child {
  margin-bottom: 0;
}

.reply-author {
  font-size: 20rpx;
  color: #cbd5f5;
  font-weight: 500;
}

.reply-content {
  font-size: 20rpx;
  color: #e5e7eb;
  margin-left: 8rpx;
  flex: 1;
  word-break: break-word;
}

.reply-time {
  font-size: 18rpx;
  color: #94a3b8;
  margin-left: 12rpx;
  width: 100%;
  margin-top: 4rpx;
}

.reply-editor {
  margin-top: 10rpx;
}

.reply-input {
  min-height: 60rpx;
  padding: 10rpx 14rpx;
  border-radius: 12rpx;
  border: 2rpx solid rgba(148, 163, 184, 0.7);
  color: #e5e7eb;
  font-size: 22rpx;
}

.reply-btn {
  margin-top: 6rpx;
  width: 180rpx;
  height: 60rpx;
  border-radius: 999rpx;
  border: none;
  background: rgba(59, 130, 246, 0.9);
  color: #f9fafb;
  font-size: 22rpx;
}

.reply-btn:active {
  background: rgba(37, 99, 235, 0.9);
}

.comment-editor {
  margin-top: 16rpx;
}

.comment-editor--top {
  margin-top: 0;
  margin-bottom: 20rpx;
  padding-bottom: 20rpx;
  border-bottom: 1rpx solid rgba(148, 163, 184, 0.2);
}

.comment-input {
  min-height: 80rpx;
  padding: 14rpx 18rpx;
  border-radius: 14rpx;
  border: 2rpx solid rgba(148, 163, 184, 0.7);
  color: #e5e7eb;
  font-size: 24rpx;
  background-color: rgba(15, 23, 42, 0.6);
}

.comment-btn {
  margin-top: 10rpx;
  width: 100%;
  height: 76rpx;
  border-radius: 12rpx;
  border: none;
  background: #1d4ed8;
  color: #f9fafb;
  font-size: 28rpx;
}

.comment-btn:active {
  background: #1e40af;
}

.comment-btn:disabled {
   background: #64748b;
   opacity: 0.6;
 }

 .toggle-icon {
   font-size: 24rpx;
   color: #94a3b8;
   margin-left: 12rpx;
 }

 .similar-demands-list {
   margin-top: 16rpx;
   display: flex;
   flex-direction: column;
   gap: 16rpx;
 }

 .similar-demand-item {
   padding: 16rpx;
   background: rgba(59, 130, 246, 0.1);
   border-radius: 12rpx;
   border: 1rpx solid rgba(59, 130, 246, 0.2);
   transition: all 0.2s;
 }

 .similar-demand-item:active {
   background: rgba(59, 130, 246, 0.15);
 }

 .similar-demand-header {
   display: flex;
   flex-direction: row;
   align-items: center;
   justify-content: space-between;
   margin-bottom: 8rpx;
 }

 .similar-demand-provider {
   font-size: 22rpx;
   color: #3b82f6;
   font-weight: 500;
 }

 .similar-demand-similarity {
   font-size: 20rpx;
   color: #94a3b8;
 }

 .similar-demand-text {
   font-size: 24rpx;
   color: #e4edf7;
   line-height: 1.6;
   margin-bottom: 8rpx;
   display: block;
 }

 .similar-demand-time {
   font-size: 20rpx;
   color: #94a3b8;
 }
 </style>


