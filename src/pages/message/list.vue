<template>
  <view class="page">
    <view class="header">
      <text class="title">我的私信</text>
    </view>
    
    <scroll-view class="content" scroll-y>
      <view v-if="loading" class="loading">
        <text class="loading-text">加载中...</text>
      </view>
      
      <view v-else-if="conversations.length === 0" class="empty">
        <text class="empty-text">还没有私信</text>
      </view>
      
      <view v-else class="conversation-list">
        <view
          v-for="conv in conversations"
          :key="conv.other_user_id"
          class="conversation-item"
          @tap="goToChat(conv.other_user_id, conv.other_user?.nickname || '未知用户')"
        >
          <view class="conversation-avatar">
            <text class="avatar-text">{{ (conv.other_user?.nickname || '未')[0] }}</text>
          </view>
          <view class="conversation-content">
            <view class="conversation-header">
              <text class="conversation-name">{{ conv.other_user?.nickname || '未知用户' }}</text>
              <text class="conversation-time">{{ formatTime(conv.last_message.createdAt) }}</text>
            </view>
            <text class="conversation-preview">{{ conv.last_message.content }}</text>
            <view v-if="conv.unread_count > 0" class="unread-badge">
              <text class="unread-text">{{ conv.unread_count }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getConversations } from '../../utils/messages'
import { navigateTo } from '../../utils'

const loading = ref(true)
const conversations = ref<any[]>([])

const loadConversations = async () => {
  loading.value = true
  try {
    conversations.value = await getConversations()
  } catch (e) {
    console.error('加载对话列表失败:', e)
    conversations.value = []
  } finally {
    loading.value = false
  }
}

const formatTime = (timestamp: any) => {
  if (!timestamp) return ''
  try {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return date.toLocaleDateString('zh-CN')
  } catch (e) {
    return ''
  }
}

const goToChat = (userId: string, nickname: string) => {
  navigateTo(`/pages/message/chat?userId=${userId}&nickname=${encodeURIComponent(nickname)}`)
}

onMounted(() => {
  loadConversations()
})
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
  font-size: 36rpx;
  font-weight: 700;
  color: #fdf9f0;
}

.content {
  flex: 1;
  padding: 16rpx;
}

.loading, .empty {
  text-align: center;
  padding: 60rpx 20rpx;
}

.loading-text, .empty-text {
  font-size: 28rpx;
  color: #94a3b8;
}

.conversation-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}

.conversation-item {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 20rpx;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 16rpx;
  border: 1rpx solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s;
}

.conversation-item:active {
  background: rgba(255, 255, 255, 0.1);
  transform: scale(0.98);
}

.conversation-avatar {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20rpx;
}

.avatar-text {
  font-size: 32rpx;
  font-weight: 600;
  color: #fff;
}

.conversation-content {
  flex: 1;
  position: relative;
}

.conversation-header {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.conversation-name {
  font-size: 28rpx;
  font-weight: 600;
  color: #e4edf7;
}

.conversation-time {
  font-size: 22rpx;
  color: #94a3b8;
}

.conversation-preview {
  font-size: 24rpx;
  color: #cbd5f5;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 500rpx;
}

.unread-badge {
  position: absolute;
  right: 0;
  top: 0;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 12rpx;
  background: #ef4444;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.unread-text {
  font-size: 20rpx;
  color: #fff;
  font-weight: 600;
}
</style>





























