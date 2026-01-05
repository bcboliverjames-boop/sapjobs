<template>
  <view class="page">
    <view class="header">
      <text class="title">{{ otherNickname }}</text>
    </view>
    
    <scroll-view class="content" scroll-y :scroll-top="scrollTop" scroll-with-animation>
      <view v-if="loading" class="loading">
        <text class="loading-text">加载中...</text>
      </view>
      
      <view v-else class="message-list">
        <view
          v-for="msg in messages"
          :key="msg._id"
          class="message-item"
          :class="{ 'message-item--sent': msg.from_user_id === currentUserId }"
        >
          <view class="message-bubble">
            <text class="message-content">{{ msg.content }}</text>
            <text class="message-time">{{ formatMessageTime(msg.createdAt) }}</text>
          </view>
        </view>
      </view>
    </scroll-view>
    
    <view class="input-area">
      <textarea
        class="message-input"
        v-model="inputContent"
        placeholder="输入消息..."
        :maxlength="500"
        auto-height
        @confirm="sendMessage"
      />
      <button class="send-btn" @click="sendMessage" :disabled="sending || !inputContent.trim()">
        {{ sending ? '发送中...' : '发送' }}
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { app, requireNonGuest } from '../../utils/cloudbase'
import { sendMessage as sendMessageApi, getMessagesWithUser } from '../../utils/messages'

const otherUserId = ref('')
const otherNickname = ref('')
const currentUserId = ref('')
const loading = ref(true)
const messages = ref<any[]>([])
const inputContent = ref('')
const sending = ref(false)
const scrollTop = ref(0)

onLoad(async (options) => {
  const userId = (options as any)?.userId
  const nickname = decodeURIComponent((options as any)?.nickname || '未知用户')
  
  if (!userId) {
    uni.showToast({ title: '参数错误', icon: 'none' })
    setTimeout(() => {
      uni.navigateBack()
    }, 1500)
    return
  }
  
  otherUserId.value = userId
  otherNickname.value = nickname
  
  try {
    const state: any = await requireNonGuest()
    currentUserId.value = String(state?.user?.uid || '')
    if (!currentUserId.value) throw new Error('UNAUTHORIZED')
    
    await loadMessages()
  } catch (e) {
    console.error('初始化失败:', e)
    return
  }
})

const loadMessages = async () => {
  if (!otherUserId.value) return
  
  loading.value = true
  try {
    messages.value = await getMessagesWithUser(otherUserId.value)
    await nextTick()
    scrollToBottom()
  } catch (e) {
    console.error('加载消息失败:', e)
    uni.showToast({ title: '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

const sendMessage = async () => {
  const content = inputContent.value.trim()
  if (!content || !otherUserId.value || sending.value) return
  
  sending.value = true
  try {
    await sendMessageApi(otherUserId.value, content)
    inputContent.value = ''
    await loadMessages()
    scrollToBottom()
  } catch (e: any) {
    console.error('发送消息失败:', e)
    const msg = String(e?.message || '')
    if (msg.includes('GUEST_READONLY')) {
      return
    }
    uni.showToast({ title: msg || '发送失败', icon: 'none' })
  } finally {
    sending.value = false
  }
}

const scrollToBottom = () => {
  nextTick(() => {
    scrollTop.value = 99999
  })
}

const formatMessageTime = (timestamp: any) => {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch (e) {
    return ''
  }
}
</script>

<style scoped lang="scss">
.page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: linear-gradient(135deg, #0b1924 0%, #1b2a38 45%, #101820 100%);
}

.header {
  padding: 24rpx;
  background: rgba(11, 25, 36, 0.8);
  border-bottom: 1rpx solid rgba(255, 255, 255, 0.1);
}

.title {
  font-size: 32rpx;
  font-weight: 600;
  color: #fdf9f0;
}

.content {
  flex: 1;
  padding: 20rpx;
}

.loading {
  text-align: center;
  padding: 60rpx 20rpx;
}

.loading-text {
  font-size: 28rpx;
  color: #94a3b8;
}

.message-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.message-item {
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
}

.message-item--sent {
  justify-content: flex-end;
}

.message-bubble {
  max-width: 70%;
  padding: 16rpx 20rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.2);
}

.message-item--sent .message-bubble {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-color: transparent;
}

.message-content {
  font-size: 26rpx;
  color: #e4edf7;
  line-height: 1.6;
  word-break: break-word;
  display: block;
  margin-bottom: 8rpx;
}

.message-time {
  font-size: 20rpx;
  color: #94a3b8;
  display: block;
}

.message-item--sent .message-time {
  color: rgba(255, 255, 255, 0.8);
}

.input-area {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  padding: 16rpx 20rpx;
  background: rgba(11, 25, 36, 0.9);
  border-top: 1rpx solid rgba(255, 255, 255, 0.1);
  gap: 12rpx;
}

.message-input {
  flex: 1;
  min-height: 60rpx;
  max-height: 200rpx;
  padding: 16rpx 20rpx;
  background: rgba(255, 255, 255, 0.1);
  border: 1rpx solid rgba(255, 255, 255, 0.2);
  border-radius: 24rpx;
  font-size: 26rpx;
  color: #e4edf7;
}

.send-btn {
  padding: 16rpx 32rpx;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  border-radius: 24rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #fff;
}

.send-btn:disabled {
  opacity: 0.5;
}
</style>





























