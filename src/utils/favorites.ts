/**
 * 收藏功能工具函数
 */

import { app, ensureLogin } from './cloudbase'
import { getOrCreateUserProfile } from './user'

/**
 * 收藏需求
 */
export async function addFavorite(demandId: string): Promise<void> {
  await ensureLogin()
  const user = await getOrCreateUserProfile()
  const db = app.database()
  
  // 检查是否已收藏
  const existing = await db
    .collection('sap_demand_favorites')
    .where({
      user_id: user.uid,
      demand_id: demandId,
    })
    .get()
  
  if (existing.data && existing.data.length > 0) {
    throw new Error('已经收藏过了')
  }
  
  // 添加收藏
  await db.collection('sap_demand_favorites').add({
    user_id: user.uid,
    demand_id: demandId,
    createdAt: new Date(),
  })
}

/**
 * 取消收藏
 */
export async function removeFavorite(demandId: string): Promise<void> {
  await ensureLogin()
  const user = await getOrCreateUserProfile()
  const db = app.database()
  
  // 查找收藏记录
  const existing = await db
    .collection('sap_demand_favorites')
    .where({
      user_id: user.uid,
      demand_id: demandId,
    })
    .get()
  
  if (!existing.data || existing.data.length === 0) {
    throw new Error('未收藏该需求')
  }
  
  // 删除收藏
  for (const doc of existing.data) {
    await db.collection('sap_demand_favorites').doc(doc._id).remove()
  }
}

/**
 * 检查是否已收藏
 */
export async function isFavorite(demandId: string): Promise<boolean> {
  try {
    await ensureLogin()
    const user = await getOrCreateUserProfile()
    const db = app.database()
    
    const existing = await db
      .collection('sap_demand_favorites')
      .where({
        user_id: user.uid,
        demand_id: demandId,
      })
      .get()
    
    return existing.data && existing.data.length > 0
  } catch (e) {
    console.error('Failed to check favorite status:', e)
    return false
  }
}

/**
 * 批量检查收藏状态
 */
export async function checkFavoritesStatus(demandIds: string[]): Promise<Set<string>> {
  try {
    await ensureLogin()
    const user = await getOrCreateUserProfile()
    const db = app.database()
    
    if (demandIds.length === 0) {
      return new Set()
    }
    
    const res = await db
      .collection('sap_demand_favorites')
      .where({
        user_id: user.uid,
        demand_id: db.command.in(demandIds),
      })
      .get()
    
    const favoriteSet = new Set<string>()
    ;(res.data || []).forEach((doc: any) => {
      if (doc.demand_id) {
        favoriteSet.add(doc.demand_id)
      }
    })
    
    return favoriteSet
  } catch (e) {
    console.error('Failed to batch check favorite status:', e)
    return new Set()
  }
}





























