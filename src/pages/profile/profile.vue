<template>
  <view class="profile-container">
    <view class="page-header-unified">
      <view class="page-header-content">
        <view class="header-left" @tap="goBack">
          <uni-icons type="back" size="20" color="#F5F1E8" />
        </view>
        <text class="page-header-title">个人中心</text>
        <view class="header-right"></view>
      </view>
    </view>
    
    <view class="profile-content">
      <view v-if="userInfo" class="user-info">
        <!-- Tab 切换 -->
        <view class="tab-bar">
          <view
            v-for="tab in tabs"
            :key="tab.key"
            class="tab-item"
            :class="{ 'tab-item--active': activeTab === tab.key }"
            @tap="activeTab = tab.key"
          >
            <text class="tab-text">{{ tab.label }}</text>
          </view>
        </view>

        <!-- Tab 内容 -->
        <view class="tab-content">
          <!-- Tab 1: 我的资料 -->
          <view v-if="activeTab === 'profile'" class="tab-panel">
            <view class="profile-main-block">
              <view class="section">
                <text class="section-title">账号信息</text>
                <view class="info-item">
                  <text class="label">用户ID:</text>
                  <text class="value">{{ userInfo.uid || '未知' }}</text>
                </view>
                <view v-if="accountInfo && accountInfo.identifier_masked" class="info-item">
                  <text class="label">登录账号:</text>
                  <text class="value">{{ accountInfo.identifier_masked }}</text>
                </view>
                <view class="info-item">
                  <text class="label">手机号</text>
                  <input class="input" v-model="accountForm.phone" placeholder="请输入手机号" />
                </view>
                <view class="info-item">
                  <text class="label">邮箱</text>
                  <input class="input" v-model="accountForm.email" placeholder="请输入邮箱" />
                </view>
                <view v-if="userInfo.phone_number" class="info-item">
                  <text class="label">手机号:</text>
                  <text class="value">{{ userInfo.phone_number }}</text>
                </view>
                <view v-if="userInfo.email" class="info-item">
                  <text class="label">邮箱:</text>
                  <text class="value">{{ userInfo.email }}</text>
                </view>
                <view class="info-item">
                  <text class="label">创建时间:</text>
                  <text class="value">{{ formatDate(userInfo.createTime) }}</text>
                </view>
                <view class="info-item">
                  <text class="label">最后登录:</text>
                  <text class="value">{{ formatDate(userInfo.lastLoginTime) }}</text>
                </view>
              </view>

              <view class="section">
                <text class="section-title">个人资料（用于积分与标签）</text>
                <view class="info-item">
                  <text class="label">昵称</text>
                  <input class="input" v-model="profile.nickname" placeholder="方便记住你是谁" />
                </view>
                <view class="info-item">
                  <text class="label">擅长模块</text>
                  <input class="input" v-model="profile.expertise_modules" placeholder="例：FICO,MM,SD" />
                </view>
                <view class="info-item">
                  <text class="label">工作年限</text>
                  <input
                    class="input"
                    type="number"
                    v-model.number="profile.years_of_exp"
                    placeholder="例：5（年）"
                  />
                </view>
                <view class="info-item">
                  <text class="label">职业</text>
                  <picker
                    :range="['SAP顾问', '需求发布者', '其他职业']"
                    @change="(e: any) => (profile.occupation = ['SAP顾问', '需求发布者', '其他职业'][Number(e?.detail?.value || 0)] || '')"
                  >
                    <view class="input">
                      <text>{{ profile.occupation || '请选择职业' }}</text>
                    </view>
                  </picker>
                </view>
              </view>

              <view class="section">
                <text class="section-title">联系方式（用于需求卡片解锁）</text>
                <view class="info-item">
                  <text class="label">微信号</text>
                  <input class="input" v-model="profile.wechat_id" placeholder="可选，解锁后展示" />
                </view>
                <view class="info-item">
                  <text class="label">QQ号</text>
                  <input class="input" v-model="profile.qq_id" placeholder="可选，解锁后展示" />
                </view>
                <view class="info-item switch-row">
                  <text class="label">允许展示联系方式</text>
                  <switch :checked="profile.can_share_contact" @change="onShareContactChange" />
                </view>
              </view>

              <view class="section">
                <text class="section-title">积分</text>
                <view class="points-row">
                  <text class="points-value">{{ profile.points }}</text>
                  <text class="points-desc">积分达到 {{ getThresholdPoints('viewContact') }} 分即可解锁他人联系方式查看权限</text>
                </view>
              </view>

              <view v-if="isAdmin" class="section">
                <text class="section-title">后台管理</text>
                <button class="primary-btn" @click="goToAdmin" style="margin-top: 14rpx;">
                  进入后台管理
                </button>
              </view>

              <view class="action-buttons">
                <button class="primary-btn" @click="saveProfile" :disabled="saving">
                  {{ saving ? '保存中...' : '保存资料并获取积分' }}
                </button>

                <button class="logout-btn" @click="handleLogout">
                  退出登录
                </button>
              </view>
            </view>

            <view class="section">
              <text class="section-title">合规与申诉</text>
              <button class="primary-btn" @click="goToAccountDelete" style="margin-top: 14rpx;">
                账号注销 / 个人信息删除申请
              </button>
            </view>
          </view>

          <!-- Tab 2: 我发布的需求 -->
          <view v-if="activeTab === 'demands'" class="tab-panel">
            <view class="section">
              <text class="section-title">我发布的需求</text>
              <view v-if="myDemandsLoading" class="loading">
                <text class="loading-text">加载中...</text>
              </view>
              <view v-else-if="myDemands.length === 0" class="empty">
                <text class="empty-text">还没有发布过需求</text>
                <button class="primary-btn" @click="goToPublish" style="margin-top: 20rpx;">
                  去发布需求
                </button>
              </view>
              <view v-else class="demand-list">
                <view
                  v-for="demand in myDemands"
                  :key="demand.id"
                  class="demand-item"
                  @tap="goToDemandDetail(demand)"
                >
                  <text class="demand-text">{{ demand.raw_text }}</text>
                  <view class="demand-meta">
                    <text class="demand-modules">{{ demand.module_labels?.join('、') || '未分类' }}</text>
                    <text class="demand-city">{{ demand.city || '未指定' }}</text>
                    <text class="demand-time">{{ formatDemandTime(demand.createdAt) }}</text>
                  </view>
                </view>
              </view>
            </view>

            <view class="demands-fab-spacer"></view>
            <view class="demands-fab">
              <button class="demands-fab-btn" @click="goToPublish">发布需求</button>
            </view>
          </view>

          <!-- Tab 3: 我的收藏 -->
          <view v-if="activeTab === 'favorites'" class="tab-panel">
            <view class="section">
              <text class="section-title">我的收藏</text>
              <view v-if="myFavoritesLoading" class="loading">
                <text class="loading-text">加载中...</text>
              </view>
              <view v-else-if="myFavorites.length === 0" class="empty">
                <text class="empty-text">还没有收藏任何需求</text>
              </view>
              <view v-else class="favorite-list">
                <view
                  v-for="favorite in myFavorites"
                  :key="favorite._id"
                  class="favorite-item"
                  @tap="goToDemandDetail(favorite)"
                >
                  <text class="favorite-text">{{ favorite.demand_text || '需求已删除' }}</text>
                  <text class="favorite-time">{{ formatFavoriteTime(favorite.createdAt) }}</text>
                </view>
              </view>
            </view>
          </view>
        </view>
      </view>
      
      <view v-else class="no-user">
        <text class="no-user-text">未登录</text>
        <button class="login-btn" @click="goToLogin">
          去登录
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { logout, ensureLogin } from '../../utils/cloudbase'
import { getLastLoginIdentifier, getMyAccountInfo, getOrCreateUserProfile, updateUserProfile, type UserProfile } from '../../utils/user'
import { getRewardPoints, getThresholdPoints } from '../../utils/points-config'
import { navigateTo, safeNavigateBack } from '../../utils'
import { isAdminUid } from '../../utils/admin'

function getApiBase(): string {
  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
        const forced =
          (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
        const forcedTrim = String(forced || '').trim()
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(forcedTrim)) return forcedTrim
        if (forcedTrim) return forcedTrim
        return 'https://api.sapboss.com'
      }
    }
  } catch {
    // ignore
  }

  const fromEnv =
    (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
  if (fromEnv) return String(fromEnv)

  return 'https://api.sapboss.com'
}

const API_BASE = getApiBase()

const API_TOKEN_KEY = 'sapboss_api_token'

function getStoredToken(): string {
  try {
    const u: any = typeof uni !== 'undefined' ? (uni as any) : null
    if (u && typeof u.getStorageSync === 'function') {
      return String(u.getStorageSync(API_TOKEN_KEY) || '').trim()
    }
  } catch {}

  try {
    if (isH5Runtime() && typeof window !== 'undefined' && (window as any).localStorage) {
      return String((window as any).localStorage.getItem(API_TOKEN_KEY) || '').trim()
    }
  } catch {}

  return ''
}

const userInfo = ref<any>(null)
const accountInfo = ref<any>(null)
const accountForm = ref({
  phone: '',
  email: '',
})
const profile = ref<UserProfile>({
  uid: '',
  points: 0,
  nickname: '',
  expertise_modules: '',
  years_of_exp: undefined,
  avatar_url: '',
  wechat_id: '',
  qq_id: '',
  occupation: '',
  can_share_contact: true,
})
const saving = ref(false)

// Tab 相关
const tabs = [
  { key: 'profile', label: '我的资料' },
  { key: 'demands', label: '我发布的需求' },
  { key: 'favorites', label: '我的收藏' },
]
const activeTab = ref('profile')

// 我发布的需求
const myDemands = ref<any[]>([])
const myDemandsLoading = ref(false)

// 我的收藏
const myFavorites = ref<any[]>([])
const myFavoritesLoading = ref(false)

const isAdmin = ref(false)

const isH5Runtime = () => {
  try {
    return typeof window !== 'undefined'
  } catch {
    return false
  }
}

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

function getH5ApiBasesForRetry(base: string): string[] {
  const b0 = String(base || '').replace(/\/+$/, '')
  const out = [b0]
  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
        if (/^http:\/\/localhost\b/i.test(b0)) out.push(b0.replace(/^http:\/\/localhost\b/i, 'http://127.0.0.1'))
        else if (/^http:\/\/127\.0\.0\.1\b/i.test(b0)) out.push(b0.replace(/^http:\/\/127\.0\.0\.1\b/i, 'http://localhost'))
      }
    }
  } catch {
    // ignore
  }
  return Array.from(new Set(out.filter(Boolean)))
}

const goBack = () => {
  safeNavigateBack({ delta: 1 })
}

// 获取用户信息
const getUserInfo = async () => {
  try {
    const loginState: any = await ensureLogin()

    if (loginState && loginState.user && !(loginState.user as any)?._isGuest) {
      userInfo.value = loginState.user
      isAdmin.value = isAdminUid(String((loginState.user as any)?.uid || '').trim())
      console.log('用户登录状态loginState:', loginState)
      console.log('完整用户信息loginState.user:', loginState.user)
      accountInfo.value = await getMyAccountInfo()

      const backendPhone = String((accountInfo.value && accountInfo.value.phone) || '').trim()
      const backendEmail = String((accountInfo.value && accountInfo.value.email) || '').trim()

      let phoneNext = backendPhone
      let emailNext = backendEmail

      if (!phoneNext || !emailNext) {
        const last = getLastLoginIdentifier()
        if (last && last.type === 'phone' && !phoneNext) phoneNext = String(last.value || '').trim()
        if (last && last.type === 'email' && !emailNext) emailNext = String(last.value || '').trim()
      }

      accountForm.value = {
        phone: phoneNext,
        email: emailNext,
      }
      const prof = await getOrCreateUserProfile()
      profile.value = {
        ...profile.value,
        ...prof,
      }

      // 兼容老数据/缺省字段：默认允许展示联系方式
      if ((profile.value as any).can_share_contact === undefined || (profile.value as any).can_share_contact === null) {
        profile.value.can_share_contact = true
      }
      // 如果当前在对应的 Tab，加载数据
      watchTab()
    } else {
      userInfo.value = null
      console.log('用户未登录')
    }
  } catch (error) {
    console.error('获取用户信息失败:', error)
    userInfo.value = null
  }
}

// 格式化日期
const formatDate = (timestamp: number) => {
  if (!timestamp) return '未知'
  
  try {
    // 处理不同的时间戳格式
    let date: Date
    
    // 如果是秒级时间戳，转换为毫秒
    if (timestamp.toString().length === 10) {
      date = new Date(timestamp * 1000)
    } else {
      date = new Date(timestamp)
    }
    
    // 检查日期是否有效
    if (isNaN(date.getTime())) {
      return '无效日期'
    }
    
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  } catch (error) {
    console.error('日期格式化失败:', error)
    return '格式错误'
  }
}

const onShareContactChange = (e: any) => {
  profile.value.can_share_contact = !!e.detail.value
}

const saveProfile = async () => {
  if (!userInfo.value) {
    uni.showToast({ title: '请先登录', icon: 'none' })
    return
  }
  saving.value = true
  try {
    const occ = String((profile.value as any).occupation || '').trim()
    if (!occ) {
      uni.showToast({ title: '请选择职业', icon: 'none' })
      return
    }
    if (occ === '需求发布者' && !(String(profile.value.wechat_id || '').trim() || String(profile.value.qq_id || '').trim())) {
      uni.showToast({ title: '需求发布者请填写微信号或QQ号', icon: 'none' })
      return
    }

    // 检查是否是首次完善资料（判断是否有昵称、擅长模块、工作年限等关键信息）
    const isFirstTimeComplete = !profile.value.nickname && 
                                 !profile.value.expertise_modules && 
                                 !profile.value.years_of_exp
    
    // 检查当前是否已完善（有昵称、擅长模块或工作年限）
    const willBeComplete = !!(profile.value.nickname || 
                              profile.value.expertise_modules || 
                              profile.value.years_of_exp)
    
    // 只在首次完善资料时加分（从配置读取）
    let pointsToAdd = 0
    if (isFirstTimeComplete && willBeComplete) {
      pointsToAdd = getRewardPoints('completeProfile')
    }
    
    const next = await updateUserProfile(
      {
        nickname: profile.value.nickname,
        expertise_modules: profile.value.expertise_modules,
        years_of_exp: profile.value.years_of_exp,
        wechat_id: profile.value.wechat_id,
        qq_id: profile.value.qq_id,
        occupation: (profile.value as any).occupation,
        can_share_contact: profile.value.can_share_contact,
      },
      {
        addPoints: pointsToAdd,
        account: {
          phone: String(accountForm.value.phone || '').trim(),
          email: String(accountForm.value.email || '').trim(),
        },
      },
    )
    profile.value = {
      ...profile.value,
      ...next,
    }
    if (pointsToAdd > 0) {
      uni.showToast({ title: `已保存并获得 ${pointsToAdd} 积分`, icon: 'success' })
    } else {
      uni.showToast({ title: '已保存', icon: 'success' })
    }
  } catch (e: any) {
    console.error('保存资料失败:', e)
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    uni.showToast({ title: msg || '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

// 退出登录
const handleLogout = async () => {
  uni.showModal({
    title: '退出登录',
    content: '确定要退出登录吗？',
    success: async (res) => {
      if (res.confirm) {
        try {
          await logout()
          userInfo.value = null
          uni.showToast({
            title: '已退出登录',
            icon: 'success'
          })
          uni.navigateTo({
            url: '/pages/index/index'
          })        
        } catch (error: any) {
          uni.showToast({
            title: error.message || '退出失败',
            icon: 'none'
          })
        }
      }
    }
  })
}

// 跳转到登录页面
const goToLogin = () => {
  uni.navigateTo({
    url: '/pages/login/password-login'
  })
}

// 加载我发布的需求
const loadMyDemands = async () => {
  if (!userInfo.value?.uid) return
  myDemandsLoading.value = true
  try {
    const bases = getH5ApiBasesForRetry(API_BASE)
    const token = getStoredToken()
    const header: any = {
      'x-uid': String(userInfo.value.uid || ''),
      'x-nickname': encodeURIComponent(String(userInfo.value.nickName || userInfo.value.nickname || '')),
    }
    if (token) header.Authorization = `Bearer ${token}`

    let okResp: any = null
    for (const base of bases) {
      try {
        const resp: any = await requestJson({
          url: `${String(base).replace(/\/+$/, '')}/demands/mine_raw?limit=50`,
          method: 'GET',
          header,
        })
        if (resp && resp.ok && Array.isArray(resp.demands)) {
          okResp = resp
          break
        }
      } catch {
        // try next base
      }
    }

    if (!okResp) {
      myDemands.value = []
      return
    }

    myDemands.value = (okResp.demands || []).map((doc: any) => ({
      ...doc,
      id: String(doc.id || doc._id || '').trim(),
    }))
  } catch (e) {
    console.error('加载我发布的需求失败:', e)
    myDemands.value = []
  } finally {
    myDemandsLoading.value = false
  }
}

// 加载我的收藏
const loadMyFavorites = async () => {
  if (!userInfo.value?.uid) return
  myFavoritesLoading.value = true
  try {
    const bases = getH5ApiBasesForRetry(API_BASE)
    const token = getStoredToken()
    const header: any = {
      'x-uid': String(userInfo.value.uid || ''),
      'x-nickname': encodeURIComponent(String(userInfo.value.nickName || userInfo.value.nickname || '')),
    }
    if (token) header.Authorization = `Bearer ${token}`

    let favResp: any = null
    for (const base of bases) {
      try {
        const resp: any = await requestJson({
          url: `${String(base).replace(/\/+$/, '')}/favorites/list?limit=50`,
          method: 'GET',
          header,
        })
        if (resp && resp.ok && Array.isArray(resp.favorites)) {
          favResp = resp
          break
        }
      } catch {
        // try next base
      }
    }

    if (!favResp) {
      myFavorites.value = []
      return
    }

    const favorites = favResp.favorites || []

    // v2 favorites will return unique_demand_id + demand_text directly.
    // legacy favorites may only have numeric demand_id and need /demands/by_ids to resolve text.
    const legacyIds = favorites
      .map((f: any) => String(f.demand_id || '').trim())
      .filter((id: string) => /^\d+$/.test(id))

    let demandsMap = new Map<string, any>()
    if (legacyIds.length) {
      let demandsResp: any = null
      for (const base of bases) {
        try {
          const resp: any = await requestJson({
            url: `${String(base).replace(/\/+$/, '')}/demands/by_ids`,
            method: 'POST',
            data: { ids: legacyIds },
            header,
          })
          if (resp && resp.ok && Array.isArray(resp.demands)) {
            demandsResp = resp
            break
          }
        } catch {
          // try next base
        }
      }

      ;((demandsResp && demandsResp.demands) || []).forEach((d: any) => {
        const id = String((d && (d.id || d._id)) || '').trim()
        if (id) demandsMap.set(id, d)
      })
    }

    myFavorites.value = favorites
      .map((f: any) => {
        const did = String(f.demand_id || '').trim()
        const d = /^\d+$/.test(did) ? demandsMap.get(did) : null
        const uniqueIdFromFav = String(f.unique_demand_id || (f as any).uniqueId || (f as any).unique_id || '').trim()
        const uniqueIdFromDemand = d ? String(d.unique_demand_id || (d as any).uniqueId || (d as any).unique_id || '').trim() : ''
        const uniqueId = uniqueIdFromFav || uniqueIdFromDemand
        const textFromFav = String(f.demand_text || '').trim()
        const textFromDemand = d ? String(d.raw_text || '').trim() : ''
        return {
          ...f,
          demand_text: textFromFav || textFromDemand || '需求已删除',
          unique_demand_id: uniqueId,
        }
      })
      .filter((x: any) => x && x.unique_demand_id)
  } catch (e) {
    console.error('加载我的收藏失败:', e)
    myFavorites.value = []
  } finally {
    myFavoritesLoading.value = false
  }
}

// 监听 Tab 切换，加载对应数据
const watchTab = () => {
  if (!userInfo.value) return
  
  if (activeTab.value === 'demands' && myDemands.value.length === 0) {
    loadMyDemands()
  } else if (activeTab.value === 'favorites') {
    if (!myFavoritesLoading.value) {
      loadMyFavorites()
    }
  }
}

// 格式化需求时间
const formatDemandTime = (timestamp: any) => {
  if (!timestamp) return '未知时间'
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (days === 0) return '今天'
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN')
  } catch (e) {
    return '未知时间'
  }
}

// 格式化收藏时间
const formatFavoriteTime = (timestamp: any) => {
  if (!timestamp) return '未知时间'
  try {
    const date = new Date(timestamp)
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (e) {
    return '未知时间'
  }
}

// 跳转到需求详情
const goToDemandDetail = (demandOrId: any) => {
  const rawId = String(typeof demandOrId === 'string' ? demandOrId : (demandOrId && (demandOrId.id || demandOrId._id)) || '').trim()
  const uniqueId = String(typeof demandOrId === 'object' && demandOrId ? (demandOrId.unique_demand_id || (demandOrId as any).uniqueId) : '').trim()
  const demandText = String(typeof demandOrId === 'object' && demandOrId ? (demandOrId.demand_text || '') : '').trim()

  if (demandText === '需求已删除') {
    uni.showToast({ title: '该需求已删除', icon: 'none' })
    return
  }
  if (uniqueId) {
    navigateTo(`/pages/demand/detail?uniqueId=${encodeURIComponent(uniqueId)}`)
    return
  }
  if (/^\d+$/.test(rawId)) {
    navigateTo(`/pages/demand/detail?id=${encodeURIComponent(rawId)}`)
    return
  }
  if (rawId) {
    navigateTo(`/pages/demand/detail?id=${encodeURIComponent(rawId)}`)
  }
}

// 跳转到发布需求
const goToPublish = () => {
  navigateTo('/pages/demand/publish')
}

const goToAdmin = () => {
  navigateTo('/pages/admin/index')
}

const goToAccountDelete = () => {
  navigateTo('/pages/legal/account-delete')
}

// 监听 activeTab 变化
watch(activeTab, () => {
  watchTab()
})

onMounted(() => {
  getUserInfo()
})
</script>

<style scoped>
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

.page-header-title {
  color: #F5F1E8;
  font-size: 32rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.header-left, .header-right {
  width: 80rpx;
  display: flex;
  align-items: center;
}

.profile-container {
  min-height: 100vh;
  background: #F5F1E8;
  padding: 0;
}

.profile-content {
  background: #F5F1E8;
  padding: 24rpx;
}

.user-info {
  display: flex;
  flex-direction: column;
  gap: 30rpx;
}

.profile-main-block {
  background: #ffffff;
  border-radius: 24rpx;
  padding: 32rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.05);
  border: 1rpx solid #e5e7eb;
}

.action-buttons {
  margin-top: 40rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.section {
  border-bottom: 1rpx solid #f0f0f0;
  padding-bottom: 32rpx;
  margin-bottom: 32rpx;
}

.section:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}

.section-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #333;
  margin-bottom: 10rpx;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding: 20rpx 0;
}

.label {
  font-size: 28rpx;
  color: #666;
  font-weight: 500;
}

.value {
  font-size: 32rpx;
  color: #333;
  word-break: break-all;
  line-height: 1.4;
}

.input {
  margin-top: 6rpx;
  padding: 18rpx 20rpx;
  border-radius: 12rpx;
  border: 2rpx solid #e0e0e0;
  font-size: 28rpx;
}

.demands-fab-spacer {
  height: 160rpx;
}

.demands-fab {
  position: fixed;
  left: 40rpx;
  right: 40rpx;
  bottom: 40rpx;
  z-index: 50;
}

.demands-fab-btn {
  width: 100%;
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: #fff;
  border-radius: 16rpx;
  padding: 22rpx 0;
  font-size: 30rpx;
  font-weight: 600;
}

.switch-row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.points-row {
  padding: 20rpx 0 10rpx;
}

.points-value {
  font-size: 40rpx;
  font-weight: 700;
  color: #ffb347;
}

.points-desc {
  margin-top: 6rpx;
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
}

.primary-btn {
  width: 100%;
  height: 88rpx;
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  color: white;
  border: none;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 20rpx;
}

.primary-btn:active {
  background: #45a049;
}

.logout-btn {
  width: 100%;
  height: 88rpx;
  background: #ff4757;
  color: white;
  border: none;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: bold;
  margin-top: 40rpx;
}

.logout-btn:active {
  background: #ff3838;
}

.no-user {
  text-align: center;
  padding: 60rpx 20rpx;
}

.no-user-text {
  font-size: 32rpx;
  color: #999;
  display: block;
  margin-bottom: 40rpx;
}

.login-btn {
  width: 200rpx;
  height: 88rpx;
  background: #667eea;
  color: white;
  border: none;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: bold;
}

.login-btn:active {
  background: #5a6fd8;
}

/* Tab 相关样式 */
.tab-bar {
  display: flex;
  flex-direction: row;
  border-bottom: 2rpx solid #e0e0e0;
  margin-bottom: 30rpx;
}

.tab-item {
  flex: 1;
  padding: 20rpx 0;
  text-align: center;
  border-bottom: 4rpx solid transparent;
  transition: all 0.3s;
}

.tab-item--active {
  border-bottom-color: #667eea;
}

.tab-text {
  font-size: 28rpx;
  color: #666;
  font-weight: 500;
}

.tab-item--active .tab-text {
  color: #667eea;
  font-weight: 600;
}

.tab-content {
  min-height: 400rpx;
}

.tab-panel {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

/* 列表样式 */
.loading, .empty {
  text-align: center;
  padding: 60rpx 20rpx;
}

.loading-text, .empty-text {
  font-size: 28rpx;
  color: #999;
}

.demand-list, .comment-list, .favorite-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.demand-item, .comment-item, .favorite-item {
  padding: 24rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  border: 1rpx solid #e0e0e0;
  transition: all 0.2s;
}

.demand-item:active, .comment-item:active, .favorite-item:active {
  background: #e9ecef;
  transform: scale(0.98);
}

.demand-text, .comment-content, .favorite-text {
  font-size: 28rpx;
  color: #333;
  line-height: 1.6;
  margin-bottom: 12rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  line-clamp: 2;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.demand-meta, .comment-meta {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.demand-modules, .demand-city, .demand-time,
.favorite-time {
  font-size: 22rpx;
  color: #999;
}

.demand-modules {
  color: #667eea;
  font-weight: 500;
}

</style>
