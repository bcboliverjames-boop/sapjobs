<template>
  <view class="page">
    <view class="card" v-if="ready">
      <view class="header">
        <view class="header-top">
          <text class="badge">ADMIN</text>
          <text class="title">后台管理</text>
        </view>
        <text class="subtitle">需求审核与投诉举报处理（仅管理员可访问）</text>
      </view>

      <view class="tabs">
        <view class="tab" :class="{ active: activeTab === 'review' }" @tap="activeTab = 'review'">
          <text class="tab-text">需求审核</text>
        </view>
        <view class="tab" :class="{ active: activeTab === 'reports' }" @tap="activeTab = 'reports'">
          <text class="tab-text">投诉举报</text>
        </view>
      </view>

      <view v-if="activeTab === 'review'" class="panel">
        <view class="section">
          <text class="h2">发布相似度策略</text>

          <view class="row">
            <text class="label">启用检查</text>
            <switch :checked="config.similarity_enabled" @change="onToggleEnabled" />
          </view>

          <view class="row">
            <text class="label">阈值</text>
            <input class="input" type="digit" :value="String(config.similarity_threshold)" @input="onThresholdInput" />
          </view>

          <view class="row col">
            <text class="label">规则</text>
            <view class="radio-group">
              <view class="radio" :class="{ checked: config.similarity_rule === 'text' }" @tap="setRule('text')">
                <text class="radio-dot" />
                <text class="radio-text">文本相似度</text>
              </view>
              <view class="radio" :class="{ checked: config.similarity_rule === 'category' }" @tap="setRule('category')">
                <text class="radio-dot" />
                <text class="radio-text">分类相似度</text>
              </view>
              <view class="radio" :class="{ checked: config.similarity_rule === 'hybrid' }" @tap="setRule('hybrid')">
                <text class="radio-dot" />
                <text class="radio-text">混合（分类优先）</text>
              </view>
            </view>
          </view>

          <button class="btn" :disabled="saving" @tap="saveConfig">{{ saving ? '保存中...' : '保存配置' }}</button>
        </view>

        <view class="section">
          <text class="h2">唯一需求映射纠错</text>

          <view class="row col">
            <text class="label">搜索唯一需求（按关键字）</text>
            <input class="input" v-model="uniqueKeyword" placeholder="输入关键字后点击搜索" />
            <button class="btn btn-ghost" :disabled="loadingUnique" @tap="searchUnique">{{ loadingUnique ? '加载中...' : '搜索' }}</button>
          </view>

          <view v-if="uniqueList.length" class="unique-list-wrap">
            <view class="unique-nav">
              <button class="btn btn-small btn-ghost" :disabled="uniqueStart <= 0" @tap.stop="prevUnique">上</button>
              <text class="unique-nav-text">{{ uniqueNavText }}</text>
              <button class="btn btn-small btn-ghost" :disabled="uniqueStart + UNIQUE_PAGE_SIZE >= uniqueList.length" @tap.stop="nextUnique">下</button>
            </view>

            <view class="list list--compact">
              <view
                v-for="u in displayUniqueList"
                :key="u._id"
                class="list-item"
                :class="{ selected: selectedUnique && selectedUnique._id === u._id }"
                @tap="selectUnique(u)"
              >
                <text class="list-title list-title--clamp2">{{ u.raw_text || '' }}</text>
                <view v-if="getUniqueTags(u).length" class="tag-row">
                  <text v-for="t in getUniqueTags(u)" :key="t" class="tag">{{ t }}</text>
                </view>
                <text class="list-meta">id: {{ u._id }}</text>
              </view>
            </view>
          </view>

          <view v-if="selectedUnique" class="subsection">
            <text class="selected-unique-text">{{ selectedUnique.raw_text }}</text>
            <view v-if="getUniqueTags(selectedUnique).length" class="tag-row tag-row--selected">
              <text v-for="t in getUniqueTags(selectedUnique)" :key="t" class="tag">{{ t }}</text>
            </view>

            <view class="row col">
              <text class="label">筛选 raw（id 或关键字）</text>
              <input class="input" v-model="rawKeyword" placeholder="支持 rawId 精确查询 / 文本关键字过滤" />
              <view class="raw-actions">
                <button class="btn btn-small btn-ghost" @tap.stop="refreshCandidates">刷新候选</button>
                <button class="btn btn-small" @tap.stop="clearRawKeyword">清空</button>
                <button class="btn btn-small btn-ghost" @tap.stop="goToUniqueDetail">查看唯一详情</button>
              </view>
            </view>

            <view class="row">
              <text class="label">候选最小相似度</text>
              <input class="input" type="digit" :value="String(candidateMinSimilarity)" @input="onCandidateMinSimilarityInput" />
            </view>

            <text class="hint">候选计算：规则 {{ candidateRule }} · 阈值 ≥ {{ candidateMinSimilarity }}（未手动关联项启用模块/城市硬门槛）</text>

            <view class="row">
              <text class="label">只看未关联 raw</text>
              <switch :checked="onlyUnlinkedRaw" @change="onToggleOnlyUnlinked" />
            </view>

            <view v-if="loadingRaw" class="muted">加载中...</view>

            <view v-else-if="displayRawCandidates.length" class="raw-list">
              <view v-for="r in displayRawCandidates" :key="r._id" class="raw-item">
                <view class="raw-top">
                  <text class="raw-sim">{{ Math.round((r.__similarity || 0) * 100) }}%</text>
                  <text class="raw-id">{{ r._id }}</text>
                </view>
                <text class="raw-text">{{ r.raw_text }}</text>
                <view v-if="getRawTags(r).length" class="tag-row">
                  <text v-for="t in getRawTags(r)" :key="t" class="tag">{{ t }}</text>
                </view>
                <text class="raw-meta">{{ r.provider_name || '未知' }} · {{ formatTime(r.createdAt) }}</text>
                <text v-if="r.unique_demand_id" class="raw-meta">当前关联: {{ r.unique_demand_id }}</text>

                <view class="raw-actions">
                  <button class="btn btn-small btn-ghost" @tap.stop="goToRawDetail(r)">查看详情</button>
                  <button class="btn btn-small" @tap.stop="linkRaw(r)">关联到此唯一需求</button>
                  <button class="btn btn-small btn-danger" @tap.stop="unlinkRaw(r)">解除关联</button>
                  <button class="btn btn-small btn-ghost" @tap.stop="setCanonicalRaw(r)">设为唯一原文</button>
                </view>
              </view>
            </view>

            <view v-else class="muted">暂无候选 raw 需求</view>
          </view>
        </view>
      </view>

      <view v-else class="panel">
        <view class="section">
          <text class="h2">举报列表</text>

          <view class="row">
            <text class="label">状态筛选</text>
            <picker mode="selector" :range="statusOptions" :value="statusIndex" @change="onStatusPick">
              <view class="picker">{{ statusOptions[statusIndex] }}</view>
            </picker>
          </view>

          <button class="btn btn-ghost" :disabled="loadingReports" @tap="loadReports">{{ loadingReports ? '刷新中...' : '刷新列表' }}</button>

          <view v-if="filteredReports.length" class="list">
            <view
              v-for="rep in filteredReports"
              :key="rep._id"
              class="list-item"
              :class="{ selected: selectedReport && selectedReport._id === rep._id }"
              @tap="selectReport(rep)"
            >
              <text class="list-title">{{ rep.category || '其他' }} · {{ rep.status || 'pending' }}</text>
              <text class="list-meta">{{ rep.target_type || 'demand' }}: {{ rep.target_id || '-' }}</text>
            </view>
          </view>

          <view v-else class="muted">暂无举报记录</view>
        </view>

        <view v-if="selectedReport" class="section">
          <text class="h2">处理举报</text>

          <text class="p">{{ selectedReport.description || '' }}</text>

          <view class="row col">
            <text class="label">处理状态</text>
            <picker mode="selector" :range="statusOptions" :value="editStatusIndex" @change="onEditStatusPick">
              <view class="picker">{{ statusOptions[editStatusIndex] }}</view>
            </picker>
          </view>

          <view class="row col">
            <text class="label">处理备注</text>
            <textarea class="textarea" v-model="editOperatorNote" auto-height placeholder="填写处理备注" />
          </view>

          <view class="row col">
            <text class="label">回复文案</text>
            <textarea class="textarea" v-model="editResultMessage" auto-height placeholder="填写处理结果回复文案" />
          </view>

          <button class="btn" :disabled="savingReport" @tap="saveReport">{{ savingReport ? '保存中...' : '保存处理结果' }}</button>
        </view>
      </view>
    </view>

    <view v-else class="card">
      <text class="title">无权限</text>
      <text class="subtitle">该页面仅管理员可访问</text>
      <button class="btn" @tap="goHome">返回首页</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { requireAdmin } from '../../utils/admin'
import {
  fetchAdminConfig,
  getDefaultAdminConfig,
  saveAdminConfig,
  type AdminConfigDoc,
  type SimilarityRule,
} from '../../utils/admin-config'
import { parseDemandText } from '../../utils/demand-parser'
import { calculateTextSimilarity, calculateCategorySimilarityFromParsed } from '../../utils/demand-similarity'
import { fetchAllUniqueDemands, type SapUniqueDemandDoc } from '../../utils/sap-unique-demands'

const SAPBOSS_API_BASE =
  (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || 'https://api.sapboss.com'

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

function buildQueryString(params: Record<string, string>): string {
  const pairs: string[] = []
  Object.keys(params).forEach((k) => {
    const v = params[k]
    if (v === undefined || v === null) return
    pairs.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  })
  return pairs.join('&')
}

const ready = ref(false)
const saving = ref(false)
const savingReport = ref(false)
const loadingReports = ref(false)
const loadingUnique = ref(false)
const loadingRaw = ref(false)

const activeTab = ref<'review' | 'reports'>('review')

const config = ref<AdminConfigDoc>(getDefaultAdminConfig())

const statusOptions = ['all', 'pending', 'processing', 'resolved', 'rejected']
const statusIndex = ref(0)

const reports = ref<any[]>([])
const selectedReport = ref<any | null>(null)
const editStatusIndex = ref(1)
const editOperatorNote = ref('')
const editResultMessage = ref('')

const uniqueKeyword = ref('')
const uniqueList = ref<SapUniqueDemandDoc[]>([])
const selectedUnique = ref<SapUniqueDemandDoc | null>(null)
const rawCandidates = ref<any[]>([])

const UNIQUE_PAGE_SIZE = 3
const uniqueStart = ref(0)

const onlyUnlinkedRaw = ref(false)
const rawKeyword = ref('')
const candidateMinSimilarity = ref(0.5)
const candidateRule = ref<SimilarityRule>('text')

const filteredReports = computed(() => {
  const all = reports.value || []
  const s = statusOptions[statusIndex.value] || 'all'
  if (s === 'all') return all
  return all.filter((r) => String(r.status || 'pending') === s)
})

const displayUniqueList = computed(() => {
  const start = Math.max(0, Number(uniqueStart.value || 0))
  return (uniqueList.value || []).slice(start, start + UNIQUE_PAGE_SIZE)
})

const uniqueNavText = computed(() => {
  const total = (uniqueList.value || []).length
  if (!total) return ''
  const start = Math.max(0, Number(uniqueStart.value || 0))
  const end = Math.min(total, start + UNIQUE_PAGE_SIZE)
  return `${start + 1}-${end}/${total}`
})

const displayRawCandidates = computed(() => {
  const list = rawCandidates.value || []
  if (!onlyUnlinkedRaw.value) return list
  return list.filter((x: any) => !String(x?.unique_demand_id || '').trim())
})

function safeJsonArray(v: any): string[] {
  if (!v) return []
  try {
    const obj = typeof v === 'string' ? JSON.parse(v) : v
    if (Array.isArray(obj)) return obj.map((x) => String(x)).filter(Boolean)
    return []
  } catch {
    return []
  }
}

function uniqueListPushUnique(arr: string[], v: any) {
  const s = String(v || '').trim()
  if (!s) return
  if (arr.includes(s)) return
  arr.push(s)
}

function extractTagsFromParsed(parsed: any): string[] {
  const tags: string[] = []
  const modules = Array.isArray(parsed?.module_codes) ? parsed.module_codes : []
  for (const m of modules) {
    const code = String(m || '').trim().toUpperCase()
    if (!code) continue
    uniqueListPushUnique(tags, code)
  }
  if (parsed?.city) uniqueListPushUnique(tags, parsed.city)
  if (parsed?.duration_text) uniqueListPushUnique(tags, parsed.duration_text)
  if (parsed?.years_text) uniqueListPushUnique(tags, parsed.years_text)
  if (parsed?.language) uniqueListPushUnique(tags, parsed.language)
  if (parsed?.daily_rate) uniqueListPushUnique(tags, parsed.daily_rate)
  if (parsed?.is_remote === true) uniqueListPushUnique(tags, '远程')
  if (parsed?.is_remote === false) uniqueListPushUnique(tags, '现场')
  return tags
}

function getUniqueTags(u: any): string[] {
  if (!u) return []
  const tags = safeJsonArray(u.tags_json)
  if (tags.length) return tags.slice(0, 8)
  const rawText = String(u.raw_text || '').trim()
  if (!rawText) return []
  try {
    const parsed = parseDemandText(rawText)
    return extractTagsFromParsed(parsed).slice(0, 8)
  } catch {
    return []
  }
}

function getRawTags(r: any): string[] {
  if (!r) return []
  const tags = safeJsonArray(r.tags_json)
  if (tags.length) return tags.slice(0, 8)

  const parsedFromText = (() => {
    try {
      return parseDemandText(String(r.raw_text || ''))
    } catch {
      return {}
    }
  })()

  const merged = {
    module_codes: Array.isArray(r.module_codes) ? r.module_codes : (parsedFromText as any).module_codes,
    city: String(r.city || (parsedFromText as any).city || ''),
    is_remote: r.is_remote ?? (parsedFromText as any).is_remote,
    duration_text: String(r.duration_text || (parsedFromText as any).duration_text || ''),
    years_text: String(r.years_text || (parsedFromText as any).years_text || ''),
    language: String(r.language || (parsedFromText as any).language || ''),
    daily_rate: String(r.daily_rate || (parsedFromText as any).daily_rate || ''),
  }
  return extractTagsFromParsed(merged).slice(0, 8)
}

function goHome() {
  try {
    uni.reLaunch({ url: '/pages/index/index' })
  } catch {}
}

function formatTime(v: any) {
  if (!v) return ''
  try {
    const d = v instanceof Date ? v : new Date(v)
    if (Number.isNaN(d.getTime())) return ''
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  } catch {
    return ''
  }
}

function onToggleEnabled(e: any) {
  config.value.similarity_enabled = !!(e && e.detail && e.detail.value)
}

function onThresholdInput(e: any) {
  const v = String((e && e.detail && e.detail.value) || '').trim()
  const n = Number(v)
  if (Number.isFinite(n)) {
    config.value.similarity_threshold = n
  }
}

function setRule(rule: SimilarityRule) {
  config.value.similarity_rule = rule
}

async function saveConfig() {
  saving.value = true
  try {
    const saved = await saveAdminConfig({
      similarity_enabled: config.value.similarity_enabled,
      similarity_threshold: config.value.similarity_threshold,
      similarity_rule: config.value.similarity_rule,
    })
    config.value = saved
    uni.showToast({ title: '已保存', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '保存失败', icon: 'none' })
  } finally {
    saving.value = false
  }
}

function onStatusPick(e: any) {
  const idx = Number((e && e.detail && e.detail.value) || 0)
  statusIndex.value = Number.isFinite(idx) ? idx : 0
}

function onEditStatusPick(e: any) {
  const idx = Number((e && e.detail && e.detail.value) || 1)
  editStatusIndex.value = Number.isFinite(idx) ? idx : 1
}

function onToggleOnlyUnlinked(e: any) {
  onlyUnlinkedRaw.value = !!(e && e.detail && e.detail.value)
}

function clearRawKeyword() {
  rawKeyword.value = ''
}

function refreshCandidates() {
  loadRawCandidates()
}

function onCandidateMinSimilarityInput(e: any) {
  const v = String((e && e.detail && e.detail.value) || '').trim()
  const n = Number(v)
  if (Number.isFinite(n) && n >= 0 && n <= 1) {
    candidateMinSimilarity.value = n
  }
}

function goToUniqueDetail() {
  const u = selectedUnique.value
  const uid = String(u?._id || '').trim()
  if (!uid) return
  const url = `/pages/demand/detail?uniqueId=${encodeURIComponent(uid)}`
  try {
    uni.navigateTo({ url })
  } catch {}
}

function goToRawDetail(r: any) {
  const rid = String(r?._id || '').trim()
  if (!rid) return
  const url = `/pages/demand/detail?id=${encodeURIComponent(rid)}`
  try {
    uni.navigateTo({ url })
  } catch {}
}

async function loadReports() {
  loadingReports.value = true
  try {
    reports.value = []
  } catch {
    reports.value = []
  } finally {
    loadingReports.value = false
  }
}

function selectReport(rep: any) {
  selectedReport.value = rep
  const currentStatus = String(rep.status || 'pending')
  const idx = statusOptions.indexOf(currentStatus)
  editStatusIndex.value = idx >= 0 ? idx : 1
  editOperatorNote.value = String(rep.operator_note || '')
  editResultMessage.value = String(rep.result_message || '')
}

async function saveReport() {
  const rep = selectedReport.value
  if (!rep || !rep._id) return

  savingReport.value = true
  try {
    await requireAdmin()
    uni.showToast({ title: '举报模块未迁移', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '保存失败', icon: 'none' })
  } finally {
    savingReport.value = false
  }
}

async function searchUnique() {
  loadingUnique.value = true
  try {
    const all = await fetchAllUniqueDemands({
      orderBy: 'last_updated_time_ts',
      order: 'desc',
      pageSize: 100,
      max: 500,
      onlyValid: true,
    })

    const kw = String(uniqueKeyword.value || '').trim()
    if (!kw) {
      uniqueList.value = all.slice(0, 30)
      uniqueStart.value = 0
      return
    }

    const kwLower = kw.toLowerCase()
    uniqueList.value = all
      .filter((u) => String(u.raw_text || '').toLowerCase().includes(kwLower) || String(u._id || '').includes(kw))
      .slice(0, 30)
    uniqueStart.value = 0
  } catch {
    uniqueList.value = []
  } finally {
    loadingUnique.value = false
  }
}

function prevUnique() {
  uniqueStart.value = Math.max(0, uniqueStart.value - UNIQUE_PAGE_SIZE)
}

function nextUnique() {
  const total = uniqueList.value.length
  const next = uniqueStart.value + UNIQUE_PAGE_SIZE
  if (next >= total) return
  uniqueStart.value = next
}

async function selectUnique(u: SapUniqueDemandDoc) {
  selectedUnique.value = u
  await loadRawCandidates()
}

async function loadRawCandidates() {
  const u = selectedUnique.value
  if (!u) return

  loadingRaw.value = true
  try {
    const adminCfg = await fetchAdminConfig()
    candidateRule.value = adminCfg.similarity_rule
    const uniqueId = String(u._id || '').trim()

    const kw = String(rawKeyword.value || '').trim()
    const kwLower = kw.toLowerCase()

    const base = String(SAPBOSS_API_BASE).replace(/\/+$/, '')
    const qs = buildQueryString({
      uniqueId,
      kw,
    })

    const resp: any = await requestJson({
      url: `${base}/admin/raw_candidates?${qs}`,
      method: 'GET',
    })

    const list = resp && resp.ok && Array.isArray(resp.demands) ? resp.demands : []

    const uniqueText = String(u.raw_text || '').trim()
    const uniqueParsed = parseDemandText(uniqueText)

    const normalizeCity = (v: any) => String(v || '').trim().toLowerCase()
    const normalizeModules = (v: any) =>
      (Array.isArray(v) ? v : [])
        .map((s) => String(s || '').trim().toUpperCase())
        .filter((s) => !!s)
    const hasAnyIntersection = (a: string[], b: string[]) => {
      if (!a.length || !b.length) return false
      const setB = new Set(b)
      for (const x of a) {
        if (setB.has(x)) return true
      }
      return false
    }

    const uniqueCity = normalizeCity(uniqueParsed.city)
    const uniqueModules = normalizeModules(uniqueParsed.module_codes)

    const scored = list
      .map((d: any) => {
        const rawText = String(d.raw_text || '')
        const textSim = calculateTextSimilarity(uniqueText, rawText)

        const parsedFromText = parseDemandText(rawText)

        const parsed = {
          module_codes: Array.isArray(d.module_codes) ? d.module_codes : parsedFromText.module_codes,
          city: String(d.city || parsedFromText.city || ''),
          is_remote: d.is_remote,
          duration_text: String(d.duration_text || parsedFromText.duration_text || ''),
          years_text: String(d.years_text || parsedFromText.years_text || ''),
          language: String(d.language || parsedFromText.language || ''),
          daily_rate: String(d.daily_rate || parsedFromText.daily_rate || ''),
        }

        const catSim = calculateCategorySimilarityFromParsed(uniqueParsed, parsed)
        const hybrid = Math.max(catSim, textSim * 0.5)

        let sim = textSim
        if (adminCfg.similarity_rule === 'category') sim = catSim
        if (adminCfg.similarity_rule === 'hybrid') sim = hybrid

        const currentLinkedId = String(d.unique_demand_id || '').trim()
        let group = 1
        if (currentLinkedId && currentLinkedId === uniqueId) group = 0
        else if (currentLinkedId) group = 2

        const candidateCity = normalizeCity(parsed.city)
        const candidateModules = normalizeModules(parsed.module_codes)

        const moduleOk = !uniqueModules.length || !candidateModules.length || hasAnyIntersection(uniqueModules, candidateModules)
        const cityOk = !uniqueCity || !candidateCity || uniqueCity === candidateCity

        return {
          ...d,
          __similarity: sim,
          __priority_group: group,
          __module_ok: moduleOk,
          __city_ok: cityOk,
          __kw_ok: !kwLower || rawText.toLowerCase().includes(kwLower) || String(d._id || '').includes(kw),
        }
      })
      .filter((x: any) => {
        if ((x.__priority_group || 1) === 0) return true
        if (!x.__kw_ok) return false
        if (!x.__module_ok || !x.__city_ok) return false
        return (x.__similarity || 0) >= Number(candidateMinSimilarity.value || 0.5)
      })
      .sort((a: any, b: any) => {
        const ga = Number(a.__priority_group || 1)
        const gb = Number(b.__priority_group || 1)
        if (ga !== gb) return ga - gb
        const sa = Number(a.__similarity || 0)
        const sb = Number(b.__similarity || 0)
        if (sb !== sa) return sb - sa
        const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0
        const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0
        return tb - ta
      })
      .slice(0, 30)

    rawCandidates.value = scored
  } catch {
    rawCandidates.value = []
  } finally {
    loadingRaw.value = false
  }
}

async function linkRaw(r: any) {
  const u = selectedUnique.value
  if (!u || !u._id || !r || !r._id) return

  try {
    await requireAdmin()
    const base = String(SAPBOSS_API_BASE).replace(/\/+$/, '')
    const resp: any = await requestJson({
      url: `${base}/admin/link_raw`,
      method: 'POST',
      data: {
        rawId: String(r._id),
        uniqueId: String(u._id),
      },
    })

    if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'LINK_FAILED')

    uni.showToast({ title: '已关联', icon: 'none' })
    await loadRawCandidates()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

async function unlinkRaw(r: any) {
  if (!r || !r._id) return

  try {
    await requireAdmin()
    const base = String(SAPBOSS_API_BASE).replace(/\/+$/, '')
    const resp: any = await requestJson({
      url: `${base}/admin/unlink_raw`,
      method: 'POST',
      data: {
        rawId: String(r._id),
      },
    })

    if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'UNLINK_FAILED')

    uni.showToast({ title: '已解除', icon: 'none' })
    await loadRawCandidates()
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

async function setCanonicalRaw(r: any) {
  const u = selectedUnique.value
  if (!u || !u._id || !r || !r._id) return

  try {
    await requireAdmin()
    const base = String(SAPBOSS_API_BASE).replace(/\/+$/, '')
    const resp: any = await requestJson({
      url: `${base}/admin/set_canonical_raw`,
      method: 'POST',
      data: {
        uniqueId: String(u._id),
        rawId: String(r._id),
      },
    })

    if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'SET_CANONICAL_FAILED')

    uni.showToast({ title: '已设置', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '操作失败', icon: 'none' })
  }
}

onMounted(async () => {
  try {
    await requireAdmin()
    config.value = await fetchAdminConfig()
    ready.value = true
    await loadReports()
    await searchUnique()
  } catch {
    ready.value = false
  }
})
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx;
  background: #F5F1E8;
  color: #111827;
  font-family: "Noto Sans SC", "Source Han Sans SC", sans-serif;
}

.card {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 26rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
}

.header {
  padding-bottom: 14rpx;
  border-bottom: 2rpx solid rgba(17, 24, 39, 0.08);
}

.header-top {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 12rpx;
}

.badge {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: #0B1924;
  color: #F5F1E8;
  font-size: 20rpx;
  font-weight: 900;
  letter-spacing: 1rpx;
}

.title {
  font-size: 40rpx;
  font-weight: 800;
  font-family: "Noto Serif SC", "Source Han Serif SC", serif;
}

.subtitle {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.55);
}

.tabs {
  margin-top: 18rpx;
  display: flex;
  flex-direction: row;
  gap: 12rpx;
}

.tab {
  flex: 1;
  padding: 14rpx 12rpx;
  border-radius: 16rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.1);
  background: rgba(245, 241, 232, 0.6);
}

.tab.active {
  background: #D97706;
  border-color: rgba(17, 24, 39, 0.2);
}

.tab-text {
  font-size: 24rpx;
  font-weight: 800;
}

.panel {
  margin-top: 18rpx;
}

.section {
  padding: 18rpx;
  border-radius: 18rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
  background: rgba(245, 241, 232, 0.55);
  margin-top: 16rpx;
}

.h2 {
  display: block;
  font-size: 28rpx;
  font-weight: 900;
  margin-bottom: 12rpx;
}

.h3 {
  display: block;
  font-size: 26rpx;
  font-weight: 900;
}

.hint {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.62);
}

.p {
  display: block;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(17, 24, 39, 0.82);
}

.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 14rpx;
}

.row.col {
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
}

.label {
  font-size: 24rpx;
  font-weight: 800;
  color: rgba(17, 24, 39, 0.85);
}

.input {
  width: 100%;
  padding: 16rpx;
  border-radius: 16rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.12);
  background: #FFFFFF;
  font-size: 24rpx;
}

.textarea {
  width: 100%;
  padding: 16rpx;
  border-radius: 16rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.12);
  background: #FFFFFF;
  font-size: 24rpx;
  line-height: 1.65;
}

.picker {
  width: 100%;
  padding: 16rpx;
  border-radius: 16rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.12);
  background: #FFFFFF;
  font-size: 24rpx;
}

.radio-group {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.radio {
  width: 100%;
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 10rpx;
  padding: 14rpx 14rpx;
  border-radius: 16rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.12);
  background: #FFFFFF;
}

.radio.checked {
  border-color: rgba(217, 119, 6, 0.7);
}

.radio-dot {
  width: 18rpx;
  height: 18rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.4);
  background: rgba(245, 241, 232, 0.8);
}

.radio.checked .radio-dot {
  border-color: #D97706;
  background: #D97706;
}

.radio-text {
  font-size: 24rpx;
  font-weight: 800;
}

.btn {
  width: 100%;
  margin-top: 10rpx;
  padding: 12rpx 16rpx;
  border-radius: 14rpx;
  background: #D97706;
  color: #111827;
  font-size: 24rpx;
  font-weight: 900;
}

.btn-ghost {
  background: #0B1924;
  color: #F5F1E8;
}

.btn-danger {
  background: #B91C1C;
  color: #F5F1E8;
}

.btn-small {
  width: auto;
  margin-top: 0;
  padding: 10rpx 12rpx;
  border-radius: 12rpx;
  font-size: 20rpx;
}

.btn[disabled] {
  opacity: 0.55;
}

.unique-list-wrap {
  margin-top: 14rpx;
}

.unique-nav {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
}

.unique-nav-text {
  font-size: 22rpx;
  font-weight: 800;
  color: rgba(17, 24, 39, 0.65);
}

.list--compact {
  margin-top: 10rpx;
  gap: 10rpx;
}

.selected-unique-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
  font-size: 24rpx;
  line-height: 1.6;
  font-weight: 900;
  color: rgba(11, 25, 36, 0.9);
  margin-top: 4rpx;
}

.list {
  margin-top: 14rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.list-item {
  padding: 14rpx;
  border-radius: 16rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.1);
  background: #FFFFFF;
}

.list-item.selected {
  border-color: rgba(217, 119, 6, 0.7);
}

.list-title {
  display: block;
  font-size: 24rpx;
  font-weight: 900;
  color: rgba(17, 24, 39, 0.9);
}

.list-title--clamp2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.tag-row {
  margin-top: 8rpx;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8rpx;
}

.tag-row--selected {
  margin-top: 10rpx;
}

.tag {
  padding: 6rpx 10rpx;
  border-radius: 999rpx;
  background: rgba(11, 25, 36, 0.08);
  color: rgba(11, 25, 36, 0.88);
  font-size: 20rpx;
  font-weight: 800;
}

.list-meta {
  display: block;
  margin-top: 6rpx;
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.55);
}

.subsection {
  margin-top: 18rpx;
}

.raw-list {
  margin-top: 12rpx;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}

.raw-item {
  padding: 14rpx;
  border-radius: 16rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.1);
  background: #FFFFFF;
}

.raw-top {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.raw-sim {
  font-size: 22rpx;
  font-weight: 900;
  color: #0B1924;
}

.raw-id {
  font-size: 20rpx;
  color: rgba(17, 24, 39, 0.55);
}

.raw-text {
  display: block;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(17, 24, 39, 0.82);
}

.raw-meta {
  display: block;
  margin-top: 8rpx;
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.55);
}

.raw-actions {
  margin-top: 12rpx;
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10rpx;
}

.muted {
  margin-top: 12rpx;
  font-size: 24rpx;
  color: rgba(17, 24, 39, 0.55);
}
</style>
