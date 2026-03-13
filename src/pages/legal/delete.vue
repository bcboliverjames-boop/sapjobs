<template>
  <view class="page">
    <view class="card">
      <text class="h1">账号注销 / 个人信息删除申请</text>
      <text class="meta">通过邮箱提交申请，我们会在 1-3 个工作日内处理并回复</text>

      <view class="section">
        <text class="h2">1. 适用范围</text>
        <text class="p">你可以申请注销账号，或申请删除/更正与你相关的个人信息与发布内容。</text>
      </view>

      <view class="section">
        <text class="h2">2. 提交方式（邮箱）</text>
        <view class="row">
          <text class="mono">{{ CONTACT_EMAIL }}</text>
          <button class="btn" @click="copyEmail">复制</button>
        </view>
        <view class="actions">
          <button class="btn" @click="copyTemplate">复制申请模板</button>
          <button class="btn btn-ghost" @click="sendEmail">一键发邮件（H5）</button>
        </view>
      </view>

      <view class="section">
        <text class="h2">3. 建议提供的信息</text>
        <view class="list">
          <text class="li">- 申请类型：注销账号 / 删除个人信息 / 更正个人信息 / 删除发布内容</text>
          <text class="li">- 登录账号标识：手机号/邮箱/用户名（如有）</text>
          <text class="li">- 需要处理的页面链接/截图（如适用）</text>
          <text class="li">- 你的联系方式（便于回访）</text>
        </view>
      </view>

      <view class="section">
        <text class="h2">4. 处理说明</text>
        <text class="p">为保障账号与信息安全，我们可能需要你补充必要的身份核验信息。对于法律法规要求保留的记录，我们会在符合法律要求的前提下进行处理。</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CONTACT_EMAIL, SITE_NAME } from '../../config/site'

const copyEmail = () => {
  uni.setClipboardData({
    data: CONTACT_EMAIL,
    success: () => {
      uni.showToast({
        title: '已复制',
        icon: 'none',
      })
    },
  })
}

const requestTemplate = computed(() => {
  const lines: string[] = []
  lines.push(`【${SITE_NAME}｜账号注销/个人信息处理申请】`)
  lines.push('申请类型：注销账号 / 删除个人信息 / 更正个人信息 / 删除发布内容（请选择其一）')
  lines.push('登录账号标识：手机号/邮箱/用户名（如有）')
  lines.push('需要处理的内容：')
  lines.push('- 页面链接：')
  lines.push('- 截图/证据：（可选）')
  lines.push('说明：')
  lines.push('联系方式（便于回访）：')
  return lines.join('\n')
})

const copyTemplate = () => {
  uni.setClipboardData({
    data: requestTemplate.value,
    success: () => {
      uni.showToast({
        title: '已复制',
        icon: 'none',
      })
    },
  })
}

const sendEmail = () => {
  const subject = `${SITE_NAME} - 账号注销/个人信息处理申请`
  const body = requestTemplate.value

  // #ifdef H5
  const href = `mailto:${encodeURIComponent(CONTACT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.location.href = href
  // #endif

  // #ifndef H5
  uni.setClipboardData({
    data: `${CONTACT_EMAIL}\n\n${body}`,
    success: () => {
      uni.showToast({
        title: '邮箱与模板已复制',
        icon: 'none',
      })
    },
  })
  // #endif
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

.list {
  margin-top: 10rpx;
}

.li {
  display: block;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(17, 24, 39, 0.82);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 14rpx 16rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
  border-radius: 16rpx;
  background: rgba(245, 241, 232, 0.55);
}

.mono {
  font-size: 24rpx;
  color: rgba(17, 24, 39, 0.9);
  font-family: "Noto Sans SC", "Source Han Sans SC", sans-serif;
  letter-spacing: 0.2rpx;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
  margin-top: 14rpx;
}

.btn {
  font-size: 24rpx;
  padding: 16rpx 18rpx;
  border-radius: 16rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.12);
  background: #FFFFFF;
  color: rgba(17, 24, 39, 0.88);
}

.btn-ghost {
  border-color: rgba(244, 162, 89, 0.7);
  background: rgba(244, 162, 89, 0.12);
}
</style>
