<template>
  <view class="page">
    <scroll-view class="content" scroll-y>
      <view class="card">
        <view class="section">
          <text class="section-title">发布 SAP 顾问需求</text>
          <text class="section-desc">分享你了解到的 SAP 顾问招聘需求，帮助更多顾问找到合适的机会</text>
        </view>

        <view class="section">
          <text class="field-label">需求原文 <text class="required">*</text></text>
          <textarea
            class="field-input field-textarea"
            v-model="form.raw_text"
            placeholder="请粘贴从微信群/QQ群获取的原始需求文本..."
            :maxlength="500"
            auto-height
            @blur="onRawTextBlur"
            @input="onRawTextInput"
          />
          <text class="field-hint">建议包含：模块、城市、周期、年限、语言等关键信息</text>
          <view v-if="autoFilled" class="auto-fill-hint">
            <text class="auto-fill-text">✨ 已自动识别并填充信息，可手动修改</text>
          </view>
        </view>

        <view class="section">
          <view class="module-actions">
            <button class="auto-rec-btn" @click="handleAutoRecognize" :disabled="autoRecognizing || submitting">
              {{ autoRecognizing ? '识别中...' : '自动识别' }}
            </button>
          </view>
          <text class="field-label">SAP 模块 <text class="required">*</text></text>
          <view class="module-chips">
            <view
              v-for="m in availableModules"
              :key="m.code"
              class="module-chip"
              :class="{ 'module-chip--active': form.module_codes.includes(m.code) }"
              @tap="toggleModule(m.code)"
            >
              <text class="module-chip-text">{{ m.name }}</text>
            </view>
          </view>
          <text class="field-hint">可多选，至少选择一个模块</text>

          <view v-if="recognizeResult" class="recognize-panel">
            <view class="recognize-row">
              <text class="recognize-label">查重结果</text>
              <text class="recognize-badge" :class="{
                'recognize-badge--none': recognizeResult.level === 'none',
                'recognize-badge--medium': recognizeResult.level === 'medium',
                'recognize-badge--high': recognizeResult.level === 'high'
              }">
                {{ recognizeResult.summary }}
              </text>
            </view>
            <text v-if="recognizeResult.detail" class="recognize-detail">{{ recognizeResult.detail }}</text>
          </view>
        </view>

        <view class="section">
          <text class="field-label">城市/地点</text>
          <input
            class="field-input"
            v-model="form.city"
            placeholder="例如：上海、北京、远程、海外等"
            :maxlength="50"
          />
        </view>

        <view class="section">
          <text class="field-label">工作方式</text>
          <view class="radio-group">
            <view
              v-for="mode in remoteModes"
              :key="String(mode.value)"
              class="radio-item"
              @tap="form.is_remote = mode.value"
            >
              <view class="radio" :class="{ 'radio--checked': form.is_remote === mode.value }">
                <view v-if="form.is_remote === mode.value" class="radio-dot"></view>
              </view>
              <text class="radio-label">{{ mode.label }}</text>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="field-label">项目周期</text>
          <input
            class="field-input"
            v-model="form.duration_text"
            placeholder="例如：3个月、6个月、长期等"
            :maxlength="50"
          />
        </view>

        <view class="section">
          <text class="field-label">年限要求</text>
          <input
            class="field-input"
            v-model="form.years_text"
            placeholder="例如：3-5年、5年以上等"
            :maxlength="50"
          />
        </view>

        <view class="section">
          <text class="field-label">语言要求</text>
          <view class="radio-group">
            <view
              v-for="lang in languages"
              :key="lang.value"
              class="radio-item"
              @tap="form.language = lang.value"
            >
              <view class="radio" :class="{ 'radio--checked': form.language === lang.value }">
                <view v-if="form.language === lang.value" class="radio-dot"></view>
              </view>
              <text class="radio-label">{{ lang.label }}</text>
            </view>
          </view>
        </view>

        <view class="section">
          <text class="field-label">信息提供者名称</text>
          <input
            class="field-input"
            v-model="form.provider_name"
            placeholder="你的昵称或名称（可选）"
            :maxlength="50"
          />
          <text class="field-hint">用于在需求卡片上显示信息来源</text>
        </view>

        <!-- 多行需求拆分预览 -->
        <view v-if="showSplitPreview && splitDemands.length > 1" class="split-preview">
          <view class="split-header">
            <text class="split-title">检测到 {{ splitDemands.length }} 条需求，请选择要发布的需求：</text>
            <view class="split-actions">
              <text class="split-action-btn" @tap="toggleSelectAll">
                {{ selectedDemands.size === splitDemands.filter(d => d.canPublish).length ? '取消全选' : '全选' }}
              </text>
              <text class="split-action-btn" @tap="cancelSplit">取消拆分</text>
            </view>
          </view>
          
          <!-- 相似度提示 -->
          <view v-if="splitDemands.some(d => !d.canPublish)" class="similarity-warning">
            <text class="similarity-warning-text">
              ⚠️ 因相似度过高，仅发布相似度低于 {{ Math.round(similarityThreshold * 100) }}% 的需求
            </text>
          </view>
          
          <view v-if="checkingSimilarity" class="checking-similarity">
            <text class="checking-text">正在检查相似度...</text>
          </view>
          
          <view v-else class="split-list">
            <view
              v-for="(demand, index) in splitDemands"
              :key="index"
              class="split-item"
              :class="{ 
                'split-item--selected': selectedDemands.has(index),
                'split-item--disabled': !demand.canPublish
              }"
              @tap="toggleDemandSelection(index)"
            >
              <view class="split-item-checkbox" :class="{ 'split-item-checkbox--disabled': !demand.canPublish }">
                <view v-if="selectedDemands.has(index)" class="checkbox-checked">✓</view>
                <view v-else-if="!demand.canPublish" class="checkbox-disabled">✕</view>
              </view>
              <view class="split-item-content">
                <text class="split-item-text">{{ demand.text }}</text>
                <view class="split-item-meta">
                  <text class="similarity-badge" :class="{
                    'similarity-badge--low': demand.similarity < 0.5,
                    'similarity-badge--medium': demand.similarity >= 0.5 && demand.similarity < similarityThreshold,
                    'similarity-badge--high': demand.similarity >= similarityThreshold
                  }">
                    相似度 {{ Math.round(demand.similarity * 100) }}%
                    <text v-if="demand.isSameUser" class="same-user-tag">（同一用户）</text>
                  </text>
                  <text v-if="!demand.canPublish" class="cannot-publish-tag">不可发布</text>
                </view>
              </view>
            </view>
          </view>
          
          <view class="split-footer">
            <text class="split-count">
              已选择 {{ selectedDemands.size }} 条需求
              <text v-if="splitDemands.some(d => !d.canPublish)">
                （{{ splitDemands.filter(d => !d.canPublish).length }} 条因相似度过高已过滤）
              </text>
            </text>
            <button 
              class="submit-btn split-submit-btn" 
              @click="handleBatchSubmit" 
              :disabled="submitting || selectedDemands.size === 0"
            >
              {{ submitting ? '发布中...' : `批量发布 ${selectedDemands.size} 条需求` }}
            </button>
          </view>
        </view>

        <button v-else class="submit-btn" @click="handleSubmit" :disabled="submitting">
          {{ submitting ? '发布中...' : '发布需求' }}
        </button>

        <view class="points-hint">
          <text class="points-hint-text">
            💡 发布需求成功后，将获得 {{ getRewardPoints('publishDemand') }} 积分奖励
          </text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { app, ensureLogin } from '../../utils/cloudbase'
import { getOrCreateUserProfile, updateUserProfile } from '../../utils/user'
import { getRewardPoints } from '../../utils/points-config'
import type { SapDemandRecord } from '../../utils/sap-demands'
import { parseDemandText, extractProviderName, splitMultiLineDemands, hasMultipleDemands } from '../../utils/demand-parser'
import { checkSimilarDemands, calculateTextSimilarity } from '../../utils/demand-similarity'

const form = ref({
  raw_text: '',
  module_codes: [] as string[],
  city: '',
  is_remote: undefined as boolean | undefined,
  duration_text: '',
  years_text: '',
  language: '',
  provider_name: '',
})

const submitting = ref(false)
const autoFilled = ref(false)
const isParsing = ref(false)
const autoRecognizing = ref(false)
const recognizeResult = ref<null | {
  level: 'none' | 'medium' | 'high'
  summary: string
  detail?: string
}>(null)
const splitDemands = ref<Array<{
  text: string
  similarity: number
  isSameUser?: boolean
  canPublish: boolean // 是否可以发布（相似度低于阈值）
}>>([]) // 拆分后的多个需求，包含相似度信息
const showSplitPreview = ref(false) // 是否显示拆分预览
const selectedDemands = ref<Set<number>>(new Set()) // 选中的需求索引
const checkingSimilarity = ref(false) // 是否正在检查相似度
const similarityThreshold = 0.85 // 相似度阈值（85%）

const availableModules = [
  { code: 'FICO', name: 'FICO' },
  { code: 'MM', name: 'MM' },
  { code: 'SD', name: 'SD' },
  { code: 'PP', name: 'PP' },
  { code: 'WM', name: 'WM/EWM' },
  { code: 'HR', name: 'HR' },
  { code: 'SAC', name: 'SAC' },
  { code: 'BI', name: 'BI' },
  { code: 'BW', name: 'BW' },
  { code: 'ABAP', name: 'ABAP' },
  { code: 'OTHER', name: '其他' },
]

const remoteModes = [
  { value: undefined, label: '不限' },
  { value: true, label: '远程' },
  { value: false, label: '现场' },
]

const languages = [
  { value: '', label: '不限' },
  { value: '英语流利', label: '英语流利' },
  { value: '英语简单沟通', label: '英语简单沟通' },
  { value: '日语流利', label: '日语流利' },
]

const toggleModule = (code: string) => {
  const index = form.value.module_codes.indexOf(code)
  if (index > -1) {
    form.value.module_codes.splice(index, 1)
  } else {
    form.value.module_codes.push(code)
  }
}

// 自动解析需求原文
const parseAndFillForm = (text: string) => {
  if (!text || text.trim().length < 10) {
    return
  }
  
  if (isParsing.value) {
    return
  }
  
  isParsing.value = true
  try {
    const parsed = parseDemandText(text)
    
    // 填充模块（如果当前没有选择模块）
    if (form.value.module_codes.length === 0 && parsed.module_codes.length > 0) {
      form.value.module_codes = parsed.module_codes
    }
    
    // 填充城市（如果当前为空）
    if (!form.value.city && parsed.city) {
      form.value.city = parsed.city
    }
    
    // 填充工作方式（如果当前未设置）
    if (form.value.is_remote === undefined && parsed.is_remote !== undefined) {
      form.value.is_remote = parsed.is_remote
    }
    
    // 填充周期（如果当前为空）
    if (!form.value.duration_text && parsed.duration_text) {
      form.value.duration_text = parsed.duration_text
    }
    
    // 填充年限（如果当前为空）
    if (!form.value.years_text && parsed.years_text) {
      form.value.years_text = parsed.years_text
    }
    
    // 填充语言（如果当前为空）
    if (!form.value.language && parsed.language) {
      form.value.language = parsed.language
    }
    
    // 尝试提取提供者名称
    if (!form.value.provider_name) {
      const providerName = extractProviderName(text)
      if (providerName) {
        form.value.provider_name = providerName
      }
    }
    
    if (parsed.module_codes.length > 0 || parsed.city || parsed.duration_text || parsed.years_text || parsed.language) {
      autoFilled.value = true
      setTimeout(() => {
        autoFilled.value = false
      }, 3000)
    }
  } catch (e) {
    console.error('解析需求文本失败:', e)
  } finally {
    isParsing.value = false
  }
}

// 需求原文输入事件（防抖处理）
let parseTimer: any = null
const onRawTextInput = () => {
  if (parseTimer) {
    clearTimeout(parseTimer)
  }
  
  parseTimer = setTimeout(() => {
    if (form.value.raw_text) {
      parseAndFillForm(form.value.raw_text)
    }
  }, 500)
}

// 需求原文失焦事件
const onRawTextBlur = async () => {
  if (parseTimer) {
    clearTimeout(parseTimer)
    parseTimer = null
  }
  
  if (form.value.raw_text) {
    // 检查是否有多行需求
    if (hasMultipleDemands(form.value.raw_text)) {
      const demands = splitMultiLineDemands(form.value.raw_text)
      if (demands.length > 1) {
        // 检查每条需求的相似度
        await checkDemandsSimilarity(demands)
        return
      }
    }
    
    parseAndFillForm(form.value.raw_text)
  }
}

const handleAutoRecognize = async () => {
  const rawText = form.value.raw_text || ''
  if (!rawText.trim() || rawText.trim().length < 10) {
    uni.showToast({ title: '请先粘贴需求原文', icon: 'none' })
    return
  }

  if (autoRecognizing.value) return

  if (hasMultipleDemands(rawText)) {
    const demands = splitMultiLineDemands(rawText)
    if (demands.length > 1) {
      await checkDemandsSimilarity(demands)
      return
    }
  }

  autoRecognizing.value = true
  recognizeResult.value = null
  try {
    parseAndFillForm(rawText)

    await ensureLogin()
    const user = await getOrCreateUserProfile()

    const similarityCheck = await checkSimilarDemands(rawText, user.uid, 7, 0.7)

    if (!similarityCheck.hasSimilar || similarityCheck.similarDemands.length === 0) {
      recognizeResult.value = {
        level: 'none',
        summary: '未发现相似需求',
        detail: '范围：近 7 天'
      }
      return
    }

    const sameUserSimilar = similarityCheck.similarDemands.find(d => d.isSameUser)
    const best = sameUserSimilar || similarityCheck.similarDemands[0]
    const percent = Math.round(best.similarity * 100)
    const isHigh = !!best.isSameUser && best.similarity > 0.85

    recognizeResult.value = {
      level: isHigh ? 'high' : 'medium',
      summary: best.isSameUser ? `最高相似度 ${percent}%（同一用户）` : `最高相似度 ${percent}%`,
      detail: `${best.provider_name || '未知'}：${(best.raw_text || '').trim().slice(0, 40)}${(best.raw_text || '').trim().length > 40 ? '…' : ''}`
    }
  } catch (e) {
    console.error('auto recognize failed:', e)
    uni.showToast({ title: '自动识别失败，请稍后重试', icon: 'none' })
  } finally {
    autoRecognizing.value = false
  }
}

// 检查拆分后需求的相似度
const checkDemandsSimilarity = async (demands: string[]) => {
  checkingSimilarity.value = true
  showSplitPreview.value = true
  
  try {
    await ensureLogin()
    const user = await getOrCreateUserProfile()
    
    // 检查每条需求的相似度
    const demandsWithSimilarity = await Promise.all(
      demands.map(async (demandText) => {
        // 检查是否有相似需求
        const similarityCheck = await checkSimilarDemands(demandText, user.uid, 7, 0.7)
        
        let maxSimilarity = 0
        let isSameUser = false
        
        if (similarityCheck.hasSimilar && similarityCheck.similarDemands.length > 0) {
          // 检查是否有同一用户发布的相似需求
          const sameUserSimilar = similarityCheck.similarDemands.find(d => d.isSameUser)
          
          if (sameUserSimilar) {
            maxSimilarity = sameUserSimilar.similarity
            isSameUser = true
          } else {
            // 不同用户，取最高相似度
            maxSimilarity = similarityCheck.similarDemands[0].similarity
          }
        }
        
        // 判断是否可以发布：同一用户相似度>85%不能发布，不同用户都可以发布
        const canPublish = !(isSameUser && maxSimilarity > similarityThreshold)
        
        return {
          text: demandText,
          similarity: Math.round(maxSimilarity * 100) / 100,
          isSameUser,
          canPublish,
        }
      })
    )
    
    // 按相似度从低到高排序
    demandsWithSimilarity.sort((a, b) => a.similarity - b.similarity)
    
    splitDemands.value = demandsWithSimilarity
    
    // 默认只选择可以发布的需求（相似度低于阈值）
    const selectableIndices = demandsWithSimilarity
      .map((_, index) => index)
      .filter(index => demandsWithSimilarity[index].canPublish)
    selectedDemands.value = new Set(selectableIndices)
  } catch (e) {
    console.error('检查相似度失败:', e)
    // 如果检查失败，仍然显示拆分预览，但不显示相似度
    splitDemands.value = demands.map(text => ({
      text,
      similarity: 0,
      canPublish: true,
    }))
    selectedDemands.value = new Set(demands.map((_, index) => index))
  } finally {
    checkingSimilarity.value = false
  }
}

// 切换需求选择
const toggleDemandSelection = (index: number) => {
  const demand = splitDemands.value[index]
  // 如果相似度过高，不允许选择
  if (!demand || !demand.canPublish) {
    uni.showToast({
      title: `相似度过高（${Math.round(demand.similarity * 100)}%），无法发布`,
      icon: 'none',
      duration: 2000
    })
    return
  }
  
  if (selectedDemands.value.has(index)) {
    selectedDemands.value.delete(index)
  } else {
    selectedDemands.value.add(index)
  }
}

// 全选/取消全选（只选择可以发布的需求）
const toggleSelectAll = () => {
  const selectableIndices = splitDemands.value
    .map((_, index) => index)
    .filter(index => splitDemands.value[index].canPublish)
  
  const allSelected = selectableIndices.every(index => selectedDemands.value.has(index))
  
  if (allSelected) {
    selectedDemands.value.clear()
  } else {
    selectedDemands.value = new Set(selectableIndices)
  }
}

// 取消拆分，使用单条需求
const cancelSplit = () => {
  showSplitPreview.value = false
  splitDemands.value = []
  selectedDemands.value.clear()
  checkingSimilarity.value = false
  // 继续解析单条需求
  if (form.value.raw_text) {
    parseAndFillForm(form.value.raw_text)
  }
}

onMounted(async () => {
  // 获取当前用户信息，自动填充提供者名称
  try {
    const profile = await getOrCreateUserProfile()
    if (profile.nickname) {
      form.value.provider_name = profile.nickname
    }
  } catch (e) {
    console.error('获取用户信息失败:', e)
  }
})

const handleSubmit = async () => {
  // 验证必填项
  if (!form.value.raw_text.trim()) {
    uni.showToast({ title: '请输入需求原文', icon: 'none' })
    return
  }

  if (form.value.module_codes.length === 0) {
    uni.showToast({ title: '请至少选择一个 SAP 模块', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    await ensureLogin()
    
    // 获取当前用户ID
    const user = await getOrCreateUserProfile()
    
    // 检查是否有相似需求（传入当前用户ID）
    const similarityCheck = await checkSimilarDemands(form.value.raw_text, user.uid, 7, 0.7)
    
    if (similarityCheck.hasSimilar && similarityCheck.similarDemands.length > 0) {
      // 检查是否有同一用户发布的相似需求
      const sameUserSimilar = similarityCheck.similarDemands.find(d => d.isSameUser)
      
      if (sameUserSimilar && sameUserSimilar.similarity > 0.85) {
        // 同一用户，相似度>85%，阻止发布
        uni.showToast({
          title: `检测到您已发布过相似需求（相似度 ${Math.round(sameUserSimilar.similarity * 100)}%），请勿重复发布`,
          icon: 'none',
          duration: 3000
        })
        submitting.value = false
        return
      }
      
      // 不同用户，相似度在70%-85%之间，询问用户
      const mostSimilar = similarityCheck.similarDemands[0]
      if (mostSimilar.similarity <= 0.85) {
        const confirm = await new Promise<boolean>((resolve) => {
          uni.showModal({
            title: '发现相似需求',
            content: `发现相似需求（相似度 ${Math.round(mostSimilar.similarity * 100)}%）。\n\n是否仍要发布？`,
            confirmText: '仍要发布',
            cancelText: '取消',
            success: (res) => {
              resolve(res.confirm)
            },
            fail: () => {
              resolve(false)
            },
          })
        })
        
        if (!confirm) {
          submitting.value = false
          return
        }
      }
    }
    
    // 单条发布：使用表单数据
    await publishSingleDemand(form.value.raw_text, true)

    // 发布需求获得积分（从配置读取）
    const publishPoints = getRewardPoints('publishDemand')
    if (publishPoints > 0) {
      await updateUserProfile({}, { addPoints: publishPoints })
      console.log(`发布需求获得 ${publishPoints} 积分`)
    }

    uni.showToast({
      title: publishPoints > 0 ? `发布成功，获得 ${publishPoints} 积分` : '发布成功',
      icon: 'success',
      duration: 2000
    })

    // 延迟跳转，让用户看到成功提示
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
  } catch (e: any) {
    console.error('发布需求失败:', e)
    uni.showToast({
      title: e?.message || '发布失败，请重试',
      icon: 'none'
    })
  } finally {
    submitting.value = false
  }
}

// 发布单条需求
const publishSingleDemand = async (demandText: string, useFormData: boolean = false) => {
  console.log('publishSingleDemand 开始:', {
    demandText: demandText.substring(0, 50) + '...',
    useFormData,
    splitDemandsLength: splitDemands.value.length
  })
  
  // 对于批量发布，每条需求独立解析，不使用表单数据
  // 对于单条发布，可以使用表单数据作为补充
  const parsed = parseDemandText(demandText)
  
  console.log('解析结果:', parsed)
  
  let moduleCodes: string[] = []
  let city = ''
  let duration_text = ''
  let years_text = ''
  let language = ''
  let daily_rate = ''
  let is_remote: boolean | undefined = undefined
  
  if (useFormData) {
    // 单条发布：优先使用表单数据，解析结果作为补充
    moduleCodes = form.value.module_codes.length > 0 ? form.value.module_codes : parsed.module_codes
    city = form.value.city.trim() || parsed.city || '未指定'
    duration_text = form.value.duration_text.trim() || parsed.duration_text
    years_text = form.value.years_text.trim() || parsed.years_text
    language = form.value.language || parsed.language
    daily_rate = parsed.daily_rate || ''
    is_remote = form.value.is_remote !== undefined ? form.value.is_remote : parsed.is_remote
  } else {
    // 批量发布：每条需求独立解析，不使用表单数据
    moduleCodes = parsed.module_codes.length > 0 ? parsed.module_codes : ['OTHER']
    city = parsed.city || '未指定'
    duration_text = parsed.duration_text
    years_text = parsed.years_text
    language = parsed.language
    daily_rate = parsed.daily_rate || ''
    is_remote = parsed.is_remote
  }
  
  // 确保至少有一个模块
  if (moduleCodes.length === 0) {
    moduleCodes = ['OTHER']
  }
  
  // 生成模块标签
  const moduleLabels = moduleCodes.map(code => {
    const module = availableModules.find(m => m.code === code)
    return module ? module.name : code
  })

  const user = await getOrCreateUserProfile()
  
  // 构建需求数据
  const demandData: any = {
    raw_text: demandText.trim(),
    module_codes: moduleCodes,
    module_labels: moduleLabels,
    city: city,
    duration_text: duration_text,
    years_text: years_text,
    language: language,
    provider_name: form.value.provider_name.trim() || user.nickname || '匿名用户',
    provider_user_id: user.uid,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  // 如果有工作方式，添加到数据中
  if (is_remote !== undefined) {
    demandData.is_remote = is_remote
  }
  
  // 如果有人天价格，添加到数据中
  if (daily_rate) {
    demandData.daily_rate = daily_rate
  }

  console.log('准备保存到数据库:', {
    raw_text: demandData.raw_text.substring(0, 50) + '...',
    module_codes: demandData.module_codes,
    city: demandData.city,
    provider_user_id: demandData.provider_user_id
  })

  // 保存到数据库
  const db = app.database()
  const result = await db.collection('sap_demands_raw').add(demandData)
  
  console.log('需求保存成功，ID:', (result as any).id || (result as any)._id)
  
  return result
}

// 批量发布多条需求
const handleBatchSubmit = async () => {
  if (selectedDemands.value.size === 0) {
    uni.showToast({ title: '请至少选择一条需求', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    await ensureLogin()
    
    const selectedIndices = Array.from(selectedDemands.value).sort()
    let successCount = 0
    let failCount = 0
    let skippedCount = 0 // 跳过的重复需求数量
    
    // 批量发布选中的需求（已经过相似度检查，直接发布）
    for (const index of selectedIndices) {
      try {
        const demand = splitDemands.value[index]
        if (!demand || !demand.canPublish) {
          // 如果相似度过高，跳过（理论上不应该发生，因为UI已经过滤）
          console.log(`跳过第 ${index + 1} 条需求：相似度过高或不可发布`)
          skippedCount++
          continue
        }
        
        console.log(`正在发布第 ${index + 1} 条需求:`, demand.text.substring(0, 50) + '...')
        
        // 批量发布：每条需求独立解析，不使用表单数据
        await publishSingleDemand(demand.text, false)
        
        console.log(`第 ${index + 1} 条需求发布成功`)
        successCount++
      } catch (e) {
        console.error(`发布第 ${index + 1} 条需求失败:`, e)
        failCount++
      }
    }
    
    // 计算积分（每条需求 +5 分）
    const publishPoints = getRewardPoints('publishDemand')
    if (publishPoints > 0 && successCount > 0) {
      const totalPoints = publishPoints * successCount
      await updateUserProfile({}, { addPoints: totalPoints })
      console.log(`批量发布获得 ${totalPoints} 积分`)
    }
    
    const filteredCount = splitDemands.value.filter(d => !d.canPublish).length
    let message = `成功发布 ${successCount} 条需求`
    if (failCount > 0) {
      message += `，${failCount} 条失败`
    }
    if (filteredCount > 0) {
      message += `，${filteredCount} 条因相似度过高已过滤`
    }
    if (publishPoints > 0 && successCount > 0) {
      message += `，获得 ${publishPoints * successCount} 积分`
    }
    
    uni.showToast({
      title: message,
      icon: successCount > 0 ? 'success' : 'none',
      duration: 3000
    })

    // 延迟跳转
    setTimeout(() => {
      uni.navigateBack()
    }, 2000)
  } catch (e: any) {
    console.error('批量发布失败:', e)
    uni.showToast({
      title: e?.message || '批量发布失败，请重试',
      icon: 'none'
    })
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #0b1924 0%, #1b2a38 45%, #101820 100%);
}

.content {
  flex: 1;
  padding: 16rpx 24rpx 24rpx;
}

.card {
  border-radius: 24rpx;
  padding: 24rpx 22rpx 18rpx;
  background: linear-gradient(145deg, #111c28 0%, #141f2c 50%, #0b151f 100%);
  box-shadow:
    0 22rpx 55rpx rgba(0, 0, 0, 0.65),
    0 0 0 1rpx rgba(255, 255, 255, 0.02);
}

.section {
  margin-bottom: 32rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #fdf9f0;
  display: block;
  margin-bottom: 8rpx;
}

.section-desc {
  font-size: 24rpx;
  color: #c5d0dd;
  line-height: 1.6;
  display: block;
  margin-bottom: 16rpx;
}

.field-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #e4edf7;
  display: block;
  margin-bottom: 12rpx;
}

.required {
  color: #ff6b6b;
  margin-left: 4rpx;
}

.field-input {
  width: 100%;
  padding: 16rpx 20rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 12rpx;
  font-size: 24rpx;
  color: #e4edf7;
  box-sizing: border-box;
}

.field-textarea {
  min-height: 200rpx;
  line-height: 1.6;
}

.field-hint {
  font-size: 20rpx;
  color: #97a6ba;
  margin-top: 8rpx;
  display: block;
}

.module-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 8rpx;
}

.module-actions {
  display: block;
  width: 100%;
  text-align: left;
  margin-bottom: 10rpx;
}

.auto-rec-btn {
  width: auto !important;
  display: inline-block;
  margin: 0 !important;
  padding: 10rpx 18rpx;
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  border: none;
  border-radius: 999rpx;
  font-size: 22rpx;
  font-weight: 600;
  color: #fff;
  line-height: 1;
  box-shadow: 0 6rpx 12rpx rgba(76, 175, 80, 0.22);
}

.auto-rec-btn:disabled {
  opacity: 0.6;
  background: rgba(76, 175, 80, 0.5);
}

.recognize-panel {
  margin-top: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: 12rpx;
  background: rgba(255, 255, 255, 0.04);
  border: 1rpx solid rgba(255, 255, 255, 0.10);
}

.recognize-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-wrap: wrap;
}

.recognize-label {
  font-size: 22rpx;
  color: #97a6ba;
}

.recognize-badge {
  font-size: 22rpx;
  padding: 6rpx 12rpx;
  border-radius: 999rpx;
  font-weight: 600;
}

.recognize-badge--none {
  background: rgba(76, 175, 80, 0.16);
  color: #4caf50;
}

.recognize-badge--medium {
  background: rgba(255, 152, 0, 0.16);
  color: #ff9800;
}

.recognize-badge--high {
  background: rgba(239, 68, 68, 0.18);
  color: #ef4444;
}

.recognize-detail {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.6;
  color: #e4edf7;
  opacity: 0.92;
}

.module-chip {
  padding: 12rpx 20rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 20rpx;
  transition: all 0.2s;
}

.module-chip--active {
  background: rgba(76, 175, 80, 0.2);
  border-color: #4caf50;
}

.module-chip-text {
  font-size: 22rpx;
  color: #e4edf7;
}

.module-chip--active .module-chip-text {
  color: #4caf50;
  font-weight: 600;
}

.radio-group {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.radio-item {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.radio {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.radio--checked {
  border-color: #4caf50;
  background: rgba(76, 175, 80, 0.1);
}

.radio-dot {
  width: 20rpx;
  height: 20rpx;
  background: #4caf50;
  border-radius: 50%;
}

.radio-label {
  font-size: 24rpx;
  color: #e4edf7;
}

.submit-btn {
  width: 100%;
  padding: 24rpx;
  background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
  border: none;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 600;
  color: #fff;
  margin-top: 32rpx;
  box-shadow: 0 8rpx 16rpx rgba(76, 175, 80, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  background: rgba(76, 175, 80, 0.5);
}

.points-hint {
  margin-top: 24rpx;
  padding: 16rpx;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 8rpx;
  border: 1rpx solid rgba(76, 175, 80, 0.2);
}

.points-hint-text {
  font-size: 22rpx;
  color: #4caf50;
  line-height: 1.6;
}

.auto-fill-hint {
  margin-top: 12rpx;
  padding: 12rpx 16rpx;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 8rpx;
  border: 1rpx solid rgba(59, 130, 246, 0.2);
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10rpx);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.auto-fill-text {
  font-size: 22rpx;
  color: #3b82f6;
  line-height: 1.6;
}

/* 拆分预览样式 */
.split-preview {
  margin-top: 32rpx;
  padding: 24rpx;
  background: rgba(59, 130, 246, 0.1);
  border-radius: 16rpx;
  border: 1rpx solid rgba(59, 130, 246, 0.3);
}

.split-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20rpx;
  flex-wrap: wrap;
  gap: 12rpx;
}

.split-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #3b82f6;
  flex: 1;
  min-width: 300rpx;
}

.split-actions {
  display: flex;
  flex-direction: row;
  gap: 16rpx;
}

.split-action-btn {
  font-size: 24rpx;
  color: #3b82f6;
  padding: 8rpx 16rpx;
  background: rgba(59, 130, 246, 0.2);
  border-radius: 8rpx;
}

.split-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 20rpx;
  max-height: 600rpx;
  overflow-y: auto;
}

.split-item {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 16rpx;
  background: rgba(255, 255, 255, 0.05);
  border: 2rpx solid rgba(255, 255, 255, 0.1);
  border-radius: 12rpx;
  transition: all 0.2s;
}

.split-item--selected {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
}

.split-item-checkbox {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid rgba(255, 255, 255, 0.3);
  border-radius: 8rpx;
  margin-right: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 4rpx;
}

.split-item--selected .split-item-checkbox {
  background: #3b82f6;
  border-color: #3b82f6;
}

.checkbox-checked {
  font-size: 24rpx;
  color: #fff;
  font-weight: bold;
}

.split-item-text {
  flex: 1;
  font-size: 24rpx;
  color: #e4edf7;
  line-height: 1.6;
  word-break: break-word;
}

.split-footer {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 20rpx;
}

.split-count {
  font-size: 24rpx;
  color: #94a3b8;
  text-align: center;
}

.split-submit-btn {
   margin-top: 0;
 }

 .similarity-warning {
   margin-top: 16rpx;
   margin-bottom: 16rpx;
   padding: 12rpx 16rpx;
   background: rgba(255, 152, 0, 0.15);
   border-radius: 8rpx;
   border: 1rpx solid rgba(255, 152, 0, 0.3);
 }

 .similarity-warning-text {
   font-size: 22rpx;
   color: #ff9800;
   line-height: 1.6;
 }

 .checking-similarity {
   padding: 40rpx 20rpx;
   text-align: center;
 }

 .checking-text {
   font-size: 24rpx;
   color: #94a3b8;
 }

 .split-item-content {
   flex: 1;
   display: flex;
   flex-direction: column;
   gap: 8rpx;
 }

 .split-item-meta {
   display: flex;
   flex-direction: row;
   align-items: center;
   gap: 12rpx;
   flex-wrap: wrap;
 }

 .similarity-badge {
   font-size: 20rpx;
   padding: 4rpx 12rpx;
   border-radius: 12rpx;
   font-weight: 500;
 }

 .similarity-badge--low {
   background: rgba(76, 175, 80, 0.2);
   color: #4caf50;
 }

 .similarity-badge--medium {
   background: rgba(255, 152, 0, 0.2);
   color: #ff9800;
 }

 .similarity-badge--high {
   background: rgba(239, 68, 68, 0.2);
   color: #ef4444;
 }

 .same-user-tag {
   font-size: 18rpx;
   opacity: 0.8;
 }

 .cannot-publish-tag {
   font-size: 20rpx;
   color: #ef4444;
   font-weight: 600;
 }

 .split-item--disabled {
   opacity: 0.6;
   background: rgba(255, 255, 255, 0.02);
 }

 .split-item-checkbox--disabled {
   background: rgba(239, 68, 68, 0.2);
   border-color: #ef4444;
 }

 .checkbox-disabled {
   font-size: 24rpx;
   color: #ef4444;
   font-weight: bold;
 }
 </style>


