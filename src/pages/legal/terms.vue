<template>
  <view class="page">
    <view class="page-header-unified">
      <view class="page-header-content">
        <view class="header-left" @tap="goBack">
          <uni-icons type="back" size="20" color="#F5F1E8" />
        </view>
        <text class="page-header-title">服务条款</text>
        <view class="header-right"></view>
      </view>
    </view>
    <scroll-view class="content" scroll-y>
      <text class="h1">用户协议</text>
      <text class="meta">最后更新：待填写</text>

      <view class="section">
        <text class="h2">1. 服务说明</text>
        <text class="p">本网站为 SAP 顾问需求信息的展示、发布与互动平台。你在使用本服务前应阅读并同意本协议。</text>
      </view>

      <view class="section">
        <text class="h2">2. 用户发布内容（UGC）规范</text>
        <text class="p">你承诺发布的信息真实、合法、不得侵犯任何第三方的合法权益，不得发布以下内容：</text>
        <view class="list">
          <text class="li">- 虚假招聘、诱导交易、诈骗信息</text>
          <text class="li">- 违法违规内容、涉黄涉赌涉毒、暴力恐怖等</text>
          <text class="li">- 恶意引流、垃圾广告、骚扰信息</text>
          <text class="li">- 未经授权披露他人隐私信息</text>
        </view>
      </view>

      <view class="section">
        <text class="h2">3. 账号与安全</text>
        <text class="p">你应妥善保管账号信息并对账号下的行为负责。如发现异常请及时联系我们。</text>
      </view>

      <view class="section">
        <text class="h2">4. 免责声明</text>
        <text class="p">本站内容仅作信息展示与沟通参考。任何合作与交易均由用户自行判断与承担风险。本站不对因第三方行为导致的损失承担责任。</text>
      </view>

      <view class="section">
        <text class="h2">5. 违规处理</text>
        <text class="p">如你违反本协议，我们有权对相关内容进行处理，并视情况限制或终止你使用本服务。</text>
      </view>

      <view class="section">
        <text class="h2">6. 联系方式</text>
        <text class="p">如对本协议有疑问或需要投诉举报，请前往“联系我们/投诉举报”页面。</text>
      </view>
    </scroll-view>
  </view>
</template>

<script>
const goBack = () => {
  try {
    const pages = (typeof getCurrentPages === 'function' ? getCurrentPages() : [])
    const current = pages && pages.length ? pages[pages.length - 1] : null
    const route = String(current && (current.route || ''))
    const isPlaza = /pages\/demand\/demand/i.test(route)
    uni.navigateBack({
      delta: 1,
      fail: () => {
        try {
          uni.reLaunch({ url: isPlaza ? '/pages/index/index' : '/pages/demand/demand' })
        } catch {
          try {
            uni.reLaunch({ url: '/pages/index/index' })
          } catch {}
        }
      },
    })
  } catch {
    try {
      uni.reLaunch({ url: '/pages/demand/demand' })
    } catch {
      try {
        uni.reLaunch({ url: '/pages/index/index' })
      } catch {}
    }
  }
}

onMounted(() => {
  // ...
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

.header-left, .header-right {
  width: 80rpx;
  display: flex;
  align-items: center;
}

.content {
  flex: 1;
  padding: 24rpx;
  background: #F5F1E8;
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
