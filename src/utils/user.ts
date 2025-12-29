import { app, auth, ensureLogin } from './cloudbase'
import { getRewardPoints } from './points-config'

export type UserProfile = {
  _id?: string // 使用 auth uid 作为主键
  uid: string
  nickname?: string
  expertise_modules?: string // 逗号分隔的模块，如 "FICO,MM,SD"
  years_of_exp?: number
  avatar_url?: string
  wechat_id?: string
  qq_id?: string
  can_share_contact?: boolean
  points: number
  createdAt?: any
  updatedAt?: any
}

const COLLECTION = 'users'

// 获取当前登录用户的 auth 信息（没有则抛错）
export async function getCurrentAuthUser() {
  const state = await ensureLogin()
  if (!state || !state.user) {
    throw new Error('当前未登录')
  }
  return state.user
}

// 获取或创建用户档案
export async function getOrCreateUserProfile(): Promise<UserProfile> {
  await ensureLogin()
  const user = await getCurrentAuthUser()
  const uid = user.uid as string
  const db = app.database()
  const coll = db.collection(COLLECTION)

  // 以 uid 作为文档 _id，方便快速定位
  const existed = await coll.doc(uid).get()
  if (existed.data && existed.data[0]) {
    return existed.data[0] as UserProfile
  }

  const registerPoints = getRewardPoints('register')
  
  const profile: UserProfile = {
    _id: uid,
    uid,
    nickname: (user as any).nickName || '',
    points: registerPoints, // 注册赠送积分（从配置读取）
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  await coll.add(profile)
  return profile
}

// 更新用户档案（同时可调整积分）
export async function updateUserProfile(
  patch: Partial<UserProfile>,
  options: { addPoints?: number } = {},
): Promise<UserProfile> {
  const authUser = await getCurrentAuthUser()
  const uid = authUser.uid as string
  const db = app.database()
  const coll = db.collection(COLLECTION)

  const existed = await coll.doc(uid).get()
  let current: UserProfile

  if (existed.data && existed.data[0]) {
    current = existed.data[0] as UserProfile
  } else {
    current = await getOrCreateUserProfile()
  }

  const deltaPoints = options.addPoints || 0
  const nextPoints = Math.max(0, (current.points || 0) + deltaPoints)

  const next: Partial<UserProfile> = {
    ...patch,
    points: nextPoints,
    updatedAt: new Date(),
  }

  await coll.doc(uid).update(next)

  return {
    ...current,
    ...next,
  }
}

// 仅读取当前档案（不存在则返回 null）
export async function getUserProfileOnly(): Promise<UserProfile | null> {
  await ensureLogin()
  const state = await auth.getLoginState()
  if (!state || !state.user) return null
  const uid = state.user.uid as string
  const db = app.database()
  const coll = db.collection(COLLECTION)
  const res = await coll.doc(uid).get()
  if (!res.data || !res.data[0]) return null
  return res.data[0] as UserProfile
}



