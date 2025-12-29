<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
import { initCloudBase, checkEnvironment } from "./utils/cloudbase";
import { createSSRApp } from 'vue';
import { createI18n } from 'vue-i18n';
import zhCN from './i18n/locales/zh-CN';
import enUS from './i18n/locales/en-US';

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

// 创建应用实例
const app = createSSRApp({});

// 使用 i18n
app.use(i18n);

// 设置全局属性
app.config.globalProperties.$t = i18n.global.t;

onLaunch(async () => {
  console.log("App Launch");
  
  // 设置语言
  const locale = uni.getStorageSync('locale') || 'zh-CN';
  i18n.global.locale.value = locale;
  
  // 检查云开发环境配置
  if (checkEnvironment()) {
    try {
      // 初始化云开发
      const success = await initCloudBase();
      if (success) {
        console.log("云开发初始化成功");
      } else {
        console.warn("云开发初始化失败");
      }
    } catch (error) {
      console.error("云开发初始化异常:", error);
    }
  } else {
    console.warn("云开发环境ID未配置，请在 src/utils/cloudbase.ts 中配置");
  }
});

onShow(() => {
  console.log("App Show");
});

onHide(() => {
  console.log("App Hide");
});
</script>

<style>
/* 全局样式 */
page {
  background-color: #f5f5f5;
  font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Helvetica Neue', Arial, sans-serif;
  color: #333;
  line-height: 1.5;
}

/* 通用按钮样式 */
.btn {
  border-radius: 12rpx;
  font-size: 28rpx;
  padding: 20rpx 40rpx;
  border: none;
  transition: all 0.3s ease;
}

.btn-primary {
  background-color: #007aff;
  color: #fff;
}

.btn-primary:active {
  opacity: 0.8;
}

/* 表单元素样式 */
.input-group {
  margin-bottom: 30rpx;
}

.input-label {
  display: block;
  margin-bottom: 10rpx;
  font-size: 28rpx;
  color: #333;
}

.input-field {
  width: 100%;
  height: 88rpx;
  padding: 0 20rpx;
  border: 1px solid #ddd;
  border-radius: 8rpx;
  font-size: 28rpx;
  box-sizing: border-box;
}

/* 布局样式 */
.flex-center {
  display: flex;
  justify-content: center;
  align-items: center;
}

/* 文字样式 */
.text-center {
  text-align: center;
}

.text-muted {
  color: #999;
  font-size: 24rpx;
}

/* 间距工具类 */
.mt-20 {
  margin-top: 20rpx;
}

.mb-20 {
  margin-bottom: 20rpx;
}

.ml-20 {
  margin-left: 20rpx;
}

.mr-20 {
  margin-right: 20rpx;
}

.pt-20 {
  padding-top: 20rpx;
}

.pb-20 {
  padding-bottom: 20rpx;
}

.pl-20 {
  padding-left: 20rpx;
}

.pr-20 {
  padding-right: 20rpx;
}

/* 语言切换样式 */
.language-switcher {
  position: fixed;
  right: 20rpx;
  top: 20rpx;
  z-index: 999;
  background-color: rgba(255, 255, 255, 0.9);
  padding: 10rpx 20rpx;
  border-radius: 30rpx;
  box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
  font-size: 24rpx;
}

.language-switcher text {
  margin: 0 10rpx;
  color: #666;
}

.language-switcher .active {
  color: #007aff;
  font-weight: bold;
}
</style>

<template>
  <view>
    <!-- 语言切换器 -->
    <view class="language-switcher">
      <text :class="{ active: $i18n.locale === 'zh-CN' }" @tap="switchLanguage('zh-CN')">中文</text>
      <text>|</text>
      <text :class="{ active: $i18n.locale === 'en-US' }" @tap="switchLanguage('en-US')">EN</text>
    </view>
    
    <!-- 页面内容 -->
    <slot></slot>
  </view>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import { setLocale } from './i18n';

export default defineComponent({
  methods: {
    switchLanguage(locale: 'zh-CN' | 'en-US') {
      setLocale(locale);
      uni.showToast({
        title: this.$t('common.success') as string,
        icon: 'none'
      });
    }
  }
});
</script>
