<template>
  <view class="container">
    <view class="header">
      <text class="title">云开发功能演示</text>
      <text class="subtitle">CloudBase Demo</text>
    </view>

    <!-- 环境状态 -->
    <view class="section">
      <view class="section-title">环境状态</view>
      <view class="status-card" :class="{ 'status-error': !envValid }">
        <text class="status-text">{{ envStatus }}</text>
      </view>
    </view>

    <!-- 认证功能 -->
    <view class="section">
      <view class="section-title">身份认证</view>
      <view class="auth-info">
        <text class="auth-text">登录状态: {{ loginStatus }}</text>
      </view>
      <view class="button-group">
        <button class="btn btn-primary" @click="handleLogin" :disabled="loading">
          {{ loginStatus === '已登录' ? '重新登录' : '跳转登录' }}
        </button>
        <button class="btn btn-secondary" @click="handleLogout" :disabled="loading">
          退出登录
        </button>
      </view>
    </view>

    <!-- 云函数调用 -->
    <view class="section">
      <view class="section-title">云函数调用</view>
      <button class="btn btn-primary" @click="callCloudFunction" :disabled="loading">
        调用 hello 函数
      </button>
      <view v-if="functionResult" class="result-card">
        <text class="result-title">函数返回结果:</text>
        <text class="result-text">{{ functionResult }}</text>
      </view>
    </view>

    <!-- 调用云托管服务 -->
    <view class="section">
      <view class="section-title">云托管服务</view>
      <button class="btn btn-primary" @click="callCloudRunFunction" :disabled="loading">
        调用云托管服务
      </button>
      <view v-if="cloudrunResult" class="result-card">
        <text class="result-title">服务返回结果:</text>
        <text class="result-text">{{ cloudrunResult }}</text>
      </view>
    </view>

    <!-- 数据库操作 -->
    <view class="section">
      <view class="section-title">数据库操作</view>
      <view class="input-group">
        <input 
          class="input" 
          v-model="newRecord" 
          placeholder="输入要添加的数据"
          :disabled="loading"
        />
        <button class="btn btn-primary" @click="addRecord" :disabled="loading">
          添加数据
        </button>
      </view>
      <button class="btn btn-secondary" @click="queryRecords" :disabled="loading">
        查询数据
      </button>
      <view v-if="records.length > 0" class="records-list">
        <text class="result-title">数据库记录:</text>
        <view v-for="(record, index) in records" :key="index" class="record-item">
          <text class="record-text">{{ record.content }} ({{ record.createTime }})</text>
        </view>
      </view>
    </view>

    <!-- 数据库监听(websoket测试) -->
    <view class="section">
      <view class="section-title">数据库监听</view>
      <button class="btn btn-primary" @click="startListening" :disabled="loading">
        开始监听
      </button>
      <button class="btn btn-secondary" @click="stopListening" :disabled="loading || !watcher">
        停止监听
      </button>
      <view v-if="realtimeRecord" class="result-card">
        <text class="result-title">实时数据记录:</text>
        <text class="result-text">{{ realtimeRecord }}</text>
      </view>
    </view>

    <!-- 文件上传 -->
    <view class="section">
      <view class="section-title">文件上传</view>
      <button class="btn btn-primary" @click="chooseAndUploadFile" :disabled="loading">
        选择并上传文件
      </button>
      <view v-if="uploadProgress > 0 && uploadProgress < 100" class="progress-bar">
        <view class="progress-fill" :style="{ width: uploadProgress + '%' }"></view>
        <text class="progress-text">{{ uploadProgress }}%</text>
      </view>
      <view v-if="uploadResult" class="result-card">
        <text class="result-title">上传结果:</text>
        <text class="result-text">{{ uploadResult }}</text>
      </view>
    </view>

    <!-- 文件下载 -->
    <view class="section">
      <view class="section-title">文件下载</view>
      <button class="btn btn-primary" @click="downloadFile" :disabled="loading">
        下载文件
      </button>
      <view v-if="downloadResult" class="result-card">
        <text class="result-title">下载结果:</text>
        <text class="result-text">{{ downloadResult }}</text>
      </view>
      <view v-if="imageSrc" class="result-card">
        <image :src="imageSrc" mode="widthFix" class="downloaded-image"></image>
      </view>
    </view>

    <!-- 加载状态 -->
    <view v-if="loading" class="loading-overlay">
      <view class="loading-spinner"></view>
      <text class="loading-text">处理中...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

const envValid = ref(false)
const envStatus = ref('CloudBase 演示已下线')
const loginStatus = ref('不可用')
const loading = ref(false)
const functionResult = ref('')
const newRecord = ref('')
const records = ref<any[]>([])
const uploadProgress = ref(0)
const uploadResult = ref('')
const downloadResult = ref('')
const imageSrc = ref('')
let watcher: any = null
const realtimeRecord = ref('')
let isListening = false
const cloudrunResult = ref('')

const notifyOffline = () => {
  uni.showToast({ title: 'CloudBase 演示已下线', icon: 'none' })
}

onMounted(() => {
  envValid.value = false
  envStatus.value = 'CloudBase 演示已下线'
  loginStatus.value = '不可用'
})

// 处理登录
const handleLogin = async () => {
  notifyOffline()
  uni.navigateTo({ url: '/pages/login/password-login' })
}

// 处理退出登录
const handleLogout = async () => {
  notifyOffline()
}

// 调用云函数
const callCloudFunction = async () => {
  notifyOffline()
  functionResult.value = 'CloudBase 演示已下线'
}

// 调用云托管服务
const callCloudRunFunction = async () => {
  notifyOffline()
  cloudrunResult.value = 'CloudBase 演示已下线'
}

// 添加数据
const addRecord = async () => {
  notifyOffline()
  records.value = []
  uni.showToast({ title: 'CloudBase 演示已下线', icon: 'none' })
}

// 查询数据
const queryRecords = async () => {
  notifyOffline()
  records.value = []
}

// 实时监听数据变化
const startListening = async() => {
  notifyOffline()
  realtimeRecord.value = ''
  if (watcher) {
    try {
      watcher.close()
    } catch {}
    watcher = null
  }
  isListening = false
}
// 停止监听
const stopListening = () => {
  if (watcher) {
    try {
      watcher.close()
    } catch {}
  }
  watcher = null
  isListening = false
  realtimeRecord.value = ''
  notifyOffline()
}		
		
// 选择并上传文件
const chooseAndUploadFile = async () => {
  notifyOffline()
  uploadProgress.value = 0
  uploadResult.value = 'CloudBase 演示已下线'
}

// 下载文件
const downloadFile = async () => {
  notifyOffline()
  downloadResult.value = 'CloudBase 演示已下线'
  imageSrc.value = ''
}


</script>

<style scoped>
.container {
  padding: 20rpx;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.header {
  text-align: center;
  margin-bottom: 40rpx;
}

.title {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.subtitle {
  font-size: 28rpx;
  color: #666;
  margin-top: 10rpx;
  display: block;
}

.section {
  background: white;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 30rpx;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.section-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.status-card {
  padding: 20rpx;
  border-radius: 12rpx;
  background-color: #e8f5e8;
  border: 2rpx solid #4caf50;
}

.status-card.status-error {
  background-color: #ffeaea;
  border-color: #f44336;
}

.status-text {
  color: #333;
  font-size: 28rpx;
}

.auth-info {
  margin-bottom: 20rpx;
}

.auth-text {
  font-size: 28rpx;
  color: #666;
}

.button-group {
  display: flex;
  gap: 20rpx;
}

.btn {
  padding: 20rpx 40rpx;
  border-radius: 12rpx;
  border: none;
  font-size: 28rpx;
  flex: 1;
}

.btn-primary {
  background-color: #007aff;
  color: white;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
}

.btn:disabled {
  opacity: 0.5;
}

.input-group {
  display: flex;
  gap: 20rpx;
  margin-bottom: 20rpx;
}

.input {
  flex: 1;
  padding: 20rpx;
  border: 2rpx solid #ddd;
  border-radius: 12rpx;
  font-size: 28rpx;
}

.result-card {
  margin-top: 20rpx;
  padding: 20rpx;
  background-color: #f8f9fa;
  border-radius: 12rpx;
  border: 2rpx solid #e9ecef;
}

.result-title {
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 10rpx;
}

.result-text {
  color: #666;
  font-size: 24rpx;
  word-break: break-all;
}

.records-list {
  margin-top: 20rpx;
}

.record-item {
  padding: 15rpx;
  background-color: #f8f9fa;
  border-radius: 8rpx;
  margin-bottom: 10rpx;
}

.record-text {
  font-size: 26rpx;
  color: #333;
}

.progress-bar {
  position: relative;
  height: 40rpx;
  background-color: #f0f0f0;
  border-radius: 20rpx;
  margin: 20rpx 0;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: #007aff;
  transition: width 0.3s ease;
}

.progress-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 24rpx;
  color: #333;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 9999;
}

.loading-spinner {
  width: 60rpx;
  height: 60rpx;
  border: 4rpx solid #f3f3f3;
  border-top: 4rpx solid #007aff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-text {
  color: white;
  font-size: 28rpx;
  margin-top: 20rpx;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
