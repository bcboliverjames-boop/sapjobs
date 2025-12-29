import { app, ensureLogin } from './cloudbase'
import { ugcReplyAdd } from './ugc'

export type CommentReply = {
  _id?: string
  comment_id: string
  demand_id: string
  content: string
  nickname?: string
  createdAt: any
}

const COLLECTION = 'sap_comment_replies'

export async function fetchRepliesByCommentId(commentId: string) {
  if (!commentId) return []
  await ensureLogin()
  const db = app.database()
  try {
    // 先尝试不带 orderBy 查询，避免索引问题
    const res = await db
      .collection(COLLECTION)
      .where({ comment_id: commentId })
      .get()
    
    const data = res.data || []
    console.log(`查询评论 ${commentId} 的回复，找到 ${data.length} 条:`, data)
    
    // 手动按时间排序
    return data.sort((a: any, b: any) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return timeA - timeB
    })
  } catch (e) {
    console.error(`查询评论 ${commentId} 的回复失败:`, e)
    return []
  }
}

export async function addReply(
  params: Omit<CommentReply, '_id' | 'createdAt'>,
) {
  const r: any = await ugcReplyAdd({
    demand_id: params.demand_id,
    comment_id: params.comment_id,
    content: params.content,
  })

  const ok = r && r.success
  if (!ok) {
    const err = String((r && r.error) || 'FAILED_TO_ADD_REPLY')
    throw new Error(err)
  }
  return r.result
}


