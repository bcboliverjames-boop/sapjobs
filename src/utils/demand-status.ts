import { app, ensureLogin, requireNonGuest } from './cloudbase'

/**
 * 标记需求状态
 * @param demandId 需求ID
 * @param status 状态：'applied' | 'interviewed' | 'onboarded' | 'closed'
 * @param nickname 用户昵称
 */
export async function markDemandStatus(
  demandId: string,
  status: 'applied' | 'interviewed' | 'onboarded' | 'closed',
  nickname: string
): Promise<void> {
  await requireNonGuest()
  const db = app.database()
  const user = await getCurrentUser()
  
  // 检查是否已标记
  const existing = await db
    .collection('sap_demand_status')
    .where({
      demand_id: demandId,
      user_id: user.uid,
      status: status,
    })
    .get()
  
  if (existing.data && existing.data.length > 0) {
    throw new Error('您已标记过此状态')
  }
  
  // 保存状态标记
  const dataToAdd = {
    demand_id: demandId,
    user_id: user.uid,
    status: status,
    nickname: nickname,
    createdAt: new Date(),
  }
  
  console.log('准备保存状态标记:', dataToAdd)
  
  const result = await db.collection('sap_demand_status').add(dataToAdd)
  
  console.log('状态标记保存成功，返回结果:', result)
  
  // 等待一小段时间，确保数据已写入
  await new Promise(resolve => setTimeout(resolve, 300))
}

/**
 * 取消状态标记（可选功能）
 */
export async function unmarkDemandStatus(
  demandId: string,
  status: 'applied' | 'interviewed' | 'onboarded' | 'closed',
  userId: string
): Promise<void> {
  await requireNonGuest()
  const db = app.database()
  
  const existing = await db
    .collection('sap_demand_status')
    .where({
      demand_id: demandId,
      user_id: userId,
      status: status,
    })
    .get()
  
  if (existing.data && existing.data.length > 0) {
    for (const doc of existing.data) {
      await db.collection('sap_demand_status').doc(doc._id).remove()
    }
  }
}

/**
 * 获取需求各状态的标记数量
 */
export async function getDemandStatusCounts(
  demandId: string
): Promise<{
  applied: number
  interviewed: number
  onboarded: number
  closed: number
}> {
  await ensureLogin()
  const db = app.database()
  
  console.log('查询状态数量，需求ID:', demandId)
  
  const res = await db
    .collection('sap_demand_status')
    .where({
      demand_id: demandId,
    })
    .get()
  
  console.log('查询结果:', res)
  console.log('查询到的数据:', res.data)
  
  const counts = {
    applied: 0,
    interviewed: 0,
    onboarded: 0,
    closed: 0,
  }
  
  if (res.data) {
    for (const doc of res.data) {
      const status = doc.status as keyof typeof counts
      console.log('处理状态:', status, '文档:', doc)
      if (status in counts) {
        counts[status]++
      }
    }
  }
  
  console.log('最终统计数量:', counts)
  
  return counts
}

/**
 * 获取指定状态的最新标记昵称（按时间倒序取最新一条）
 */
export async function getLatestStatusNicknames(
  demandId: string,
  statuses: Array<'onboarded' | 'closed'>
): Promise<Record<'onboarded' | 'closed', string | undefined>> {
  await ensureLogin()
  const db = app.database()
  const _ = db.command
  
  const res = await db
    .collection('sap_demand_status')
    .where({
      demand_id: demandId,
      status: _.in(statuses),
    })
    .orderBy('createdAt', 'desc')
    .get()
  
  const result: Record<'onboarded' | 'closed', string | undefined> = {
    onboarded: undefined,
    closed: undefined,
  }
  
  if (res.data) {
    for (const doc of res.data) {
      const status = doc.status as 'onboarded' | 'closed'
      if (statuses.includes(status) && !result[status]) {
        result[status] = doc.nickname
      }
    }
  }
  
  return result
}

/**
 * 获取当前用户已标记的状态列表
 */
export async function getUserDemandStatuses(
  demandId: string,
  userId: string
): Promise<string[]> {
  await ensureLogin()
  const db = app.database()
  
  const res = await db
    .collection('sap_demand_status')
    .where({
      demand_id: demandId,
      user_id: userId,
    })
    .get()
  
  if (!res.data || res.data.length === 0) {
    return []
  }
  
  return res.data.map((doc: any) => doc.status)
}

/**
 * 标记需求评价（靠谱/不靠谱）
 */
export async function markDemandReliability(
  demandId: string,
  reliable: boolean,
  nickname: string
): Promise<void> {
  await requireNonGuest()
  const db = app.database()
  const user = await getCurrentUser()
  
  // 检查是否已评价
  const existing = await db
    .collection('sap_demand_reliability')
    .where({
      demand_id: demandId,
      user_id: user.uid,
    })
    .get()
  
  // 如果已评价，先删除旧评价
  if (existing.data && existing.data.length > 0) {
    for (const doc of existing.data) {
      await db.collection('sap_demand_reliability').doc(doc._id).remove()
    }
  }
  
  // 保存新评价
  const dataToAdd = {
    demand_id: demandId,
    user_id: user.uid,
    reliable: reliable,
    nickname: nickname,
    createdAt: new Date(),
  }
  
  console.log('准备保存评价:', dataToAdd)
  
  const result = await db.collection('sap_demand_reliability').add(dataToAdd)
  
  console.log('评价保存成功，返回结果:', result)
  
  // 等待一小段时间，确保数据已写入
  await new Promise(resolve => setTimeout(resolve, 300))
}

/**
 * 取消需求评价（如果已有相同评价则删除）
 */
export async function unmarkDemandReliability(
  demandId: string,
  userId: string
): Promise<void> {
  await requireNonGuest()
  const db = app.database()
  
  const existing = await db
    .collection('sap_demand_reliability')
    .where({
      demand_id: demandId,
      user_id: userId,
    })
    .get()
  
  if (existing.data && existing.data.length > 0) {
    for (const doc of existing.data) {
      await db.collection('sap_demand_reliability').doc(doc._id).remove()
    }
  }
}

/**
 * 获取需求评价数量
 */
export async function getDemandReliabilityCounts(
  demandId: string
): Promise<{
  reliable: number
  unreliable: number
}> {
  await ensureLogin()
  const db = app.database()
  
  console.log('查询评价数量，需求ID:', demandId)
  
  const res = await db
    .collection('sap_demand_reliability')
    .where({
      demand_id: demandId,
    })
    .get()
  
  console.log('查询结果:', res)
  console.log('查询到的数据:', res.data)
  
  const counts = {
    reliable: 0,
    unreliable: 0,
  }
  
  if (res.data) {
    for (const doc of res.data) {
      console.log('处理评价:', doc.reliable, '文档:', doc)
      if (doc.reliable === true) {
        counts.reliable++
      } else if (doc.reliable === false) {
        counts.unreliable++
      }
    }
  }
  
  console.log('最终统计数量:', counts)
  
  return counts
}

/**
 * 获取当前用户的评价（如果有）
 */
export async function getUserDemandReliability(
  demandId: string,
  userId: string
): Promise<boolean | null> {
  await ensureLogin()
  const db = app.database()
  
  const res = await db
    .collection('sap_demand_reliability')
    .where({
      demand_id: demandId,
      user_id: userId,
    })
    .get()
  
  if (!res.data || res.data.length === 0) {
    return null
  }
  
  return res.data[0].reliable === true ? true : res.data[0].reliable === false ? false : null
}

/**
 * 获取当前用户（内部辅助函数）
 */
async function getCurrentUser() {
  const state = await requireNonGuest()
  if (!state || !state.user) {
    throw new Error('当前未登录')
  }
  return state.user as { uid: string }
}

