/**
 * 私信功能工具函数
 */

import { app, requireNonGuest } from './cloudbase'
import { getOrCreateUserProfile, getProfilesByIds } from './user'

/**
 * 发送私信
 */
export async function sendMessage(
  toUserId: string,
  content: string,
  demandId?: string
): Promise<void> {
  await requireNonGuest()
  const user = await getOrCreateUserProfile()
  const db = app.database()
  
  await db.collection('messages').add({
    from_user_id: user.uid,
    to_user_id: toUserId,
    content: content.trim(),
    demand_id: demandId || '',
    is_read: false,
    createdAt: new Date(),
  })
}

/**
 * 获取对话列表（当前用户的所有对话）
 */
export async function getConversations(): Promise<any[]> {
  await requireNonGuest()
  const user = await getOrCreateUserProfile()
  const db = app.database()
  
  // 获取所有发送和接收的消息
  const [sent, received] = await Promise.all([
    db
      .collection('messages')
      .where({
        from_user_id: user.uid,
      })
      .orderBy('createdAt', 'desc')
      .get(),
    db
      .collection('messages')
      .where({
        to_user_id: user.uid,
      })
      .orderBy('createdAt', 'desc')
      .get(),
  ])
  
  // 构建对话映射（按对方用户ID分组）
  const conversationMap = new Map<string, any>()
  
  // 处理发送的消息
  ;(sent.data || []).forEach((msg: any) => {
    const otherUserId = msg.to_user_id
    if (!conversationMap.has(otherUserId)) {
      conversationMap.set(otherUserId, {
        other_user_id: otherUserId,
        last_message: msg,
        unread_count: 0,
      })
    } else {
      const conv = conversationMap.get(otherUserId)
      if (new Date(msg.createdAt) > new Date(conv.last_message.createdAt)) {
        conv.last_message = msg
      }
    }
  })
  
  // 处理接收的消息
  ;(received.data || []).forEach((msg: any) => {
    const otherUserId = msg.from_user_id
    if (!conversationMap.has(otherUserId)) {
      conversationMap.set(otherUserId, {
        other_user_id: otherUserId,
        last_message: msg,
        unread_count: msg.is_read ? 0 : 1,
      })
    } else {
      const conv = conversationMap.get(otherUserId)
      if (new Date(msg.createdAt) > new Date(conv.last_message.createdAt)) {
        conv.last_message = msg
      }
      if (!msg.is_read) {
        conv.unread_count += 1
      }
    }
  })
  
  // 获取对方用户信息
  const conversations = Array.from(conversationMap.values())
  const userIds = conversations.map(c => c.other_user_id)
  
  if (userIds.length > 0) {
    const profilesById = await getProfilesByIds(userIds)

    conversations.forEach(conv => {
      const pid = String(conv.other_user_id || '').trim()
      conv.other_user = (pid && profilesById[pid]) || {
        nickname: '未知用户',
        uid: conv.other_user_id,
      }
    })
  }
  
  // 按最后消息时间排序
  conversations.sort((a, b) => {
    const timeA = new Date(a.last_message.createdAt).getTime()
    const timeB = new Date(b.last_message.createdAt).getTime()
    return timeB - timeA
  })
  
  return conversations
}

/**
 * 获取与指定用户的对话消息
 */
export async function getMessagesWithUser(otherUserId: string): Promise<any[]> {
  await requireNonGuest()
  const user = await getOrCreateUserProfile()
  const db = app.database()
  
  // 获取所有相关消息
  const [sent, received] = await Promise.all([
    db
      .collection('messages')
      .where({
        from_user_id: user.uid,
        to_user_id: otherUserId,
      })
      .orderBy('createdAt', 'asc')
      .get(),
    db
      .collection('messages')
      .where({
        from_user_id: otherUserId,
        to_user_id: user.uid,
      })
      .orderBy('createdAt', 'asc')
      .get(),
  ])
  
  // 合并并排序
  const allMessages = [
    ...(sent.data || []),
    ...(received.data || []),
  ].sort((a, b) => {
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  })
  
  // 标记为已读
  const unreadIds = (received.data || [])
    .filter((msg: any) => !msg.is_read)
    .map((msg: any) => msg._id)
  
  if (unreadIds.length > 0) {
    await Promise.all(
      unreadIds.map((id: string) =>
        db.collection('messages').doc(id).update({
          is_read: true,
        })
      )
    )
  }
  
  return allMessages
}

/**
 * 获取未读消息数量
 */
export async function getUnreadCount(): Promise<number> {
  try {
    await requireNonGuest()
    const user = await getOrCreateUserProfile()
    const db = app.database()
    
    const res = await db
      .collection('messages')
      .where({
        to_user_id: user.uid,
        is_read: false,
      })
      .count()
    
    return res.total || 0
  } catch (e) {
    console.error('获取未读消息数量失败:', e)
    return 0
  }
}





























