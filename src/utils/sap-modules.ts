export type SapModuleDef = {
  code: string
  label: string
  aliases: string[]
}

export const SAP_MODULE_DEFS: SapModuleDef[] = [
  { code: 'FICO', label: 'FI/CO', aliases: ['FI', 'CO', 'FI/CO', 'FICO'] },
  { code: 'MM', label: 'MM', aliases: [] },
  { code: 'SD', label: 'SD', aliases: [] },
  { code: 'PP', label: 'PP', aliases: [] },
  { code: 'QM', label: 'QM', aliases: [] },
  { code: 'PM', label: 'PM', aliases: [] },
  { code: 'PS', label: 'PS', aliases: [] },
  { code: 'HCM', label: 'HCM/HR', aliases: ['HR', 'HCM', 'HCM/HR'] },
  { code: 'EHS', label: 'EHS', aliases: [] },
  { code: 'WM', label: 'WM', aliases: [] },
  { code: 'EWM', label: 'EWM', aliases: [] },
  { code: 'LE', label: 'LE', aliases: [] },
  { code: 'SCM', label: 'SCM', aliases: [] },
  { code: 'APO', label: 'APO', aliases: [] },
  { code: 'CRM', label: 'CRM', aliases: [] },
  { code: 'BW', label: 'BW', aliases: ['BI'] },
  { code: 'ABAP', label: 'ABAP', aliases: [] },
  { code: 'BASIS', label: 'BASIS', aliases: ['NETWEAVER'] },
  { code: 'PI', label: 'PI/XI', aliases: ['XI', 'PI', 'PI/XI'] },
  { code: 'SRM', label: 'SRM', aliases: [] },
  { code: 'PLM', label: 'PLM', aliases: [] },
  { code: 'WF', label: 'WF', aliases: [] },
  { code: 'EP', label: 'EP', aliases: [] },
  { code: 'SAC', label: 'SAC', aliases: [] },
  { code: 'FIORI', label: 'FIORI', aliases: ['Fiori'] },
  { code: 'MDG', label: 'MDG', aliases: [] },
  { code: 'OTHER', label: 'OTHER', aliases: ['其他'] },
]

function normToken(v: string): string {
  const s = String(v || '').trim().toUpperCase().replace(/\s+/g, '')
  return s.replace(/\\/g, '/').replace(/\|/g, '/').replace(/／/g, '/').replace(/＼/g, '/')
}

const CODE_TO_LABEL = new Map<string, string>(SAP_MODULE_DEFS.map((d) => [d.code, d.label]))

const TOKEN_TO_CODE = (() => {
  const m = new Map<string, string>()
  for (const d of SAP_MODULE_DEFS) {
    m.set(normToken(d.code), d.code)
    m.set(normToken(d.label), d.code)
    for (const a of d.aliases || []) {
      m.set(normToken(a), d.code)
    }
  }
  return m
})()

export function normalizeSapModuleToken(v: string): string {
  const t = normToken(v)
  return TOKEN_TO_CODE.get(t) || ''
}

export function normalizeSapModuleCodes(input: string[]): string[] {
  const raw = Array.isArray(input) ? input : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const it of raw) {
    const s = String(it || '').trim()
    if (!s) continue
    const code = normalizeSapModuleToken(s)
    const finalCode = code || (/(?:^|\b)OTHER(?:\b|$)|其他/i.test(s) ? 'OTHER' : '')
    if (!finalCode) continue
    if (!seen.has(finalCode)) {
      out.push(finalCode)
      seen.add(finalCode)
    }
  }
  return out
}

export function sapModuleCodeToLabel(code: string): string {
  const k = normToken(code)
  return CODE_TO_LABEL.get(k) || k
}

export function getSapModuleOptionsForUi(opts?: { includeOther?: boolean }): Array<{ code: string; name: string }> {
  const includeOther = opts && opts.includeOther === false ? false : true
  return SAP_MODULE_DEFS.filter((d) => (includeOther ? true : d.code !== 'OTHER')).map((d) => ({
    code: d.code,
    name: d.label,
  }))
}

export function getSapModuleFilterOptions(): Array<{ code: string; name: string }> {
  return [{ code: 'ALL', name: '全部' }, ...getSapModuleOptionsForUi({ includeOther: false })]
}
