<template>
  <view class="login-container">
    <view class="login-header">
      <text class="title">密码登录</text>
      <text class="subtitle">支持手机号/邮箱/用户名 + 密码登录</text>
    </view>
    
    <view class="login-form">
      <!-- 用户名输入提示 -->
      <view class="input-hint">
        <text class="hint-text">{{ getInputHint() }}</text>
      </view>
      
      <!-- 账号输入 -->
      <view class="input-group">
        <text class="label">账号</text>
        <input 
          class="input-field"
          type="text"
          placeholder="请输入手机号/邮箱/用户名"
          v-model="username"
          @input="onUsernameInput"
        />
        <view v-if="usernameType" class="input-type-indicator">
          <text class="type-text">{{ usernameType }}</text>
        </view>
      </view>
      
      <!-- 密码输入 -->
      <view class="input-group">
        <text class="label">密码</text>
        <view class="password-input-container">
          <input 
            class="input-field password-input"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码"
            v-model="password"
          />
          <button class="toggle-password-btn" @click="togglePassword">
            {{ showPassword ? '隐藏' : '显示' }}
          </button>
        </view>
      </view>
      
      <!-- 登录按钮 -->
      <button 
        class="login-btn"
        :disabled="!canLogin"
        @click="handleLogin"
      >
        {{ loading ? '登录中...' : '登录' }}
      </button>
      
      <!-- 快捷链接 -->
      <view class="quick-links">
        <navigator url="/pages/login/phone-login" class="link-text">手机验证码登录</navigator>
        <navigator url="/pages/login/email-login" class="link-text">邮箱验证码登录</navigator>
        <navigator url="/pages/login/register" class="link-text">注册</navigator>
      </view>
    </view>
    
    <!-- 加载提示 -->
    <view v-if="loading" class="loading-mask">
      <view class="loading-content">
        <text>{{ loadingText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { loginWithPassword } from '../../utils/user'

const goBackOrHome = () => {
  try {
    uni.navigateBack({
      delta: 1,
      fail: () => {
        try {
          uni.reLaunch({ url: '/pages/index/index' })
        } catch {}
      },
    })
  } catch {
    try {
      uni.reLaunch({ url: '/pages/index/index' })
    } catch {}
  }
}

// 响应式数据
const username = ref('')
const password = ref('')
const showPassword = ref(false)
const loading = ref(false)
const loadingText = ref('')
const usernameType = ref('')

onLoad((query: any) => {
  try {
    const raw = query && (query.identifier || query.username || query.account)
    const next = String(raw || '').trim()
    if (!next) return
    username.value = decodeURIComponent(next)
    onUsernameInput()
  } catch {
    // ignore
  }
})

// 计算属性
const canLogin = computed(() => {
  return username.value.trim().length >= 3 && password.value.length >= 6
})

// 判断用户名类型
const detectUsernameType = (value: string) => {
  if (!value) return ''
  
  if (/^1[3-9]\d{9}$/.test(value)) {
    return '手机号'
  } else if (/^\+\d{1,3}\s\d{4,20}$/.test(value)) {
    return '国际手机号'
  } else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
    return '邮箱'
  } else if (/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
    return '用户名'
  } else if (value.length >= 3) {
    return '用户名'
  }
  
  return ''
}

// 获取输入提示
const getInputHint = () => {
  if (!username.value) {
    return '支持以下格式：手机号、邮箱地址、用户名'
  }
  
  switch (usernameType.value) {
    case '手机号':
      return '✅ 识别为手机号'
    case '国际手机号':
      return '✅ 识别为国际手机号'
    case '邮箱':
      return '✅ 识别为邮箱地址'
    case '用户名':
      return '✅ 识别为用户名'
    default:
      return '请输入有效的手机号、邮箱或用户名'
  }
}

// 用户名输入事件
const onUsernameInput = () => {
  usernameType.value = detectUsernameType(username.value.trim())
}

// 切换密码显示
const togglePassword = () => {
  showPassword.value = !showPassword.value
}

// 处理登录
const handleLogin = async () => {
  if (!canLogin.value) {
    uni.showToast({
      title: '请完善登录信息',
      icon: 'none'
    })
    return
  }
  
  try {
    loading.value = true
    loadingText.value = '登录中...'
    
    await loginWithPassword(username.value.trim(), password.value)
    
    uni.showToast({
      title: '登录成功',
      icon: 'success'
    })
    
    // 延迟跳转到首页
    setTimeout(() => {
      goBackOrHome()
    }, 1500)
    
  } catch (error: any) {
    console.error('登录失败:', error)
    
    // 显示友好的错误信息
    let errorMessage = '登录失败'
    const raw = String((error && (error.message || error.error)) || '').trim()
    if (raw) {
      if (raw === 'INVALID_CREDENTIALS') {
        errorMessage = '账号或密码错误'
      } else {
        errorMessage = raw
      }
    }
    
    uni.showToast({
      title: errorMessage,
      icon: 'none',
      duration: 3000
    })
  } finally {
    loading.value = false
  }
}

const goToPhoneLogin = () => {
  uni.navigateTo({ url: '/pages/login/phone-login' })
}

const goToEmailLogin = () => {
  uni.navigateTo({ url: '/pages/login/email-login' })
}

const goToRegister = () => {
  uni.navigateTo({ url: '/pages/login/register' })
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  background: #F3F4F6;
  padding: 64rpx 36rpx 44rpx;
  box-sizing: border-box;
  color: #111827;
  font-family: "Noto Sans SC", "Source Han Sans SC", "PingFang SC", sans-serif;
  position: relative;
  overflow: hidden;
}

.login-container::before {
  content: "";
  position: absolute;
  top: -160rpx;
  right: -220rpx;
  width: 520rpx;
  height: 520rpx;
  background: rgba(37, 99, 235, 0.10);
  transform: rotate(18deg);
  border-radius: 120rpx;
  pointer-events: none;
  z-index: 0;
}

.login-header {
  text-align: left;
  margin-bottom: 44rpx;
  position: relative;
  z-index: 1;
}

.title {
  font-size: 44rpx;
  font-weight: 800;
  color: #111827;
  display: block;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 28rpx;
  color: rgba(17, 24, 39, 0.68);
  display: block;
  line-height: 1.4;
}

.login-form {
  background: white;
  border-radius: 18rpx;
  padding: 60rpx 40rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.10);
  box-shadow: 0 14rpx 36rpx rgba(17, 24, 39, 0.08);
  position: relative;
  z-index: 1;
}

.input-hint {
  margin-bottom: 30rpx;
  padding: 20rpx;
  background: #f8f9fa;
  border-radius: 12rpx;
  border-left: 6rpx solid #2563EB;
}

.hint-text {
  font-size: 24rpx;
  color: #666;
  line-height: 1.4;
}

.input-group {
  margin-bottom: 40rpx;
  position: relative;
}

.label {
  font-size: 28rpx;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
  font-weight: 500;
}

.input-field {
  width: 100%;
  height: 88rpx;
  border: 2rpx solid #e0e0e0;
  border-radius: 12rpx;
  padding: 0 24rpx;
  font-size: 32rpx;
  box-sizing: border-box;
  background: #fafafa;
  transition: all 0.3s ease;
}

.input-field:focus {
  border-color: #2563EB;
  background: white;
  box-shadow: 0 0 0 4rpx rgba(37, 99, 235, 0.10);
}

.input-type-indicator {
  position: absolute;
  right: 20rpx;
  top: 50%;
  transform: translateY(-50%);
  margin-top: 14rpx;
}

.type-text {
  font-size: 20rpx;
  color: #2563EB;
  background: rgba(37, 99, 235, 0.10);
  padding: 8rpx 16rpx;
  border-radius: 20rpx;
  font-weight: 500;
}

.password-input-container {
  position: relative;
  display: flex;
  align-items: center;
}

.password-input {
  flex: 1;
  padding-right: 100rpx;
}

.toggle-password-btn {
  position: absolute;
  right: 20rpx;
  width: 60rpx;
  height: 60rpx;
  background: transparent;
  border: none;
  font-size: 32rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.login-btn {
  width: 100%;
  height: 88rpx;
  background: #2563EB;
  color: white;
  border: none;
  border-radius: 12rpx;
  font-size: 32rpx;
  font-weight: 600;
  margin-top: 40rpx;
  transition: all 0.3s ease;
}

.login-btn:disabled {
  background: #ccc;
  color: #999;
}

.login-btn:not(:disabled):active {
  background: #5a6fd8;
  transform: translateY(2rpx);
}

.quick-links {
  display: flex;
  justify-content: space-between;
  margin-top: 40rpx;
  position: relative;
  z-index: 2;
}

.link-text {
  font-size: 28rpx;
  color: #2563EB;
  text-decoration: underline;
}

.loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.loading-content {
  background: white;
  padding: 40rpx 60rpx;
  border-radius: 12rpx;
  text-align: center;
}

.loading-content text {
  font-size: 28rpx;
  color: #333;
}
</style>