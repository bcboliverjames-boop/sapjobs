import { app, ensureLogin } from './cloudbase'
import { parseDemandText } from './demand-parser'

export type SapDemandRecord = {
  id?: string
  raw_text: string
  module_labels: string[]
  module_codes: string[]
  city: string
  duration_text: string
  years_text: string
  language: string
  daily_rate?: string // 人天价格
  provider_name: string
  provider_user_id?: string // 信息提供者的用户ID，用于获取联系方式
  createdAt?: Date | string // 创建时间
  updatedAt?: Date | string // 更新时间
}

// 从本地示例迁移出来，作为初始化/本地兜底数据
export const SAMPLE_DEMANDS: SapDemandRecord[] = [
  {
    raw_text:
      '[福]【BW开发】广州，医药行业，长期周期。3-7年经验，free，如果懂sac可以入职。尽快到位',
    module_labels: ['BW', 'SAC'],
    module_codes: ['BW'],
    city: '广州',
    duration_text: '长期',
    years_text: '3-7年经验',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '[福]【WM顾问】新材料项目，周期10个月，1-5需要做WM顾问，6-10月做MM顾问，前期大概2周左右需要出差新加坡（免签），提供差旅食宿。要求7年以上经验，要求熟悉WM、MM模块，英语口语流利，1月进场，紧急。',
    module_labels: ['WM', 'MM'],
    module_codes: ['WM', 'MM'],
    city: '海外',
    duration_text: '10个月',
    years_text: '7年以上经验',
    language: '英语流利',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '[福]【高级前端】厦门，6年以上前端开发经验，有制造业经验，面试通过后能尽快到位，紧急',
    module_labels: ['前端'],
    module_codes: ['OTHER'],
    city: '厦门',
    duration_text: '',
    years_text: '6年以上经验',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '[福]【FICO】徐州，6年经验以上，周期3个月，做过管报业务，尽快到位，入职/free',
    module_labels: ['FICO'],
    module_codes: ['FICO'],
    city: '徐州',
    duration_text: '3个月',
    years_text: '6年以上经验',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '[福]【FICO】兰州，6年经验以上，周期6个月，做过装备制造业优先，1月初到位，紧急，入职/free',
    module_labels: ['FICO'],
    module_codes: ['FICO'],
    city: '兰州',
    duration_text: '6个月',
    years_text: '6年以上经验',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '[福]【FICO】【PS】【MM】北京，5年经验以上，周期6个月以上，做过能源或化工行业，学信网本科学历，1月初到位，尽快，free',
    module_labels: ['FICO', 'PS', 'MM'],
    module_codes: ['FICO', 'PS', 'MM'],
    city: '北京',
    duration_text: '6个月以上',
    years_text: '5年以上经验',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text: '🌴【远程兼职：SAP Concur/SF】中级，周期1个月',
    module_labels: ['Concur', 'SF'],
    module_codes: ['OTHER'],
    city: '远程',
    duration_text: '1个月',
    years_text: '中级',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text: '🌴【厦门：PP】5年经验，周期2个月左右',
    module_labels: ['PP'],
    module_codes: ['PP'],
    city: '厦门',
    duration_text: '2个月左右',
    years_text: '5年经验',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text: '🌴【上海/欧洲：FICO】资深，英语流利，周期4个月',
    module_labels: ['FICO'],
    module_codes: ['FICO'],
    city: '海外',
    duration_text: '4个月',
    years_text: '资深',
    language: '英语流利',
    provider_name: '示例数据',
  },
  {
    raw_text: '🌴【大连入职：MM】5年经验',
    module_labels: ['MM'],
    module_codes: ['MM'],
    city: '大连',
    duration_text: '',
    years_text: '5年经验',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text: '🌴【大连入职：ABAP】初中级',
    module_labels: ['ABAP'],
    module_codes: ['ABAP'],
    city: '大连',
    duration_text: '',
    years_text: '初中级',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '🌴【大连入职：各个业务模块顾问】1年以上经验，有云产品经验',
    module_labels: ['多模块'],
    module_codes: ['OTHER'],
    city: '大连',
    duration_text: '',
    years_text: '1年以上经验',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '🌴【杭州：FICO/SD/MM/ABAP】5年经验，英语简单沟通，周期半年以上',
    module_labels: ['FICO', 'SD', 'MM', 'ABAP'],
    module_codes: ['FICO', 'SD', 'MM', 'ABAP'],
    city: '杭州',
    duration_text: '半年以上',
    years_text: '5年经验',
    language: '英语简单沟通',
    provider_name: '示例数据',
  },
  {
    raw_text: '[红包]#远程兼职：SAPConcur/SF 中级，周期1个月',
    module_labels: ['Concur', 'SF'],
    module_codes: ['OTHER'],
    city: '远程',
    duration_text: '1个月',
    years_text: '中级',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text: '[红包]#厦门：PP 5年经验，周期2个月左右',
    module_labels: ['PP'],
    module_codes: ['PP'],
    city: '厦门',
    duration_text: '2个月左右',
    years_text: '5年经验',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text: '[红包]#上海+海外出差：FICO 资深，周期4个月，英语流利',
    module_labels: ['FICO'],
    module_codes: ['FICO'],
    city: '上海',
    duration_text: '4个月',
    years_text: '资深',
    language: '英语流利',
    provider_name: '示例数据',
  },
  {
    raw_text: '[红包]#远程：WM&EWM 资深，日语流利，周期2个月左右',
    module_labels: ['WM', 'EWM'],
    module_codes: ['WM', 'EWM'],
    city: '远程',
    duration_text: '2个月左右',
    years_text: '资深',
    language: '日语流利',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【Group reporting】长沙，汽配行业，财务子模块，英语 GR+PA/PM方向，',
    module_labels: ['Group Reporting'],
    module_codes: ['OTHER'],
    city: '长沙',
    duration_text: '',
    years_text: '',
    language: '英语',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【FICO*10】【MM*8】【PS*3】【PS*2】【HCM】【GRC】北京10年+英语，global项目组，可能出差海外。周期1年+',
    module_labels: ['FICO', 'MM', 'PS', 'HCM', 'GRC'],
    module_codes: ['FICO', 'MM', 'PS', 'OTHER'],
    city: '北京',
    duration_text: '1年+',
    years_text: '10年以上',
    language: '英语',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【CO】【SD】上海 长宁，7年+英语，外资咨询公司入职，年薪40万以内。',
    module_labels: ['CO', 'SD'],
    module_codes: ['CO', 'SD'],
    city: '上海',
    duration_text: '',
    years_text: '7年以上',
    language: '英语',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【SAP PMO】【SAP Data migration consultant】上海零售 英文流利 周期到明年7月份',
    module_labels: ['PMO', 'Data Migration'],
    module_codes: ['OTHER'],
    city: '上海',
    duration_text: '到明年7月',
    years_text: '',
    language: '英文流利',
    provider_name: '示例数据',
  },
  {
    raw_text: '【EWM】南通 5年+经验 英文流利 周期半年',
    module_labels: ['EWM'],
    module_codes: ['EWM'],
    city: '南通',
    duration_text: '半年',
    years_text: '5年以上',
    language: '英文流利',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【SAC】南通 3-5年SAC经验 至少2个以上SAC项目实施经验 英语流利 周期半年以上',
    module_labels: ['SAC'],
    module_codes: ['SAC'],
    city: '南通',
    duration_text: '半年以上',
    years_text: '3-5年',
    language: '英语流利',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【MM会SD】上海金桥 3-5年经验 有汽车行业经验优先 长期运维项目',
    module_labels: ['MM', 'SD'],
    module_codes: ['MM', 'SD'],
    city: '上海',
    duration_text: '长期',
    years_text: '3-5年',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text: '【HR】珠海 偏薪酬 6-7年经验 周期2-3个月',
    module_labels: ['HR'],
    module_codes: ['HR'],
    city: '珠海',
    duration_text: '2-3个月',
    years_text: '6-7年',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【Group reporting】 长沙汽配英文流利 GR+PA/PM方向 周期到4月',
    module_labels: ['Group Reporting'],
    module_codes: ['OTHER'],
    city: '长沙',
    duration_text: '到4月',
    years_text: '',
    language: '英文流利',
    provider_name: '示例数据',
  },
  {
    raw_text: '【FICO】泸州 有快消品行业优先 8年左右经验 周期半年',
    module_labels: ['FICO'],
    module_codes: ['FICO'],
    city: '泸州',
    duration_text: '半年',
    years_text: '8年左右',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【BI】鄂尔多斯 熟悉帆软和BW有美工基础 尽快到位 周期1-2个月',
    module_labels: ['BI', 'BW'],
    module_codes: ['BI'],
    city: '鄂尔多斯',
    duration_text: '1-2个月',
    years_text: '',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【FICO】北京或者其他地点可以选择 3-5年以上经验 有做META-ERP实施经验优先 长期',
    module_labels: ['FICO'],
    module_codes: ['FICO'],
    city: '北京',
    duration_text: '长期',
    years_text: '3-5年以上',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【FICO】江浙沪制造业 10年以上经验 负责财务总体规化与实施落地 周期到3月底',
    module_labels: ['FICO'],
    module_codes: ['FICO'],
    city: '江浙沪',
    duration_text: '到3月底',
    years_text: '10年以上',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text: '【FICO】芜湖汽车行业 英文沟通 长期项目',
    module_labels: ['FICO'],
    module_codes: ['FICO'],
    city: '芜湖',
    duration_text: '长期',
    years_text: '',
    language: '英文沟通',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【FICO】【MM】【PS】【HR】【GRC】英文可以作为工作语言 伊拉克/乍得/土库曼斯坦 海外多地可以选择 长期项目',
    module_labels: ['FICO', 'MM', 'PS', 'HR', 'GRC'],
    module_codes: ['FICO', 'MM', 'PS', 'HR', 'OTHER'],
    city: '海外',
    duration_text: '长期',
    years_text: '',
    language: '英文工作语言',
    provider_name: '示例数据',
  },
  {
    raw_text:
      '【MM】南京 3-5年经验 学历985/211以上学历 计算机背景 长期项目',
    module_labels: ['MM'],
    module_codes: ['MM'],
    city: '南京',
    duration_text: '长期',
    years_text: '3-5年',
    language: '',
    provider_name: '示例数据',
  },
  {
    raw_text: '【SD】【PP】【FICO】华南制造业 5年以上经验 周期2-3个月',
    module_labels: ['SD', 'PP', 'FICO'],
    module_codes: ['SD', 'PP', 'FICO'],
    city: '华南',
    duration_text: '2-3个月',
    years_text: '5年以上',
    language: '',
    provider_name: '示例数据',
  },
]

const COLLECTION_NAME = 'sap_demands_raw'

// 将示例数据批量写入云数据库（第一次使用时）
export async function seedSampleDemandsToCloud() {
  await ensureLogin()
  const db = app.database()
  const coll = db.collection(COLLECTION_NAME)

  // 先看是否已经有数据，避免重复灌入
  const existed = await coll.limit(1).get()
  if (existed.data && existed.data.length > 0) {
    return
  }

  // 简单串行插入几条示例数据（数量不多可以接受）
  for (const item of SAMPLE_DEMANDS) {
    await coll.add({
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
      source: 'sample',
    })
  }
}

// 从云数据库获取需求列表
export async function fetchSapDemandsFromCloud(): Promise<SapDemandRecord[]> {
  await ensureLogin()
  const db = app.database()
  const coll = db.collection(COLLECTION_NAME)
  const res = await coll.orderBy('createdAt', 'desc').limit(200).get()

  return (res.data || []).map((doc: any) => ({
    id: doc._id,
    raw_text: doc.raw_text,
    module_labels: doc.module_labels || [],
    module_codes: doc.module_codes || [],
    city: doc.city || '',
    duration_text: doc.duration_text || '',
    years_text: doc.years_text || '',
    language: doc.language || '',
    daily_rate: doc.daily_rate, // 人天价格
    provider_name: doc.provider_name || '未知',
    provider_user_id: doc.provider_user_id, // 添加发布者ID
    createdAt: doc.createdAt, // 添加创建时间
    updatedAt: doc.updatedAt, // 添加更新时间
  }))
}

// 根据 id 获取单条需求记录
export async function fetchSapDemandById(id: string): Promise<SapDemandRecord | null> {
  if (!id) return null
  await ensureLogin()
  const db = app.database()
  const coll = db.collection(COLLECTION_NAME)
  const res = await coll.doc(id).get()
  const doc = res.data && res.data[0]
  if (!doc) return null
  return {
    id: doc._id,
    raw_text: doc.raw_text,
    module_labels: doc.module_labels || [],
    module_codes: doc.module_codes || [],
    city: doc.city || '',
    duration_text: doc.duration_text || '',
    years_text: doc.years_text || '',
    language: doc.language || '',
    daily_rate: doc.daily_rate, // 人天价格
    provider_name: doc.provider_name || '未知',
    provider_user_id: doc.provider_user_id,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  }
}

/**
 * 使用新的识别规则刷新所有需求的标签
 * 重新解析每条需求的 raw_text，更新模块、城市、周期、年限、语言、人天价格等信息
 */
export async function refreshAllDemandsTags(): Promise<{
  success: number
  failed: number
  errors: string[]
}> {
  await ensureLogin()
  const db = app.database()
  const coll = db.collection(COLLECTION_NAME)
  
  let success = 0
  let failed = 0
  const errors: string[] = []
  
  try {
    // 获取所有需求（分批处理，避免一次性加载太多）
    let skip = 0
    const batchSize = 50
    let hasMore = true
    
    while (hasMore) {
      const res = await coll
        .orderBy('createdAt', 'desc')
        .skip(skip)
        .limit(batchSize)
        .get()
      
      const demands = res.data || []
      
      if (demands.length === 0) {
        hasMore = false
        break
      }
      
      // 批量更新
      for (const doc of demands) {
        try {
          const rawText = doc.raw_text || ''
          if (!rawText.trim()) {
            continue
          }
          
          // 使用新的解析规则重新解析
          const parsed = parseDemandText(rawText)
          
          // 生成模块标签
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
          
          const moduleLabels = parsed.module_codes.map(code => {
            const module = availableModules.find(m => m.code === code)
            return module ? module.name : code
          })
          
          // 确保至少有一个模块
          const moduleCodes = parsed.module_codes.length > 0 ? parsed.module_codes : ['OTHER']
          
          // 更新数据库
          await coll.doc(doc._id).update({
            module_codes: moduleCodes,
            module_labels: moduleLabels,
            city: parsed.city || '未指定',
            duration_text: parsed.duration_text || '',
            years_text: parsed.years_text || '',
            language: parsed.language || '',
            daily_rate: parsed.daily_rate || '',
            is_remote: parsed.is_remote,
            updatedAt: new Date(), // 添加更新时间标记
          })
          
          success++
        } catch (e: any) {
          failed++
          errors.push(`需求 ${doc._id}: ${e?.message || '更新失败'}`)
          console.error(`刷新需求 ${doc._id} 失败:`, e)
        }
      }
      
      skip += batchSize
      
      // 如果这一批少于 batchSize，说明已经处理完了
      if (demands.length < batchSize) {
        hasMore = false
      }
    }
    
    return { success, failed, errors }
  } catch (e: any) {
    console.error('批量刷新需求标签失败:', e)
    throw e
  }
}

/**
 * 刷新单条需求的标签
 */
export async function refreshDemandTags(demandId: string): Promise<boolean> {
  if (!demandId) return false
  
  try {
    await ensureLogin()
    const db = app.database()
    const coll = db.collection(COLLECTION_NAME)
    
    const res = await coll.doc(demandId).get()
    const doc = res.data && res.data[0]
    
    if (!doc || !doc.raw_text) {
      return false
    }
    
    // 使用新的解析规则重新解析
    const parsed = parseDemandText(doc.raw_text)
    
    // 生成模块标签
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
    
    const moduleLabels = parsed.module_codes.map(code => {
      const module = availableModules.find(m => m.code === code)
      return module ? module.name : code
    })
    
    // 确保至少有一个模块
    const moduleCodes = parsed.module_codes.length > 0 ? parsed.module_codes : ['OTHER']
    
    // 更新数据库
    await coll.doc(demandId).update({
      module_codes: moduleCodes,
      module_labels: moduleLabels,
      city: parsed.city || '未指定',
      duration_text: parsed.duration_text || '',
      years_text: parsed.years_text || '',
      language: parsed.language || '',
      daily_rate: parsed.daily_rate || '',
      is_remote: parsed.is_remote,
      updatedAt: new Date(),
    })
    
    return true
  } catch (e) {
    console.error('刷新需求标签失败:', e)
    return false
  }
}



