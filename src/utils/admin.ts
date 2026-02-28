import { ensureLogin } from './cloudbase'
import { getCurrentAuthUser, getMyAccountInfo } from './user'

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

function isInAdminList(candidate: string): boolean {
  const id = String(candidate || '').trim()
  if (!id) return false
  const uids = getAdminUids()
  if (!uids.length) return false
  return uids.includes(id)
}

export async function requireAdmin(): Promise<{ uid: string }> {
  await ensureLogin()
  const user = await getCurrentAuthUser()
  const uid = String((user as any)?.uid || '').trim()
  if (!isAdminUid(uid)) {
    try {
      const acct = await getMyAccountInfo()
      const phone = String((acct as any)?.phone || '').trim()
      const email = String((acct as any)?.email || '').trim().toLowerCase()
      const username = String((acct as any)?.username || '').trim().toLowerCase()

      if (isInAdminList(phone) || isInAdminList(email) || isInAdminList(username)) {
        return { uid }
      }
    } catch {}
    try {
      if (import.meta.env.DEV) {
        console.warn('NOT_ADMIN', { uid, adminUids: getAdminUids(), adminUidsRaw: ADMIN_UIDS_RAW })
      }
    } catch {}
    throw new Error('NOT_ADMIN')
  }
  return { uid }
}
