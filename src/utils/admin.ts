import { ensureLogin } from './cloudbase'
import { getCurrentAuthUser } from './user'

const ADMIN_UIDS_RAW = String(import.meta.env.VITE_ADMIN_UIDS || '').trim()

function getAdminUidsRaw(): string {
  return ADMIN_UIDS_RAW
}

export function getAdminUids(): string[] {
  const raw = getAdminUidsRaw()
  if (!raw) return []
  return raw
    .split(',')
    .map((x) => String(x || '').trim())
    .filter(Boolean)
}

export function isAdminUid(uid: string): boolean {
  const id = String(uid || '').trim()
  if (!id) return false
  const uids = getAdminUids()
  if (!uids.length) return false
  return uids.includes(id)
}

export async function requireAdmin(): Promise<{ uid: string }>{
  await ensureLogin()
  const user = await getCurrentAuthUser()
  const uid = String((user as any)?.uid || '').trim()
  if (!isAdminUid(uid)) {
    try {
      if (import.meta.env.DEV) {
        console.warn('NOT_ADMIN', { uid, adminUids: getAdminUids(), adminUidsRaw: ADMIN_UIDS_RAW })
      }
    } catch {}
    throw new Error('NOT_ADMIN')
  }
  return { uid }
}
