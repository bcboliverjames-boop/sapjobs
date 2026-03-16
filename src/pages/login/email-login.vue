<template>
  <view class="login-container">
    <view class="page-header-unified">
      <view class="page-header-content">
        <view class="header-left" @tap="goBack">
          <uni-icons type="back" size="20" color="#F5F1E8" />
        </view>
        <text class="page-header-title">邮箱登录</text>
        <view class="header-right"></view>
      </view>
    </view>
    
    <view class="login-content">
      <view class="login-header">
        <text class="title">邮箱登录</text>
        <text class="subtitle">H5 仅支持邮箱 + 密码登录</text>
      </view>
      
      <view class="login-form">
        <!-- 邮箱输入 -->
        <view class="input-group">
          <text class="label">邮箱地址</text>
          <input 
            class="input-field"
            type="text"
            placeholder="请输入邮箱地址"
            v-model="email"
          />
        </view>
        
        <template v-if="!isH5">
          <!-- 验证码输入（仅小程序/APP支持，目前H5已关闭） -->
          <view class="input-group">
            <text class="label">验证码</text>
            <view class="verification-row">
              <input 
                class="input-field verification-input"
                type="number"
                placeholder="请输入验证码"
                v-model="verificationCode"
                maxlength="6"
              />
              <button 
                class="get-code-btn"
                :disabled="!isEmailValid || countdown > 0"
                @click="getVerificationCode"
              >
                {{ countdown > 0 ? `${countdown}s后重试` : '获取验证码' }}
              </button>
            </view>
          </view>
        </template>
        
        <!-- 登录按钮 -->
        <button 
          class="login-btn"
          :disabled="isH5 ? !isEmailValid : !canLogin"
          @click="handleLogin"
        >
          {{ isH5 ? '下一步' : '登录' }}
        </button>
        
        <!-- 返回链接 -->
        <view class="back-login">
          <text @click="goBack" class="link-text">返回密码登录</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { safeNavigateBack } from '../../utils'

const isH5Runtime = () => {
  try {
    return typeof window !== 'undefined'
  } catch {
    return false
  }
}

const isH5 = isH5Runtime()

const goBackOrHome = () => {
  safeNavigateBack({ delta: 1 })
}

// 响应式数据
const email = ref('')
const verificationCode = ref('')
const countdown = ref(0)
let timer: any = null

// 计算属性
const isEmailValid = computed(() => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
})

const canLogin = computed(() => {
  return isEmailValid.value
})

const goToPasswordLoginWithIdentifier = (identifier: string) => {
  const next = String(identifier || '').trim()
  if (!next) return
  const url = `/pages/login/password-login?identifier=${encodeURIComponent(next)}`
  try {
    uni.redirectTo({ url })
  } catch {
    uni.navigateTo({ url })
  }
}

// 获取验证码
const getVerificationCode = async () => {
  if (isEmailValid.value) {
    uni.showToast({ title: '验证码登录已下线，请使用密码登录', icon: 'none' })
    goToPasswordLoginWithIdentifier(email.value)
    return
  }
  uni.showToast({ title: '请输入正确的邮箱地址', icon: 'none' })
}

// 邮箱登录处理
const handleLogin = async () => {
  if (!isEmailValid.value) {
    uni.showToast({ title: '请输入正确的邮箱地址', icon: 'none' })
    return
  }
  uni.showToast({ title: '验证码登录已下线，请使用密码登录', icon: 'none' })
  goToPasswordLoginWithIdentifier(email.value)
}

// 返回密码登录
const goBack = () => {
  try {
    uni.redirectTo({ url: '/pages/login/password-login' })
  } catch {
    safeNavigateBack({ delta: 1 })
  }
}

// 清理定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
})
</script>

<style scoped>
.page-header-unified {
  background: #0B1924;
  height: 88rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  top: 0;
  z-index: 1010;
  width: 100%;
}

.page-header-content {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 24rpx;
}

.page-header-title {
  color: #F5F1E8;
  font-size: 32rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
}

.header-left, .header-right {
  width: 80rpx;
  display: flex;
  align-items: center;
}

.login-content {
  position: relative;
  z-index: 1;
}

.login-container {
  min-height: 100vh;
  background: #F5F1E8;
  padding: 0;
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
  background: rgba(11, 25, 36, 0.05);
  transform: rotate(18deg);
  border-radius: 120rpx;
  pointer-events: none;
  z-index: 0;
}

.login-header {
  text-align: left;
  margin-bottom: 44rpx;
  padding: 64rpx 36rpx 0;
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
  margin: 0 36rpx 44rpx;
  border: 2rpx solid rgba(11, 25, 36, 0.10);
  box-shadow: 0 14rpx 36rpx rgba(17, 24, 39, 0.08);
  position: relative;
  z-index: 1;
}

.input-group {
  margin-bottom: 40rpx;
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
}

.verification-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.verification-input {
  flex: 1;
}

.get-code-btn {
  width: 200rpx;
  height: 88rpx;
  background: #2563EB;
  color: white;
  border: none;
  border-radius: 12rpx;
  font-size: 28rpx;
  font-weight: 500;
}

.get-code-btn:disabled {
  background: #ccc;
  color: #999;
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
}

.login-btn:disabled {
  background: #ccc;
  color: #999;
}

.back-login {
  text-align: center;
  margin-top: 40rpx;
}

.link-text {
  font-size: 28rpx;
  color: #2563EB;
  text-decoration: underline;
}
</style>
