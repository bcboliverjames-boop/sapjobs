<template>
  <view class="page">
    <view class="page-header-unified">
      <view class="page-header-content">
        <view class="header-left" @tap="goBack">
          <uni-icons type="back" size="20" color="#F5F1E8" />
        </view>
        <text class="page-header-title">隐私政策</text>
        <view class="header-right"></view>
      </view>
    </view>
    <scroll-view class="content" scroll-y>
      <text class="h1">隐私政策</text>
      <text class="meta">最后更新：待填写</text>

      <view class="section">
        <text class="h2">1. 我们是谁</text>
        <text class="p">本网站提供 SAP 顾问需求信息的展示、发布与互动服务，同时提供若干效率工具（例如收入计算与工时导出）。</text>
      </view>

      <view class="section">
        <text class="h2">2. 我们收集哪些信息</text>
        <text class="p">为提供账户登录、内容发布与互动能力，我们可能会处理以下信息：</text>
        <view class="list">
          <text class="li">- 账号信息：你选择的登录方式所需的标识信息（如手机号/邮箱/用户名等，视你启用的登录方式而定）。</text>
          <text class="li">- 内容信息：你发布的需求内容、评论、私信等互动内容。</text>
          <text class="li">- 设备与日志信息：用于安全与故障排查的必要日志（可能包含设备型号、系统版本、访问时间等）。</text>
        </view>
      </view>

      <view class="section">
        <text class="h2">3. 信息如何使用</text>
        <view class="list">
          <text class="li">- 提供登录与身份校验</text>
          <text class="li">- 提供需求发布、浏览、检索与互动</text>
          <text class="li">- 安全风控、反垃圾、争议处理与问题排查</text>
        </view>
      </view>

      <view class="section">
        <text class="h2">4. 信息存储与共享</text>
        <text class="p">本网站可能使用第三方云服务（例如云开发 CloudBase）用于账号体系、数据库与存储能力。我们不会将你的个人信息出售给任何第三方。仅在法律法规要求或为提供服务所必需的范围内共享。</text>
      </view>

      <view class="section">
        <text class="h2">5. 你的权利</text>
        <view class="list">
          <text class="li">- 你可以申请更正或删除你发布的内容</text>
          <text class="li">- 你可以申请注销账号（如适用）</text>
          <text class="li">- 你可以就隐私相关问题联系我们</text>
        </view>
      </view>

      <view class="section">
        <text class="h2">6. 联系方式</text>
        <text class="p">如需咨询、删除、更正、注销账号或投诉举报，请前往“联系我们/投诉举报/注销与删除申请”页面。</text>
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
