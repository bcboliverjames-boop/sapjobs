export const SITE_NAME = 'SAP 顾问需求广场'

export const ICP_NUMBER = '粤ICP备2026035310号'
export const ICP_LINK = 'https://beian.miit.gov.cn/'

export const CONTACT_EMAIL =
  String((import.meta as any)?.env?.VITE_CONTACT_EMAIL || '').trim() ||
  'Bcowb@outlook.com'
