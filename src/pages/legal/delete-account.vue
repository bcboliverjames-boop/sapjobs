<template>
  <view class="page">
    <view class="page-header-unified">
      <view class="page-header-content">
        <view class="header-left">
          <uni-icons type="back" size="20" color="#F5F1E8" />
        </view>
        <text class="page-header-title">注销与删除申请</text>
        <view class="header-right"></view>
      </view>
    </view>
    <view class="content">
      <text class="loading-text">正在跳转...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onLoad } from '@dcloudio/uni-app'

onLoad(() => {
  try {
    uni.redirectTo({
      url: '/pages/legal/account-delete',
      fail: () => {
        try {
          uni.reLaunch({ url: '/pages/legal/account-delete' })
        } catch {}
      },
    })
  } catch {
    try {
      uni.reLaunch({ url: '/pages/legal/account-delete' })
    } catch {}
  }
})
</script>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #F5F1E8;
  padding: 0;
}

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

.header-left,
.header-right {
  width: 80rpx;
  display: flex;
  align-items: center;
}

.content {
  flex: 1;
  padding: 24rpx;
}

.loading-text {
  display: block;
  color: rgba(17, 24, 39, 0.7);
  font-size: 26rpx;
}
</style>
