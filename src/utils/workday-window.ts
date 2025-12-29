type HolidaySets = {
  offDays: Set<string>
  workDays: Set<string>
  labels: Map<string, string>
}

const CN_HOLIDAY_SOURCES = {
  github: 'https://raw.githubusercontent.com/NateScarlet/holiday-cn/master',
  jsdelivr: 'https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master',
}

function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function isWeekend(d: Date): boolean {
  const day = d.getDay()
  return day === 0 || day === 6
}

function storageGet(key: string): any | null {
  try {
    if (typeof uni !== 'undefined' && typeof uni.getStorageSync === 'function') {
      const v = uni.getStorageSync(key)
      return v ? v : null
    }
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      const v = localStorage.getItem(key)
      return v ? JSON.parse(v) : null
    }
  } catch {}

  return null
}

function storageSet(key: string, value: any): void {
  try {
    if (typeof uni !== 'undefined' && typeof uni.setStorageSync === 'function') {
      uni.setStorageSync(key, value)
      return
    }
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(value))
    }
  } catch {}
}

async function fetchJson(url: string): Promise<any> {
  if (typeof fetch === 'function') {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  }

  if (typeof uni !== 'undefined' && typeof uni.request === 'function') {
    const r = await new Promise<any>((resolve, reject) => {
      uni.request({
        url,
        method: 'GET',
        success: (resp: any) => resolve(resp),
        fail: (err: any) => reject(err),
      })
    })
    if (r.statusCode && r.statusCode >= 400) throw new Error(`HTTP ${r.statusCode}`)
    return r.data
  }

  throw new Error('No fetch/uni.request available')
}

function parseHolidayCnPayload(payload: any, year: number): HolidaySets {
  const offDays = new Set<string>()
  const workDays = new Set<string>()
  const labels = new Map<string, string>()

  const push = (dateStr: string, isOffDay: boolean, name?: string) => {
    if (!dateStr) return
    const s = String(dateStr).trim()
    if (!s) return

    const key = s.length >= 10 ? s.slice(0, 10) : s

    if (isOffDay) offDays.add(key)
    else workDays.add(key)

    if (name) labels.set(key, String(name))
  }

  const yStr = String(year)

  if (Array.isArray(payload)) {
    for (const item of payload) {
      if (!item || typeof item !== 'object') continue
      const date = item.date || item.Date || item.DATE
      const name = item.name || item.Name || item.label || item.title
      const isOffDay = item.isOffDay !== undefined ? !!item.isOffDay : item.offDay !== undefined ? !!item.offDay : true
      push(date, isOffDay, name)
    }
    return { offDays, workDays, labels }
  }

  if (payload && typeof payload === 'object') {
    let daysData = null

    if (payload.days && typeof payload.days === 'object') {
      daysData = payload.days
    } else if (payload[yStr] && payload[yStr].days && typeof payload[yStr].days === 'object') {
      daysData = payload[yStr].days
    } else {
      daysData = payload
    }

    if (daysData && typeof daysData === 'object') {
      for (const [date, info] of Object.entries(daysData)) {
        if (!info || typeof info !== 'object') continue
        const name = (info as any).name || (info as any).label || (info as any).title
        const isOffDay = (info as any).isOffDay !== undefined ? !!(info as any).isOffDay : (info as any).offDay !== undefined ? !!(info as any).offDay : true
        push(date, isOffDay, name)
      }
    }
  }

  return { offDays, workDays, labels }
}

async function loadCnHolidaySets(year: number): Promise<HolidaySets> {
  const cacheKey = `holiday_cn_${year}`
  const cached = storageGet(cacheKey)
  if (cached && cached.data && cached.ts) {
    return {
      offDays: new Set<string>(cached.data.offDays || []),
      workDays: new Set<string>(cached.data.workDays || []),
      labels: new Map<string, string>(cached.data.labels || []),
    }
  }

  const urls = [`${CN_HOLIDAY_SOURCES.github}/${year}.json`, `${CN_HOLIDAY_SOURCES.jsdelivr}/${year}.json`]

  let lastErr: any = null
  for (const url of urls) {
    try {
      const payload = await fetchJson(url)
      const sets = parseHolidayCnPayload(payload, year)
      storageSet(cacheKey, {
        ts: Date.now(),
        data: {
          offDays: Array.from(sets.offDays),
          workDays: Array.from(sets.workDays),
          labels: Array.from(sets.labels.entries()),
        },
      })
      return sets
    } catch (e: any) {
      lastErr = e
    }
  }

  throw lastErr || new Error('Failed to load CN holiday data')
}

export async function isCnWorkday(d: Date): Promise<boolean> {
  const year = d.getFullYear()
  const sets = await loadCnHolidaySets(year)
  const key = ymd(d)

  if (sets.workDays.has(key)) return true
  if (sets.offDays.has(key)) return false

  return !isWeekend(d)
}

export async function getWorkingHoursWindowStart(opts?: { now?: Date; hours?: number }): Promise<Date> {
  const hours = Math.max(1, opts?.hours ?? 24)
  let t = opts?.now ? new Date(opts.now) : new Date()

  let remaining = hours
  while (remaining > 0) {
    t = new Date(t.getTime() - 60 * 60 * 1000)
    if (await isCnWorkday(t)) remaining -= 1
  }

  return t
}
