<template>
  <view class="login-container">
    <view class="login-header">
      <text class="title">手机登录</text>
      <text class="subtitle">H5 仅支持手机号 + 密码登录</text>
    </view>
    
    <view class="login-form">
      <!-- 手机号输入 -->
      <view class="input-group">
        <text class="label">手机号</text>
        <input 
          class="input-field"
          type="number"
          placeholder="请输入手机号"
          v-model="phoneNumber"
          maxlength="11"
        />
      </view>
      <template v-if="!isH5">
        <show-captcha />
        <!-- 验证码输入 -->
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
              :disabled="!isPhoneValid || countdown > 0"
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
        :disabled="isH5 ? !isPhoneValid : !canLogin"
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
</template>

<script setup lang="ts">
import { ref, computed, onUnmounted, onMounted } from 'vue'
import { getPhoneVerification, signInWithPhoneCode, ensureLogin } from '../../utils/cloudbase'

const isH5Runtime = () => {
  try {
    return typeof window !== 'undefined'
  } catch {
    return false
  }
}

const isH5 = isH5Runtime()

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
const phoneNumber = ref('')
const verificationCode = ref('')
const verificationInfo = ref<any>(null)
const countdown = ref(0)
const loading = ref(false)
const loadingText = ref('')

// 计时器
let timer: any = null

// 计算属性
const isPhoneValid = computed(() => {
  return /^1[3-9]\d{9}$/.test(phoneNumber.value)
})

const canLogin = computed(() => {
  return isPhoneValid.value && verificationCode.value.length === 6 && verificationInfo.value
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
  if (isH5) {
    if (isPhoneValid.value) {
      goToPasswordLoginWithIdentifier(phoneNumber.value)
      return
    }
    uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
    return
  }
  if (!isPhoneValid.value) {
    uni.showToast({
      title: '请输入正确的手机号',
      icon: 'none'
    })
    return
  }
  
  try {
    loading.value = true
    loadingText.value = '发送验证码中...'
    
    const result = await getPhoneVerification(phoneNumber.value)
    verificationInfo.value = result
    
    uni.showToast({
      title: '验证码发送成功',
      icon: 'success'
    })
    
    // 开始倒计时
    startCountdown()
    
  } catch (error: any) {
    console.error('获取验证码失败:', error)
    uni.showToast({
      title: error.message || '获取验证码失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
}

// 开始倒计时
const startCountdown = () => {
  countdown.value = 60
  timer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(timer)
      timer = null
    }
  }, 1000)
}

// 手机验证码登录
const handleLogin = async () => {
  if (isH5) {
    if (!isPhoneValid.value) {
      uni.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    goToPasswordLoginWithIdentifier(phoneNumber.value)
    return
  }
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
    await signInWithPhoneCode({
      verificationInfo: verificationInfo.value,
      verificationCode: verificationCode.value,
      phoneNum: phoneNumber.value
    })
    
    uni.showToast({
      title: '登录成功',
      icon: 'success'
    })
    
    setTimeout(() => {
      goBackOrHome()
    }, 1000)   
  } catch (error: any) {
    console.error('登录失败:', error)
    uni.showToast({
      title: error.message || '登录失败',
      icon: 'none'
    })
  } finally {
    loading.value = false
  }
}

// 返回登录方式选择
const goBack = () => {
  try {
    uni.redirectTo({ url: '/pages/login/password-login' })
  } catch {
    uni.navigateBack()
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
}

.login-header {
  text-align: left;
  margin-bottom: 44rpx;
  position: relative;
}

.title {
  font-size: 44rpx;
  font-weight: 800;
  color: #111827;
  display: block;
  margin-bottom: 10rpx;
}

.subtitle {
  font-size: 26rpx;
  color: rgba(17, 24, 39, 0.68);
  display: block;
}

.login-form {
  background: white;
  border-radius: 18rpx;
  padding: 60rpx 40rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.10);
  box-shadow: 0 14rpx 36rpx rgba(17, 24, 39, 0.08);
  position: relative;
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
