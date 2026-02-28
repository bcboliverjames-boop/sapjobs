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

function getApiBase(): string {
  try {
    if (typeof window !== 'undefined') {
      const host = String(window.location && window.location.hostname)
      if (/^(localhost|127\.0\.0\.1)$/i.test(host)) {
        const forced = (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || ''
        return forced ? String(forced) : 'http://127.0.0.1:3001'
      }
    }
  } catch {
    // ignore
  }

  const fromEnv =
    (import.meta as any)?.env?.VITE_SAPBOSS_API_BASE_URL || (import.meta as any)?.env?.VITE_API_BASE_URL || ''
  if (fromEnv) return String(fromEnv)

  return 'https://api.sapboss.com'
}

const API_BASE = getApiBase()

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

export async function fetchRepliesByCommentId(commentId: string) {
  if (!commentId) return []
  try {
    const resp: any = await requestJson({
      url: `${API_BASE}/comment_replies?commentId=${encodeURIComponent(String(commentId || '').trim())}`,
      method: 'GET',
    })

    if (!resp || !resp.ok || !Array.isArray(resp.replies)) return []

    const data = resp.replies || []
    console.log(`查询评论 ${commentId} 的回复，找到 ${data.length} 条:`, data)

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


