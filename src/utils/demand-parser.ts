/**
 * 需求原文智能解析工具
 * 自动识别需求原文中的模块、城市、周期、年限、语言等信息
 */

/**
 * 解析需求原文，提取结构化信息
 */
export function parseDemandText(rawText: string): {
  module_codes: string[]
  city: string
  is_remote: boolean | undefined
  duration_text: string
  years_text: string
  language: string
  daily_rate?: string // 人天价格
} {
  const text = rawText || ''
  const lowerText = text.toLowerCase()
  
  // 1. 识别 SAP 模块
  const module_codes: string[] = []
  const modulePatterns = [
    { pattern: /fico|fi\/co|财务|成本/i, code: 'FICO' },
    { pattern: /mm|物料|采购/i, code: 'MM' },
    { pattern: /sd|销售|分销/i, code: 'SD' },
    { pattern: /pp|生产|计划/i, code: 'PP' },
    { pattern: /(?:^|[^a-z])ewm(?:$|[^a-z])|extended\s*warehouse/i, code: 'EWM' },
    { pattern: /(?:^|[^a-z])wm(?:$|[^a-z])|仓库|仓储/i, code: 'WM' },
    { pattern: /hr|人事|人力/i, code: 'HR' },
    { pattern: /sac|分析云/i, code: 'SAC' },
    { pattern: /bi|商业智能/i, code: 'BI' },
    { pattern: /bw|数据仓库/i, code: 'BW' },
    { pattern: /abap|开发/i, code: 'ABAP' },
    { pattern: /fiori|菲奥里/i, code: 'FIORI' },
    { pattern: /pm|设备|维护/i, code: 'PM' },
    { pattern: /ps|项目(?!周期)|project\s*system/i, code: 'PS' },
    { pattern: /mdg|主数据/i, code: 'MDG' },
  ]
  
  modulePatterns.forEach(({ pattern, code }) => {
    if (pattern.test(text) && !module_codes.includes(code)) {
      module_codes.push(code)
    }
  })
  
  // 如果没有识别到模块，尝试识别"其他"
  if (module_codes.length === 0) {
    // 仅在明确 SAP 相关且具有“模块/岗位/顾问”语境时才兜底 OTHER
    const hasSapSignal = /\bsap\b|\bs\/4\b|\bec\b/i.test(text) || /SAP|S\/4|ECC/i.test(text)
    const hasModuleContext = /模块|顾问|岗位|要人|资源|招聘|找人|寻找|寻人|实施|运维|支持|support|consultant/i.test(text)
    if (hasSapSignal && hasModuleContext) {
      module_codes.push('OTHER')
    }
  }
  
  // 2. 识别城市/地区（支持省份、城市、海外等）
  let city = ''
  
  // 先尝试匹配具体城市
  const cityMap: Record<string, string> = {
    '北京': '北京',
    'beijing': '北京',
    'bj': '北京',
    '上海': '上海',
    'shanghai': '上海',
    'sh': '上海',
    '深圳': '深圳',
    'shenzhen': '深圳',
    'sz': '深圳',
    '广州': '广州',
    'guangzhou': '广州',
    'gz': '广州',
    '杭州': '杭州',
    'hangzhou': '杭州',
    'hz': '杭州',
    '成都': '成都',
    'chengdu': '成都',
    'cd': '成都',
    '武汉': '武汉',
    'wuhan': '武汉',
    'wh': '武汉',
    '南京': '南京',
    'nanjing': '南京',
    'nj': '南京',
    '苏州': '苏州',
    'suzhou': '苏州',
    '合肥': '合肥',
    'hefei': '合肥',
    '全国': '全国',
    '远程': '远程',
    'remote': '远程',
    '在家': '远程',
    '居家': '远程',
    '海外': '海外',
    'overseas': '海外',
    '国外': '海外',
    '欧洲': '欧洲',
    'europe': '欧洲',
    '菲律宾': '菲律宾',
    '菲利宾': '菲律宾',
    'philippines': '菲律宾',
  }
  
  // 省份映射
  const provinceMap: Record<string, string> = {
    '广东': '广东',
    'guangdong': '广东',
    'gd': '广东',
    '安徽': '安徽',
    'anhui': '安徽',
    'ah': '安徽',
    '浙江': '浙江',
    'zhejiang': '浙江',
    'zj': '浙江',
    '江苏': '江苏',
    'jiangsu': '江苏',
    'js': '江苏',
    '山东': '山东',
    'shandong': '山东',
    'sd': '山东',
    '河南': '河南',
    'henan': '河南',
    'ha': '河南',
    '湖南': '湖南',
    'hunan': '湖南',
    'hn': '湖南',
    '湖北': '湖北',
    'hubei': '湖北',
    'hb': '湖北',
    '四川': '四川',
    'sichuan': '四川',
    'sc': '四川',
    '福建': '福建',
    'fujian': '福建',
    'fj': '福建',
    '河北': '河北',
    'hebei': '河北',
    'he': '河北',
    '陕西': '陕西',
    'shaanxi': '陕西',
    'sn': '陕西',
    '辽宁': '辽宁',
    'liaoning': '辽宁',
    'ln': '辽宁',
    '吉林': '吉林',
    'jilin': '吉林',
    'jl': '吉林',
    '黑龙江': '黑龙江',
    'heilongjiang': '黑龙江',
    'hl': '黑龙江',
    '江西': '江西',
    'jiangxi': '江西',
    'jx': '江西',
    '重庆': '重庆',
    'chongqing': '重庆',
    'cq': '重庆',
    '天津': '天津',
    'tianjin': '天津',
    'tj': '天津',
  }
  
  // 先匹配具体城市
  for (const [key, value] of Object.entries(cityMap)) {
    if (new RegExp(key, 'i').test(text)) {
      city = value
      break
    }
  }
  
  // 如果没匹配到城市，尝试匹配省份
  if (!city) {
    for (const [key, value] of Object.entries(provinceMap)) {
      if (new RegExp(key, 'i').test(text)) {
        city = value
        break
      }
    }
  }
  
  // 如果包含多个地区（如"广东+欧洲"），提取第一个，但优先识别具体地区
  const multiCityMatch = text.match(/([\u4e00-\u9fa5]+)\s*[+＋]\s*([\u4e00-\u9fa5]+)/i)
  if (multiCityMatch) {
    const firstCity = multiCityMatch[1]
    const secondCity = multiCityMatch[2]
    
    // 检查第一个是否是省份或城市
    if (provinceMap[firstCity] || cityMap[firstCity]) {
      city = provinceMap[firstCity] || cityMap[firstCity] || firstCity
    } else if (provinceMap[secondCity] || cityMap[secondCity]) {
      // 如果第一个不是，检查第二个
      city = provinceMap[secondCity] || cityMap[secondCity] || secondCity
    }
  }
  
  // 如果还是没有识别到，尝试匹配"XX:"或"XX："格式（如"安徽:"）
  if (!city) {
    const colonMatch = text.match(/([\u4e00-\u9fa5]+)[：:]/)
    if (colonMatch) {
      const potentialCity = colonMatch[1]
      if (provinceMap[potentialCity] || cityMap[potentialCity]) {
        city = provinceMap[potentialCity] || cityMap[potentialCity] || potentialCity
      }
    }
  }
  
  // 3. 识别工作方式
  let is_remote: boolean | undefined = undefined
  if (/远程|remote|在家|居家|线上/i.test(text)) {
    is_remote = true
  } else if (/现场|onsite|on-site|到岗|驻场/i.test(text)) {
    is_remote = false
  }
  
  // 4. 识别项目周期
  let duration_text = ''
  const durationPatterns: Array<{ pattern: RegExp; text?: string; match?: (m: RegExpMatchArray) => string; allow?: (m: RegExpMatchArray) => boolean }> = [
    { pattern: /长期|永久|持续|长期项目/i, text: '长期' },
    // 6-12个月 / 6~12个月 / 6到12个月
    {
      pattern: /(\d{1,2})\s*(?:[-—~～到至])\s*(\d{1,2})\s*(?:个)?月/i,
      match: (m) => `${m[1]}-${m[2]}个月`,
    },
    // 3+3个月 / 3 + 3月
    {
      pattern: /(\d{1,2})\s*\+\s*(\d{1,2})\s*(?:个)?月/i,
      match: (m) => `${m[1]}+${m[2]}个月`,
    },
    // 半年
    { pattern: /半年/i, text: '6个月' },
    // 12个月 / 12 month
    { pattern: /(\d{1,2})\s*个月/i, match: (m) => `${m[1]}个月` },
    { pattern: /(\d{1,2})\s*month/i, match: (m) => `${m[1]}个月` },
    // “3月”可能是日期（3月份到岗）也可能被写作周期（为期3月）。默认不认作周期，只有强语境才识别。
    {
      pattern: /(\d{1,2})\s*月/i,
      match: (m) => `${m[1]}个月`,
      allow: (m) => {
        const raw = String(m[0] || '')
        const idx = text.indexOf(raw)
        const left = Math.max(0, idx - 12)
        const right = Math.min(text.length, idx + raw.length + 12)
        const ctx = text.slice(left, right)
        // 日期/到岗月份语境：不应当作周期
        if (/到岗|入场|入职|onboard|上岗|开始|进场|月份|日期|月初|月中|月末|\bmar\b|\bapr\b/i.test(ctx)) return false
        // 周期/工期语境：才认作周期
        return /周期|工期|合同|为期|项目|时长|duration/i.test(ctx)
      },
    },
    // 周期：8周
    { pattern: /(\d{1,2})\s*周/i, match: (m) => `${m[1]}周` },
    // 天：30天（较少见，但有些会写）
    { pattern: /(\d{1,3})\s*天/i, match: (m) => `${m[1]}天` },
    // 中文年：一年/两年/二年/一年左右/一年半（仅在项目周期语境才视为周期）
    {
      pattern: /(一|二|两)\s*年\s*(半)?\s*(?:左右|多|\+|以上|及以上|起)?/i,
      match: (m) => {
        const cn = String(m[1] || '').trim()
        const half = !!m[2]
        const y = cn === '二' || cn === '两' ? 2 : 1
        if (half) return `${y * 12 + 6}个月`
        return `${y}年`
      },
      allow: (m) => {
        const raw = String(m[0] || '')
        const idx = text.indexOf(raw)
        const left = Math.max(0, idx - 12)
        const right = Math.min(text.length, idx + raw.length + 12)
        const ctx = text.slice(left, right)
        if (/(?:\d{1,2}|一|二|两)\s*年\s*(?:以上|及以上|\+)?\s*(?:年经验|工作经验)/i.test(ctx)) return false
        if (/年经验|工作经验/i.test(ctx)) return false
        if (/项目|周期|工期|合同|预计|时长|到岗|开始|结束|为期|duration/i.test(ctx)) return true
        return /项目|周期|工期|合同|预计|时长|到岗|开始|结束|为期|duration/i.test(text)
      },
    },
    // 年：仅在“项目/周期/合同/预计/工期”等语境出现时才视为周期，避免把“3年经验”识别成周期
    {
      pattern: /(\d{1,2})\s*年|(\d{1,2})\s*year/i,
      match: (m) => `${m[1] || m[2]}年`,
      allow: (m) => {
        const y = Number(m[1] || m[2] || 0)
        // 周期一般不超过 2 年：>=3 年更可能是经验年限
        if (!Number.isFinite(y) || y >= 3) return false
        const raw = String(m[0] || '')
        const idx = text.indexOf(raw)
        const left = Math.max(0, idx - 12)
        const right = Math.min(text.length, idx + raw.length + 12)
        const ctx = text.slice(left, right)
        if (/(?:\d{1,2})\s*年\s*(?:以上|及以上|\+)?\s*(?:年经验|工作经验)/i.test(ctx)) return false
        if (/年经验|工作经验/i.test(ctx)) return false
        if (/项目|周期|工期|合同|预计|时长|到岗|开始|结束|为期|duration/i.test(ctx)) return true
        return /项目|周期|工期|合同|预计|时长|到岗|开始|结束|为期|duration/i.test(text)
      },
    },
    { pattern: /短期/i, text: '短期' },
  ]

  for (const { pattern, text: dt, match, allow } of durationPatterns) {
    const result = text.match(pattern)
    if (!result) continue
    if (allow && !allow(result)) continue
    if (match) duration_text = match(result)
    else if (dt) duration_text = dt
    if (duration_text) break
  }
  
  // 5. 识别年限要求
  let years_text = ''
  const yearsPatterns: Array<{ pattern: RegExp; match: (m: RegExpMatchArray) => string; allow?: (m: RegExpMatchArray) => boolean }> = [
    // 3年经验 / 3 年工作经验：明确经验表达，优先级最高（不受“周期/合同”等词影响）
    {
      pattern: /(\d{1,2})\s*年\s*(?:以上|及以上|\+)?\s*(?:经验|工作经验|年经验|exp)/i,
      match: (m) => {
        const years = parseInt(m[1] || '0')
        if (!Number.isFinite(years) || years <= 0) return ''
        if (years >= 8) return `${years}年以上`
        return `${years}年`
      },
    },
    // 8+经验 / 8＋经验
    {
      pattern: /(\d{1,2})\s*[\+＋]\s*(?:年)?\s*(?:经验|工作经验|exp)/i,
      match: (m) => `${m[1]}年以上`,
    },
    {
      pattern: /(\d+)\s*年以上|(\d+)\s*年\+|(\d+)\s*years?\s*\+/i,
      match: (m) => `${m[1] || m[2] || m[3]}年以上`,
    },
    {
      pattern: /(\d+)\s*-\s*(\d+)\s*年|(\d+)\s*-\s*(\d+)\s*years?/i,
      match: (m) => `${m[1] || m[3]}-${m[2] || m[4]}年`,
    },
    // 通用 X年：需要排除“周期/合同/项目/工期”等语境，避免把周期识别成经验
    {
      pattern: /(\d+)\s*年|(\d+)\s*years?/i,
      match: (m) => {
        const years = parseInt(m[1] || m[2])
        if (years >= 8) return `${years}年以上`
        if (years >= 5) return `5-${years}年`
        if (years >= 3) return `3-${years}年`
        return `${years}年`
      },
      allow: (m) => {
        const raw = String(m[0] || '')
        const idx = text.indexOf(raw)
        const left = Math.max(0, idx - 12)
        const right = Math.min(text.length, idx + raw.length + 12)
        const ctx = text.slice(left, right)
        // 周期/合同等不视为经验年限
        if (/周期|工期|合同|项目|时长|duration/i.test(ctx)) return false
        return true
      },
    },
    // 8+（无“年”）但紧跟经验关键词的情况已在第一条覆盖；这里保留兜底
    {
      pattern: /(\d+)\s*[\+＋]/i,
      match: (m) => `${m[1]}年以上`,
      allow: (m) => {
        const raw = String(m[0] || '')
        const idx = text.indexOf(raw)
        const left = Math.max(0, idx - 6)
        const right = Math.min(text.length, idx + raw.length + 12)
        const ctx = text.slice(left, right)
        return /经验|工作经验|年限|exp/i.test(ctx)
      },
    },
  ]

  for (const { pattern, match, allow } of yearsPatterns) {
    const result = text.match(pattern)
    if (!result) continue
    if (allow && !allow(result)) continue
    years_text = match(result)
    if (years_text) break
  }
  
  // 6. 识别语言要求
  let language = ''
  if (/日语|japanese|jp|日文/i.test(text)) {
    if (/流利|fluent|精通/i.test(text)) {
      language = '日语流利'
    } else {
      language = '英语简单沟通' // 默认
    }
  } else if (/英语|english|en|英文/i.test(text)) {
    if (/流利|fluent|精通|native/i.test(text)) {
      language = '英语流利'
    } else if (/简单|basic|简单沟通/i.test(text)) {
      language = '英语简单沟通'
    } else {
      language = '英语流利' // 默认
    }
  }
  
  // 7. 识别人天价格
  let daily_rate = ''
  const dailyRatePattern0 = /\brate\s*(\d{3,5})\s*(?:(?:[-—~～到至])\s*(\d{3,5}))?/i
  const dailyRatePattern1 = /人天[：:：\s]*(\d+(?:\.\d+)?)\s*(?:k|K|千)?/i
  const dailyRatePattern2 = /(\d+(?:\.\d+)?)\s*k\s*[=＝]\s*(\d+)/i
  const dailyRatePattern3 = /(\d+(?:\.\d+)?)\s*(?:k|K|千)?\s*(?:元)?\s*[\/／]\s*(?:天|日)/i
  const dailyRatePattern4 = /(\d+(?:\.\d+)?)\s*(?:k|K|千)?\s*(?:元)?\s*[\/／]\s*人天/i
  
  let match = text.match(dailyRatePattern0)
  if (match) {
    daily_rate = match[1]
  } else {
    match = text.match(dailyRatePattern1)
    if (match) {
      let rate = parseFloat(match[1])
      // 如果后面有K，乘以1000
      if (/k|K|千/i.test(match[0])) {
        rate = rate * 1000
      }
      daily_rate = Math.round(rate).toString()
    } else {
      match = text.match(dailyRatePattern2)
      if (match) {
        // 使用等号后面的值
        daily_rate = match[2]
      } else {
        match = text.match(dailyRatePattern3)
        if (match) {
          let rate = parseFloat(match[1])
          if (/k|K|千/i.test(match[0])) {
            rate = rate * 1000
          }
          daily_rate = Math.round(rate).toString()
        } else {
          match = text.match(dailyRatePattern4)
          if (match) {
            let rate = parseFloat(match[1])
            if (/k|K|千/i.test(match[0])) {
              rate = rate * 1000
            }
            daily_rate = Math.round(rate).toString()
          }
        }
      }
    }
  }
  
  return {
    module_codes,
    city,
    is_remote,
    duration_text,
    years_text,
    language,
    daily_rate,
  }
}

/**
 * 从需求原文中提取信息提供者名称（如果有）
 */
export function extractProviderName(rawText: string): string {
  // 尝试从文本中提取可能的提供者信息
  // 例如：来自XXX、提供者：XXX等
  const patterns = [
    /来自[：:]\s*([^\n]+)/i,
    /提供者[：:]\s*([^\n]+)/i,
    /来源[：:]\s*([^\n]+)/i,
  ]
  
  for (const pattern of patterns) {
    const match = rawText.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  return ''
}

/**
 * 拆分多行需求文本为多个独立需求
 * 参考后端拆分方式：按换行符拆分，过滤空行和无效行
 */
export function splitMultiLineDemands(rawText: string): string[] {
  if (!rawText || !rawText.trim()) {
    return []
  }
  
  // 按换行符拆分
  const lines = rawText.split(/\r?\n/)
  
  // 过滤和清理每一行
  const demands: string[] = []
  
  for (let line of lines) {
    line = line.trim()
    
    // 跳过空行
    if (!line) {
      continue
    }
    
    // 跳过明显的非需求行（如标题、说明等）
    if (
      /^建议包含|^提示|^说明|^注意|^---|^===|^###|^##|^#/.test(line) ||
      line.length < 10 // 太短的行可能是无效的
    ) {
      continue
    }
    
    // 检查是否包含需求关键词（模块、城市、年限等）
    const hasDemandKeywords = 
      /【.*】|fico|mm|sd|pp|hr|abap|bw|bi|北京|上海|深圳|远程|年|月|经验|项目/i.test(line)
    
    if (hasDemandKeywords) {
      demands.push(line)
    }
  }
  
  // 如果拆分后只有1条，返回原文本（不拆分）
  if (demands.length <= 1) {
    return [rawText.trim()]
  }
  
  return demands
}

/**
 * 判断文本是否包含多行需求
 */
export function hasMultipleDemands(rawText: string): boolean {
  if (!rawText) {
    return false
  }
  
  const lines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0)
  
  // 如果只有1行，不是多行需求
  if (lines.length <= 1) {
    return false
  }
  
  // 检查是否有至少2行包含需求关键词
  let demandLineCount = 0
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.length < 10) {
      continue
    }
    
    const hasDemandKeywords = 
      /【.*】|fico|mm|sd|pp|hr|abap|bw|bi|北京|上海|深圳|远程|年|月|经验|项目/i.test(trimmed)
    
    if (hasDemandKeywords) {
      demandLineCount++
    }
  }
  
  return demandLineCount >= 2
}

