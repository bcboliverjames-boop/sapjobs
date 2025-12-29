import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

export type Locale = 'zh-CN' | 'en-US';

// 创建 i18n 实例
const i18n = createI18n({
  legacy: false, // 使用 Composition API
  locale: 'zh-CN', // 默认语言
  fallbackLocale: 'zh-CN', // 回退语言
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS
  },
  globalInjection: true, // 全局注入 $t 方法
  silentTranslationWarn: true // 关闭警告
});

// 切换语言
export function setLocale(locale: Locale): void {
  ;(i18n.global.locale as any).value = locale
  uni.setStorageSync('locale', locale);
}

// 获取当前语言
export function getLocale(): Locale {
  const savedLocale = uni.getStorageSync('locale');
  return (savedLocale === 'zh-CN' || savedLocale === 'en-US') ? savedLocale : 'zh-CN';
}

// 获取 i18n 实例
export function useI18n() {
  return i18n.global;
}

export default i18n;
