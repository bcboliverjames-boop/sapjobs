<template>
  <view class="login-container">
    <view class="login-header">
      <text class="title">选择登录方式</text>
      <text class="subtitle">请选择您喜欢的登录方式</text>
    </view>
    
    <view class="login-options">
      <!-- 密码登录 -->
      <view class="login-option" @click="passwordLogin">
        <view class="option-icon">
          <uni-icons type="locked" size="22" color="#111827" />
        </view>
        <view class="option-content">
          <text class="option-title">密码登录</text>
          <text class="option-desc">使用手机号/邮箱/用户名 + 密码登录</text>
        </view>
        <view class="option-arrow">
          <uni-icons type="right" size="16" color="#9CA3AF" />
        </view>
      </view>
    </view>
    
    <view class="footer-text">
      <text>选择登录方式即表示您同意我们的</text>
      <text class="link-text">服务条款</text>
      <text>和</text>
      <text class="link-text">隐私政策</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'

onMounted(() => {
  try {
    uni.redirectTo({ url: '/pages/login/password-login' })
  } catch {}
})

// 密码登录
const passwordLogin = () => {
  uni.navigateTo({
    url: '/pages/login/password-login'
  })
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
  font-size: 26rpx;
  color: rgba(17, 24, 39, 0.68);
  display: block;
}

.login-options {
  background: white;
  border-radius: 18rpx;
  overflow: hidden;
  border: 2rpx solid rgba(17, 24, 39, 0.10);
  box-shadow: 0 14rpx 36rpx rgba(17, 24, 39, 0.08);
  margin-bottom: 28rpx;
  position: relative;
}

.login-option {
  display: flex;
  align-items: center;
  padding: 40rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  transition: background-color 0.3s;
}

.login-option:last-child {
  border-bottom: none;
}

.login-option:active {
  background-color: #F9FAFB;
}

.login-option-button {
  /* 复制 .login-option 的样式 */
  display: flex;
  align-items: center;
  padding: 40rpx 30rpx;
  border-bottom: 1rpx solid #f0f0f0;
  transition: background-color 0.3s;
  /* 重置 button 的默认样式 */
  background-color: white;
  border-radius: 0;
  margin: 0;
  line-height: 1.4;
  text-align: left;
}

.login-option-button::after {
  border: none; /* 移除按钮的默认边框 */
}

.login-option-button:active {
  background-color: #F9FAFB;
}

.option-icon {
  margin-right: 30rpx;
  width: 72rpx;
  height: 72rpx;
  border-radius: 18rpx;
  background: rgba(17, 24, 39, 0.04);
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.option-title {
  font-size: 32rpx;
  font-weight: 800;
  color: #111827;
}

.option-desc {
  font-size: 26rpx;
  color: rgba(17, 24, 39, 0.62);
  line-height: 1.4;
}

.option-arrow {
  font-size: 32rpx;
  color: #ccc;
  font-weight: bold;
}

.footer-text {
  text-align: center;
  font-size: 24rpx;
  color: rgba(17, 24, 39, 0.60);
  line-height: 1.6;
}

.link-text {
  color: #2563EB;
  text-decoration: underline;
}
</style>
