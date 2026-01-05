<template>
  <view class="page">
    <view class="card">
      <text class="h1">投诉举报</text>
      <text class="meta">用于举报虚假需求、骚扰私信、违法违规内容等</text>

      <view class="section">
        <text class="h2">在线提交</text>

        <view class="field">
          <text class="label">举报类型</text>
          <picker mode="selector" :range="categoryOptions" :value="categoryIndex" @change="onCategoryPick">
            <view class="picker">{{ categoryOptions[categoryIndex] }}</view>
          </picker>
        </view>

        <view class="field">
          <text class="label">具体说明</text>
          <textarea class="textarea" v-model="description" auto-height placeholder="请描述问题、上下文、证据等" />
        </view>

        <view class="field">
          <text class="label">联系方式（可选）</text>
          <input class="input" v-model="contact" placeholder="邮箱/微信/手机号（可选）" />
        </view>

        <button class="btn" :disabled="submitting" @click="submitReport">
          {{ submitting ? '提交中...' : '提交举报' }}
        </button>
      </view>

      <view class="section">
        <text class="h2">如何举报</text>
        <text class="p">你可以通过“联系我们”页提供的邮箱（{{ CONTACT_EMAIL }}）进行举报。为提高处理效率，建议在邮件中包含以下信息：</text>
        <view class="list">
          <text class="li">- 被举报内容的页面路径/截图</text>
          <text class="li">- 相关账号或昵称（如有）</text>
          <text class="li">- 你认为违规的具体原因</text>
          <text class="li">- 你的联系方式（便于补充核实）</text>
        </view>
      </view>

      <view class="section">
        <text class="h2">快速生成举报信息</text>
        <text class="p">我们已为你生成一段可直接粘贴的举报模板。你可以复制后通过邮箱发送。</text>

        <view class="template-box">
          <textarea class="template-text" :value="reportTemplate" disabled auto-height />
        </view>

        <view class="actions">
          <button class="btn" @click="copyTemplate">复制举报模板</button>
          <button class="btn btn-ghost" @click="sendEmail">一键发邮件（H5）</button>
        </view>
      </view>

      <view class="section">
        <text class="h2">处理流程</text>
        <view class="list">
          <text class="li">- 受理：登记并确认信息完整性</text>
          <text class="li">- 复核：核验内容与上下文</text>
          <text class="li">- 处理：删除/屏蔽/限制账号等</text>
          <text class="li">- 反馈：如你留下联系方式，我们会同步处理结果</text>
        </view>
      </view>

      <view class="section">
        <button class="btn" @click="goToContact">前往联系我们</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { CONTACT_EMAIL } from '../../config/site'
import { onLoad } from '@dcloudio/uni-app'
import { computed, ref } from 'vue'
import { app, requireNonGuest } from '../../utils/cloudbase'
import { getOrCreateUserProfile } from '../../utils/user'

const goToContact = () => {
  uni.navigateTo({
    url: '/pages/legal/contact'
  })
}

const demandId = ref('')
const pageHref = ref('')

const categoryOptions = ['虚假/诈骗', '骚扰', '违法违规', '侵权', '其他']
const categoryIndex = ref(0)
const description = ref('')
const contact = ref('')
const submitting = ref(false)

onLoad((options) => {
  const id = (options && (options as any).demandId) as string | undefined
  demandId.value = id || ''

  const sourceUrl = (options && (options as any).sourceUrl) as string | undefined
  if (sourceUrl) {
    pageHref.value = sourceUrl
    return
  }

  // #ifdef H5
  pageHref.value = window.location.href
  // #endif
})

const onCategoryPick = (e: any) => {
  const idx = Number((e && e.detail && e.detail.value) || 0)
  categoryIndex.value = Number.isFinite(idx) ? idx : 0
}

const submitReport = async () => {
  if (submitting.value) return
  const desc = String(description.value || '').trim()
  if (!desc) {
    uni.showToast({ title: '请填写具体说明', icon: 'none' })
    return
  }

  submitting.value = true
  try {
    await requireNonGuest()
    const profile = await getOrCreateUserProfile()
    const db = app.database()

    await db.collection('ugc_reports').add({
      category: categoryOptions[categoryIndex.value] || '其他',
      description: desc,
      contact: String(contact.value || '').trim(),
      target_type: 'demand',
      target_id: String(demandId.value || '').trim(),
      page_url: String(pageHref.value || '').trim(),
      reporter_user_id: String(profile.uid || '').trim(),
      reporter_nickname: String(profile.nickname || '').trim(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    description.value = ''
    contact.value = ''
    uni.showToast({ title: '已提交', icon: 'none' })
  } catch (e: any) {
    uni.showToast({ title: e?.message || '提交失败', icon: 'none' })
  } finally {
    submitting.value = false
  }
}

const reportTemplate = computed(() => {
  const lines: string[] = []
  lines.push('【投诉举报模板】')
  if (demandId.value) {
    lines.push(`需求ID：${demandId.value}`)
  } else {
    lines.push('需求ID：（可不填）')
  }
  if (pageHref.value) {
    lines.push(`页面链接：${pageHref.value}`)
  } else {
    lines.push('页面链接：（可补充截图或链接）')
  }
  lines.push('违规类型：虚假/诈骗/骚扰/违法违规/其他（请填写）')
  lines.push('具体说明：')
  lines.push('证据材料：截图/聊天记录/其他（可选）')
  lines.push('你的联系方式：')
  return lines.join('\n')
})

const copyTemplate = () => {
  uni.setClipboardData({
    data: reportTemplate.value,
    success: () => {
      uni.showToast({ title: '已复制', icon: 'none' })
    },
  })
}

const sendEmail = () => {
  const subject = demandId.value ? `投诉举报 - 需求ID ${demandId.value}` : '投诉举报'
  const body = reportTemplate.value

  // #ifdef H5
  const href = `mailto:${encodeURIComponent(CONTACT_EMAIL)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  window.location.href = href
  // #endif

  // #ifndef H5
  uni.setClipboardData({
    data: `${CONTACT_EMAIL}\n\n${body}`,
    success: () => {
      uni.showToast({ title: '邮箱与模板已复制', icon: 'none' })
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

.field {
  margin-top: 14rpx;
}

.label {
  display: block;
  font-size: 24rpx;
  font-weight: 800;
  margin-bottom: 10rpx;
  color: rgba(17, 24, 39, 0.85);
}

.input {
  width: 100%;
  padding: 16rpx;
  border-radius: 18rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
  background: #FFFFFF;
  font-size: 24rpx;
}

.textarea {
  width: 100%;
  padding: 16rpx;
  border-radius: 18rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
  background: #FFFFFF;
  font-size: 24rpx;
  line-height: 1.65;
}

.picker {
  width: 100%;
  padding: 16rpx;
  border-radius: 18rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
  background: #FFFFFF;
  font-size: 24rpx;
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

.btn {
  width: 100%;
  padding: 18rpx 22rpx;
  border-radius: 18rpx;
  background: #D97706;
  color: #111827;
  font-size: 26rpx;
  font-weight: 800;
}

.btn-ghost {
  margin-top: 14rpx;
  background: #0B1924;
  color: #F5F1E8;
}

.template-box {
  margin-top: 12rpx;
  border-radius: 18rpx;
  border: 2rpx solid rgba(17, 24, 39, 0.08);
  background: rgba(245, 241, 232, 0.65);
  padding: 16rpx;
}

.template-text {
  width: 100%;
  font-size: 24rpx;
  line-height: 1.65;
  color: rgba(17, 24, 39, 0.82);
}

.actions {
  margin-top: 14rpx;
}
</style>
