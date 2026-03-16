<template>
  <view class="login-container">
    <view class="login-header">
      <text class="title">密码登录</text>
      <text class="subtitle">请使用密码登录页</text>
    </view>

    <view class="login-form">
      <button class="login-btn" @click="goToPasswordLogin">前往密码登录</button>
      <view class="quick-links">
        <text class="link-text" @click="goBack">返回</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { safeNavigateBack } from '../../utils'

const goToPasswordLogin = () => {
  try {
    uni.redirectTo({ url: '/pages/login/password-login' })
  } catch {
    try {
      uni.navigateTo({ url: '/pages/login/password-login' })
    } catch {
      // ignore
    }
  }
}

const goBack = () => {
  safeNavigateBack({ delta: 1 })
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
