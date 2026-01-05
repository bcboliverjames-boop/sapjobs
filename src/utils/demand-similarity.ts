/**
 * 需求相似度检查工具
 * 用于检测重复或相似的需求
 */

import { parseDemandText } from './demand-parser'

function getDemandsApiBase(): string {
  const fromEnv =
    (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
  if (fromEnv) return String(fromEnv)

  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) return 'http://127.0.0.1:3004'
    }
  } catch {
    // ignore
  }

  return 'https://api.sapboss.com'
}

const DEMANDS_API_BASE = getDemandsApiBase()

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

type ParsedDemandLite = {
  module_codes: string[]
  city: string
  is_remote: boolean | undefined
  duration_text: string
  years_text: string
  language: string
  daily_rate?: string
}

/**
 * 计算两个文本的相似度（使用简单的字符匹配算法）
 * 返回 0-1 之间的相似度值，1 表示完全相同
 */
export function calculateTextSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) {
    return 0
  }
  
  // 标准化文本：去除空格、标点、转小写
  const normalize = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[\s\p{P}]/gu, '') // 去除所有空格和标点符号
      .trim()
  }
  
  const normalized1 = normalize(text1)
  const normalized2 = normalize(text2)
  
  // 如果标准化后完全相同，相似度为 1
  if (normalized1 === normalized2) {
    return 1
  }
  
  // 如果其中一个包含另一个，相似度较高
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
    const longer = normalized1.length > normalized2.length ? normalized1 : normalized2
    const shorter = normalized1.length > normalized2.length ? normalized2 : normalized1
    return shorter.length / longer.length
  }
  
  // 使用最长公共子序列（LCS）算法计算相似度
  const lcsLength = longestCommonSubsequence(normalized1, normalized2)
  const maxLength = Math.max(normalized1.length, normalized2.length)
  
  return lcsLength / maxLength
}

/**
 * 计算最长公共子序列的长度
 */
function longestCommonSubsequence(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }
  
  return dp[m][n]
}

/**
 * 检查需求文本的关键特征是否匹配
 */
export function checkDemandFeatures(
  text1: string,
  text2: string
): {
  moduleMatch: boolean
  cityMatch: boolean
  yearsMatch: boolean
  similarity: number
} {
  // 提取关键特征
  const extractFeatures = (text: string) => {
    const lower = text.toLowerCase()
    
    // 提取模块
    const modules: string[] = []
    const modulePatterns = [
      { pattern: /fico|fi\/co|财务|成本/i, code: 'FICO' },
      { pattern: /mm|物料|采购/i, code: 'MM' },
      { pattern: /sd|销售|分销/i, code: 'SD' },
      { pattern: /pp|生产|计划/i, code: 'PP' },
      { pattern: /abap|开发/i, code: 'ABAP' },
      { pattern: /hr|人事|人力/i, code: 'HR' },
      { pattern: /bw|数据仓库/i, code: 'BW' },
    ]
    
    modulePatterns.forEach(({ pattern, code }) => {
      if (pattern.test(text) && !modules.includes(code)) {
        modules.push(code)
      }
    })
    
    // 提取城市
    const cityMatch = text.match(/北京|上海|深圳|广州|杭州|成都|远程|海外/i)
    const city = cityMatch ? cityMatch[0] : ''
    
    // 提取年限
    const yearsMatch = text.match(/(\d+)\s*年/i)
    const years = yearsMatch ? yearsMatch[1] : ''
    
    return { modules, city, years }
  }
  
  const features1 = extractFeatures(text1)
  const features2 = extractFeatures(text2)
  
  // 检查模块匹配（至少有一个模块相同）
  const moduleMatch =
    features1.modules.length > 0 &&
    features2.modules.length > 0 &&
    features1.modules.some((m) => features2.modules.includes(m))
  
  // 检查城市匹配
  const cityMatch = features1.city && features2.city && features1.city === features2.city
  
  // 检查年限匹配（允许一定误差）
  const yearsMatch =
    features1.years &&
    features2.years &&
    Math.abs(parseInt(features1.years) - parseInt(features2.years)) <= 2
  
  // 计算文本相似度
  const similarity = calculateTextSimilarity(text1, text2)
  
  return {
    moduleMatch,
    cityMatch,
    yearsMatch,
    similarity,
  }
}

function normModule(m: any): string {
  const s = String(m || '').trim().toUpperCase().replace(/\s+/g, '')
  const t = s.replace(/\\/g, '/').replace(/\|/g, '/').replace(/／/g, '/').replace(/＼/g, '/')
  if (t === 'FI/CO' || t === 'FICO') return 'FICO'
  return t
}

function normStr(v: any): string {
  return String(v || '').trim()
}

function normCity(v: any): string {
  const s = normStr(v)
  if (!s) return ''
  if (s === '在家') return '远程'
  return s
}

function overlapRatio(a: string[], b: string[]): number {
  const sa = new Set(a.filter(Boolean))
  const sb = new Set(b.filter(Boolean))
  if (!sa.size || !sb.size) return 0
  let inter = 0
  for (const x of sa) {
    if (sb.has(x)) inter += 1
  }
  const denom = Math.min(sa.size, sb.size)
  if (!denom) return 0
  return inter / denom
}

function eqScore(a: string, b: string): number {
  if (!a || !b) return 0
  return a === b ? 1 : 0
}

export function calculateCategorySimilarityFromParsed(a: ParsedDemandLite, b: ParsedDemandLite): number {
  if (!a || !b) return 0

  const aModules = (Array.isArray(a.module_codes) ? a.module_codes : []).map(normModule).filter(Boolean)
  const bModules = (Array.isArray(b.module_codes) ? b.module_codes : []).map(normModule).filter(Boolean)

  const hasModuleA = aModules.length > 0
  const hasModuleB = bModules.length > 0
  if (hasModuleA !== hasModuleB) return 0
  if (hasModuleA && hasModuleB) {
    const modScore = overlapRatio(aModules, bModules)
    if (modScore <= 0) return 0
  }

  const aCity = normCity(a.city)
  const bCity = normCity(b.city)
  if (aCity && bCity && aCity !== bCity) {
    return 0
  }

  const weights: Record<string, number> = {
    module: 3,
    city: 2,
    remote: 1,
    duration: 1,
    years: 1,
    language: 1,
    rate: 1,
  }

  let totalW = 0
  let totalS = 0

  if (hasModuleA && hasModuleB) {
    const s = overlapRatio(aModules, bModules)
    totalW += weights.module
    totalS += s * weights.module
  }

  if (aCity && bCity) {
    const s = eqScore(aCity, bCity)
    totalW += weights.city
    totalS += s * weights.city
  }

  const ra = a.is_remote === undefined ? '' : String(!!a.is_remote)
  const rb = b.is_remote === undefined ? '' : String(!!b.is_remote)
  if (ra && rb) {
    const s = eqScore(ra, rb)
    totalW += weights.remote
    totalS += s * weights.remote
  }

  const da = normStr(a.duration_text)
  const db = normStr(b.duration_text)
  if (da && db) {
    const s = da === db ? 1 : 0
    totalW += weights.duration
    totalS += s * weights.duration
  }

  const ya = normStr(a.years_text)
  const yb = normStr(b.years_text)
  if (ya && yb) {
    const s = ya === yb ? 1 : 0
    totalW += weights.years
    totalS += s * weights.years
  }

  const la = normStr(a.language)
  const lb = normStr(b.language)
  if (la && lb) {
    const s = la === lb ? 1 : 0
    totalW += weights.language
    totalS += s * weights.language
  }

  const rta = normStr((a as any).daily_rate)
  const rtb = normStr((b as any).daily_rate)
  if (rta && rtb) {
    const s = rta === rtb ? 1 : 0
    totalW += weights.rate
    totalS += s * weights.rate
  }

  if (totalW <= 0) return 0
  return totalS / totalW
}

export async function checkSimilarDemandsByPolicy(opts: {
  rawText: string
  parsed?: ParsedDemandLite
  currentUserId?: string
  days?: number
  limit?: number
  threshold?: number
  rule: 'text' | 'category' | 'hybrid'
}): Promise<{
  hasSimilar: boolean
  similarDemands: Array<{
    id: string
    raw_text: string
    similarity: number
    createdAt: Date
    provider_name: string
    provider_user_id?: string
    isSameUser?: boolean
  }>
}> {
  const rawText = String(opts.rawText || '')
  const parsedBase = opts.parsed || (parseDemandText(rawText) as any)

  const resp: any = await requestJson({
    url: `${String(DEMANDS_API_BASE).replace(/\/+$/, '')}/demands/check_similar`,
    method: 'POST',
    data: {
      rawText,
      parsed: parsedBase,
      currentUserId: opts.currentUserId,
      days: typeof opts.days === 'number' ? opts.days : 7,
      limit: typeof opts.limit === 'number' ? opts.limit : 100,
      threshold: typeof opts.threshold === 'number' ? opts.threshold : undefined,
      rule: opts.rule,
    },
  })

  if (!resp || !resp.ok) {
    throw new Error((resp && resp.error) || 'CHECK_SIMILAR_FAILED')
  }

  return {
    hasSimilar: !!resp.hasSimilar,
    similarDemands: Array.isArray(resp.similarDemands) ? resp.similarDemands : [],
  }
}

/**
 * 检查是否存在相似的需求
 * @param rawText 需求原文
 * @param currentUserId 当前发布者的用户ID（可选，用于区分同一用户和不同用户）
 * @param days 检查最近多少天的需求（默认7天）
 * @param similarityThreshold 相似度阈值（默认0.7，即70%相似）
 */
export async function checkSimilarDemands(
  rawText: string,
  currentUserId?: string,
  days: number = 7,
  similarityThreshold: number = 0.7
): Promise<{
  hasSimilar: boolean
  similarDemands: Array<{
    id: string
    raw_text: string
    similarity: number
    createdAt: any
    provider_name: string
    provider_user_id?: string
    isSameUser?: boolean
  }>
}> {
  try {
    return await checkSimilarDemandsByPolicy({
      rawText,
      currentUserId,
      days,
      threshold: similarityThreshold,
      rule: 'text',
    })
  } catch (error) {
    console.error('检查相似需求失败:', error)
    return {
      hasSimilar: false,
      similarDemands: [],
    }
  }
}

/**
 * 合并相似需求（用于需求列表展示）
 * 将相似度高的需求合并为一组，只显示最早的需求
 * @param demands 需求列表
 * @param similarityThreshold 相似度阈值（默认0.85，即85%相似）
 */
export function mergeSimilarDemands(
  demands: Array<{
    id?: string
    raw_text: string
    createdAt: Date | string
    provider_user_id?: string
    provider_name: string
    [key: string]: any
  }>,
  similarityThreshold: number = 0.85
): Array<{
  id?: string
  raw_text: string
  createdAt: Date | string
  provider_user_id?: string
  provider_name: string
  similarCount: number // 相似需求数量
  similarDemands: Array<{ // 折叠的相似需求列表
    id?: string
    raw_text: string
    createdAt: Date | string
    provider_user_id?: string
    provider_name: string
    similarity: number
  }>
  [key: string]: any
}> {
  const merged: Array<any> = []
  const processed = new Set<string>()
  
  // 按创建时间排序（最早的在前）
  const sortedDemands = [...demands].sort((a, b) => {
    const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()
    const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()
    return timeA - timeB
  })
  
  for (let i = 0; i < sortedDemands.length; i++) {
    const demand = sortedDemands[i]
    const demandId = demand.id || `temp_${i}`
    
    // 如果已经处理过，跳过
    if (processed.has(demandId)) {
      continue
    }
    
    // 查找相似需求
    const similarGroup: any[] = []
    for (let j = i + 1; j < sortedDemands.length; j++) {
      const otherDemand = sortedDemands[j]
      const otherId = otherDemand.id || `temp_${j}`
      
      // 跳过已处理的
      if (processed.has(otherId)) {
        continue
      }
      
      // 必须是不同用户发布的需求
      if (demand.provider_user_id && otherDemand.provider_user_id && 
          demand.provider_user_id === otherDemand.provider_user_id) {
        continue // 同一用户的需求不合并
      }
      
      // 计算相似度
      const similarity = calculateTextSimilarity(demand.raw_text, otherDemand.raw_text)
      
      if (similarity >= similarityThreshold) {
        similarGroup.push({
          ...otherDemand,
          similarity: Math.round(similarity * 100) / 100,
        })
        processed.add(otherId)
      }
    }
    
    // 如果有相似需求，创建合并后的需求
    if (similarGroup.length > 0) {
      merged.push({
        ...demand,
        similarCount: similarGroup.length,
        similarDemands: similarGroup,
      })
    } else {
      // 没有相似需求，直接添加
      merged.push({
        ...demand,
        similarCount: 0,
        similarDemands: [],
      })
    }
    
    processed.add(demandId)
  }
  
  // 按创建时间倒序排序（最新的在前）
  return merged.sort((a, b) => {
    const timeA = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime()
    const timeB = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime()
    return timeB - timeA
  })
}

