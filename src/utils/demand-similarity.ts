/**
 * 需求相似度检查工具
 * 用于检测重复或相似的需求
 */

import { app } from './cloudbase'

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
    createdAt: Date
    provider_name: string
    provider_user_id?: string
    isSameUser?: boolean
  }>
}> {
  try {
    const db = app.database()
    const coll = db.collection('sap_demands_raw')
    
    // 计算时间范围
    const now = new Date()
    const daysAgo = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    
    // 查询最近的需求
    const res = await coll
      .where({
        createdAt: db.command.gte(daysAgo as any),
      })
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get()
    
    const demands = res.data || []
    const similarDemands: Array<{
      id: string
      raw_text: string
      similarity: number
      createdAt: Date
      provider_name: string
      provider_user_id?: string
      isSameUser?: boolean
    }> = []
    
    // 检查每条需求的相似度
    for (const demand of demands) {
      const similarity = calculateTextSimilarity(rawText, demand.raw_text || '')
      
      if (similarity >= similarityThreshold) {
        const isSameUser = currentUserId && demand.provider_user_id === currentUserId
        
        similarDemands.push({
          id: demand._id,
          raw_text: demand.raw_text,
          similarity: Math.round(similarity * 100) / 100, // 保留两位小数
          createdAt: demand.createdAt,
          provider_name: demand.provider_name || '未知',
          provider_user_id: demand.provider_user_id,
          isSameUser, // 标记是否是同一用户
        })
      }
    }
    
    // 按相似度降序排序
    similarDemands.sort((a, b) => b.similarity - a.similarity)
    
    return {
      hasSimilar: similarDemands.length > 0,
      similarDemands: similarDemands.slice(0, 5), // 最多返回5条
    }
  } catch (e) {
    console.error('检查相似需求失败:', e)
    // 出错时返回无相似需求，避免阻塞发布流程
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

