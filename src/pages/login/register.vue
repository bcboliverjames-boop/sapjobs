<template>
  <view class="login-container">
    <view class="login-header">
      <text class="title">注册</text>
      <text class="subtitle">手机号 / 邮箱 / 用户名（三选一）+ 密码</text>
    </view>

    <view class="login-form">
      <view class="input-hint">
        <text class="hint-text">支持以下格式：手机号、邮箱地址、用户名</text>
      </view>

      <view class="input-group">
        <text class="label">账号</text>
        <input
          class="input-field"
          type="text"
          placeholder="请输入手机号/邮箱/用户名"
          v-model="identifier"
          @input="onIdentifierInput"
        />
        <view v-if="identifierType" class="input-type-indicator">
          <text class="type-text">{{ identifierType }}</text>
        </view>
      </view>

      <view class="input-group">
        <text class="label">密码</text>
        <view class="password-input-container">
          <input
            class="input-field password-input"
            :type="showPassword ? 'text' : 'password'"
            placeholder="请输入密码（至少 6 位）"
            v-model="password"
          />
          <button class="toggle-password-btn" @click="togglePassword">
            {{ showPassword ? '隐藏' : '显示' }}
          </button>
        </view>
      </view>

      <view class="input-group">
        <text class="label">确认密码</text>
        <input
          class="input-field"
          :type="showPassword ? 'text' : 'password'"
          placeholder="请再次输入密码"
          v-model="confirmPassword"
        />
      </view>

      <view class="input-group">
        <text class="label">职业 <text class="required">*</text></text>
        <picker :range="occupations" @change="onOccupationChange">
          <view class="input-field" style="display:flex;align-items:center;">
            <text style="color: #111827;">{{ occupation || '请选择职业' }}</text>
          </view>
        </picker>
      </view>

      <view v-if="occupation === '需求发布者'" class="input-group">
        <text class="label">微信号（必填其一）</text>
        <input class="input-field" type="text" placeholder="请输入微信号" v-model="wechatId" />
      </view>

      <view v-if="occupation === '需求发布者'" class="input-group">
        <text class="label">QQ号（必填其一）</text>
        <input class="input-field" type="text" placeholder="请输入QQ号" v-model="qqId" />
      </view>

      <button class="login-btn" :disabled="!canSubmit" @click="handleRegister">
        {{ loading ? '注册中...' : '注册并登录' }}
      </button>

      <view class="quick-links">
        <text @tap="goToLogin" class="link-text">已有账号？去登录</text>
        <text @tap="goBack" class="link-text">返回</text>
      </view>
    </view>

    <view v-if="loading" class="loading-mask">
      <view class="loading-content">
        <text>{{ loadingText }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { registerWithPassword } from '../../utils/user'

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

const identifier = ref('')
const password = ref('')
const confirmPassword = ref('')
const occupation = ref('')
const wechatId = ref('')
const qqId = ref('')
const occupations = ['SAP顾问', '需求发布者', '其他职业']
const showPassword = ref(false)
const loading = ref(false)
const loadingText = ref('')
const identifierType = ref('')

const canSubmit = computed(() => {
  const idOk = identifier.value.trim().length >= 3
  const passOk = password.value.length >= 6
  const confirmOk = confirmPassword.value.length >= 6 && confirmPassword.value === password.value
  const occOk = !!occupation.value
  const contactOk = occupation.value !== '需求发布者' || !!(wechatId.value.trim() || qqId.value.trim())
  return idOk && passOk && confirmOk && occOk && contactOk && !loading.value
})

const detectIdentifierType = (value: string) => {
  if (!value) return ''
  const v = value.trim()
  if (/^1[3-9]\d{9}$/.test(v)) return '手机号'
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v)) return '邮箱'
  if (/^[a-zA-Z0-9_]{3,20}$/.test(v)) return '用户名'
  if (v.length >= 3) return '用户名'
  return ''
}

const onIdentifierInput = () => {
  identifierType.value = detectIdentifierType(identifier.value)
}

const togglePassword = () => {
  showPassword.value = !showPassword.value
}

const onOccupationChange = (e: any) => {
  try {
    const idx = Number((e && e.detail && e.detail.value) || 0)
    occupation.value = occupations[idx] || ''
  } catch {
    occupation.value = ''
  }
}

const handleRegister = async () => {
  if (!canSubmit.value) {
    uni.showToast({ title: '请完善注册信息', icon: 'none' })
    return
  }

  if (password.value !== confirmPassword.value) {
    uni.showToast({ title: '两次输入的密码不一致', icon: 'none' })
    return
  }

  if (!occupation.value) {
    uni.showToast({ title: '请选择职业', icon: 'none' })
    return
  }
  if (occupation.value === '需求发布者' && !(wechatId.value.trim() || qqId.value.trim())) {
    uni.showToast({ title: '需求发布者请填写微信号或QQ号', icon: 'none' })
    return
  }

  try {
    loading.value = true
    loadingText.value = '注册中...'

    await registerWithPassword(identifier.value.trim(), password.value, {
      occupation: occupation.value,
      wechat_id: wechatId.value.trim(),
      qq_id: qqId.value.trim(),
    })

    uni.showToast({ title: '注册成功', icon: 'success' })
    setTimeout(() => {
      goBackOrHome()
    }, 800)
  } catch (e: any) {
    uni.showToast({ title: String(e?.message || '注册失败'), icon: 'none' })
  } finally {
    loading.value = false
  }
}

const goToLogin = () => {
  try {
    uni.redirectTo({ url: '/pages/login/password-login' })
  } catch {
    uni.navigateTo({ url: '/pages/login/password-login' })
  }
}

const goBack = () => {
  uni.navigateBack()
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

.password-input-container {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.password-input {
  flex: 1;
}

.toggle-password-btn {
  min-width: 120rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 12rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.10);
  background: #FFFFFF;
  font-size: 26rpx;
  color: rgba(17, 24, 39, 0.72);
}

.input-type-indicator {
  position: absolute;
  right: 18rpx;
  bottom: 18rpx;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(37, 99, 235, 0.10);
}

.type-text {
  font-size: 22rpx;
  color: #2563EB;
  font-weight: 700;
}

.login-btn {
  width: 100%;
  height: 92rpx;
  line-height: 92rpx;
  border-radius: 14rpx;
  background: #2563EB;
  color: white;
  font-size: 32rpx;
  font-weight: 800;
  margin-top: 10rpx;
}

.login-btn[disabled] {
  opacity: 0.55;
}

.quick-links {
  margin-top: 24rpx;
  display: flex;
  justify-content: space-between;
}

.link-text {
  color: #2563EB;
  text-decoration: underline;
  font-size: 26rpx;
}

.loading-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 999;
}

.loading-content {
  background: white;
  padding: 40rpx;
  border-radius: 16rpx;
  text-align: center;
}

.required {
  color: #ef4444;
}
</style>
