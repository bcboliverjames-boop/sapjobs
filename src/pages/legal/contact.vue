<template>
  <view class="page">
    <view class="card">
      <text class="h1">联系我们</text>
      <text class="meta">用于咨询、删帖/更正申请、商务合作等</text>

      <view class="section">
        <text class="h2">联系邮箱</text>
        <view class="row">
          <text class="mono">{{ CONTACT_EMAIL }}</text>
          <button class="btn" @click="copyEmail">复制</button>
        </view>
      </view>

      <view class="section">
        <text class="h2">处理时效</text>
        <text class="p">我们通常会在 1-3 个工作日内回复。涉及违法违规内容或紧急风险的举报将优先处理。</text>
      </view>

      <view class="section">
        <text class="h2">建议提供的信息</text>
        <view class="list">
          <text class="li">- 页面链接/截图</text>
          <text class="li">- 需求标题或发布时间</text>
          <text class="li">- 你的联系方式（便于回访）</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { CONTACT_EMAIL } from '../../config/site'

const copyEmail = () => {
  uni.setClipboardData({
    data: CONTACT_EMAIL,
    success: () => {
      uni.showToast({
        title: '已复制',
        icon: 'none'
      })
    }
  })
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  padding: 28rpx;
  background: #F5F1E8;
  color: #111827;
  font-family: "Noto Sans SC", "Source Han Sans SC", sans-serif;
}

.card {
  background: #FFFFFF;
  border-radius: 20rpx;
  padding: 26rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
}

.h1 {
  display: block;
  font-size: 40rpx;
  font-weight: 800;
  font-family: "Noto Serif SC", "Source Han Serif SC", serif;
}

.meta {
  display: block;
  margin-top: 10rpx;
  font-size: 22rpx;
  color: rgba(17, 24, 39, 0.55);
}

.section {
  margin-top: 22rpx;
}

.h2 {
  display: block;
  font-size: 28rpx;
  font-weight: 800;
  margin-bottom: 10rpx;
}

.p {
  display: block;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(17, 24, 39, 0.82);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}

.mono {
  font-size: 24rpx;
  color: rgba(17, 24, 39, 0.82);
}

.btn {
  padding: 14rpx 18rpx;
  border-radius: 14rpx;
  background: #0B1924;
  color: #F5F1E8;
  font-size: 24rpx;
  font-weight: 700;
}

.list {
  margin-top: 10rpx;
}

.li {
  display: block;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(17, 24, 39, 0.82);
}
</style>
