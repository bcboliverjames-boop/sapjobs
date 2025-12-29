# SAP 顾问需求网站

基于 UniApp 和腾讯云开发（CloudBase）的 SAP 顾问需求展示平台，用于整理和展示来自微信群/QQ群的 SAP 顾问招聘需求信息。

## 项目简介

本项目是一个 SAP 顾问需求信息聚合平台，主要功能包括：
- 📋 **需求广场**：卡片式展示 SAP 顾问需求，支持多条件筛选
- 🔍 **需求详情**：查看完整需求信息、结构化标签、信息提供者联系方式
- 💬 **评论互动**：支持评论、回复、点赞/踩功能
- 👤 **用户系统**：用户登录、个人资料、积分系统
- 🔒 **积分解锁**：通过积分解锁查看联系方式（待实现）

## 当前开发状态

### ✅ 已完成功能

#### 阶段1：需求展示
- ✅ 需求列表页（`pages/demand/demand.vue`）
  - 卡片式展示需求信息
  - 多条件筛选：模块、城市、工作方式、年限、周期、语言
  - 每条需求显示热门评论预览（最多10条，按点赞数排序）
  - 点击评论文字跳转到详情页
  
- ✅ 需求详情页（`pages/demand/detail.vue`）
  - 显示原始需求文本
  - 结构化信息标签展示
  - 信息提供者展示（含积分解锁提示）
  - 评论提交区域固定在顶部

#### 阶段2：评论互动
- ✅ 评论功能
  - 评论展示（按新评论优先、有新回复的评论优先排序）
  - 点赞/踩功能
  - 评论提交后显示在最前面（5分钟内的新评论）
  
- ✅ 回复功能
  - 支持对评论的回复
  - 回复列表展示
  - 回复输入框默认隐藏，点击"回复"按钮后显示
  - 回复提交后不重新排序，保持评论位置稳定
  
- ✅ UI 优化
  - 评论提交区域固定在顶部，方便用户提交
  - 回复输入框按需显示，界面更简洁
  - "回复"按钮使用深蓝色，提示可点击

### ✅ 已完成功能

- ✅ 用户登录/注册系统（基础框架完成，80%）
- ✅ 积分系统（100%完成，所有规则可配置）
- ✅ 联系方式解锁功能（100%完成）
- ✅ 需求发布功能（100%完成）
- ✅ 个人中心页面优化（100%完成，包含Tab切换）
- ✅ 私信功能（100%完成）
- ✅ 需求搜索功能（100%完成）
- ✅ 需求收藏功能（100%完成）

### 🚧 待优化功能

- ⏳ 用户登录/注册系统完善（注册流程优化）
- ⏳ 头像上传功能
- ⏳ 数据统计（发布数、评论数等）
- ⏳ 搜索历史记录
- ⏳ 私信通知推送

## 技术架构

基于 UniApp 和腾讯云开发（CloudBase）的跨平台应用，目前已适配 **H5** 、 **微信小程序** 、 **支付宝小程序** 、 **抖音小程序** 以及 **App (iOS/Android)**。

[![Powered by CloudBase](https://7463-tcb-advanced-a656fc-1257967285.tcb.qcloud.la/mcp/powered-by-cloudbase-badge.svg)](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)

> 本项目基于 [**CloudBase AI ToolKit**](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit) 开发，通过AI提示词和 MCP 协议+云开发，让开发更智能、更高效，支持AI生成全栈代码、一键部署至腾讯云开发（免服务器）、智能日志修复。

## 项目特点

- 🚀 基于 UniApp 构建，一套代码多端运行
- ⚡ 使用 Vue 3 Composition API 构建现代化 UI
- 🌐 目前支持 **H5** 、 **微信小程序** 、 **支付宝小程序** 、 **抖音小程序** 以及 **App (iOS/Android)** ，其他平台适配开发中
- 🎁 深度集成腾讯云开发 CloudBase，提供一站式后端云服务
- 🔧 自定义 UniApp 适配器，完美适配云开发能力
- 📱 完整的 TypeScript 支持，提供更好的开发体验

## 各平台展示效果

各平台展示如下：

 
 H5 端 | 微信小程序 |
|:---:|:---:|
| ![H5 端](https://qcloudimg.tencent-cloud.cn/raw/cec528e3e0d4dddadff11c66a11013cc.png) | ![微信小程序](https://qcloudimg.tencent-cloud.cn/raw/826666e480af55c2c886ffa1a451dea8.png) |

 支付宝小程序 | 抖音小程序 |
|:---:|:---:|
| ![支付宝小程序](https://qcloudimg.tencent-cloud.cn/raw/5fa5a46ae73b325bb1199b7e4059e480.png) | ![抖音小程序](https://qcloudimg.tencent-cloud.cn/raw/c4750c695aa81dab6cd3ef2de0aee8f0.png) |

 Android 和 iOS |
|:---:|
| <img src="https://qcloudimg.tencent-cloud.cn/raw/34cb2e31c0a667caf8396a2b12c87c94.jpg" width="50%"/> |



## 项目架构

### 前端架构

- **框架**：UniApp (基于 Vue 3)
- **构建工具**：Vite
- **多端支持**：H5、微信小程序、支付宝小程序、抖音小程序、App (iOS/Android)（其他平台适配开发中）
- **状态管理**：Vue 3 Reactivity API
- **类型支持**：TypeScript

### 云开发资源

本项目使用了以下腾讯云开发（CloudBase）资源：

- **身份认证**：用于用户登录和身份验证（匿名登录、手机验证码登录、邮箱验证码登录、手机号/用户名/邮箱密码登录、微信小程序 openId 静默登录）
- **云数据库**：用于存储应用数据
- **云函数**：用于实现业务逻辑
- **云托管**：用于实现业务逻辑
- **云存储**：用于存储文件
- **静态网站托管**：用于部署 H5 版本

## 目录结构

```
├── src/
│   ├── components/
│   │   ├── show-captcha.vue       # 登录验证弹窗组件
│   ├── pages/                     # 页面文件
│   │   ├── index/                 # 首页
│   │   │   ├── index.vue
│   │   │   └── index.json
│   │   ├── demand/                # 需求相关页面
│   │   │   ├── demand.vue        # 需求广场（列表页）
│   │   │   └── detail.vue        # 需求详情页
│   │   ├── demo/                  # 云开发演示页面
│   │   │   ├── demo.vue
│   │   │   └── demo.json
│   │   ├── login/
│   │   │   ├── index.vue          # 登录主页面
│   │   │   ├── phone-login.vue    # 手机验证码登录页面
│   │   │   ├── email-login.vue    # 邮箱验证码登录页面
│   │   │   └── password-login.vue # 密码登录页面
│   │   └── profile/               # 用户信息页面
│   │       └── profile.vue        # 用户信息查看页面              
│   ├── utils/                     # 工具函数和云开发初始化
│   │   ├── cloudbase.ts           # 云开发配置
│   │   ├── sap-demands.ts         # SAP 需求数据管理
│   │   ├── user.ts                # 用户资料管理
│   │   ├── comment-replies.ts     # 评论回复管理
│   │   └── index.ts               # 通用工具函数
│   ├── static/                    # 静态资源
│   ├── App.vue                    # 应用入口组件
│   ├── main.ts                    # 应用入口文件
│   ├── pages.json                 # 页面路由配置
│   └── manifest.json              # 应用配置文件
├── cloudfunctions/                # 云函数目录
│   └── hello/                     # 示例云函数
│       ├── index.js
│       └── package.json
├── docs/                          # 项目文档
│   ├── SAP jobs.plan.md          # 项目规划文档
│   └── sap-demand-site-mvp_0b6cea70.plan.md  # MVP 方案文档
├── index.html                     # H5 模板
├── vite.config.ts                 # Vite 配置
├── tsconfig.json                  # TypeScript 配置
├── package.json                   # 项目依赖
├── cloudbaserc.json               # CloudBase CLI 配置
└── README.md                      # 项目说明
```

## 数据库集合

项目使用 CloudBase NoSQL 数据库，主要集合：

- `sap_demands_raw` - 原始需求数据
- `sap_demand_comments` - 需求评论
- `sap_comment_replies` - 评论回复
- `users` - 用户资料（含积分信息）

## 开始使用

### VS Code 预览功能

本项目已配置 VS Code 预览功能，支持自动打开浏览器预览：

1. 在 VS Code 中打开项目
2. 项目会自动加载 `.vscode/preview.yml` 配置
3. 启动开发服务器后会自动打开浏览器预览页面
4. 默认端口：5173

配置文件位置：`.vscode/preview.yml`

<details>
<summary>前提条件</summary>

- 安装 Node.js (版本 16 或更高)
- 安装 HBuilderX 或其他支持 UniApp 的开发工具
- 腾讯云开发账号 (可在[腾讯云开发官网](https://tcb.cloud.tencent.com/)注册)

</details>

<details>
<summary>安装依赖</summary>

```bash
npm install
```

</details>

<details>
<summary>配置云开发环境</summary>

1. 打开 `src/utils/cloudbase.ts` 文件
2. 将 `ENV_ID` 变量的值修改为您的云开发环境 ID

```typescript
const ENV_ID = 'your-env-id'; // 替换为您的云开发环境ID
```

</details>

<details>
<summary>云开发环境配置</summary>

#### 1. 开启登录认证方式

在云开发控制台的【扩展能力】->【身份认证】->【登录方式】中开启
- 匿名登录
- 用户名密码登录
- 短信验证码登录
- 邮箱登录
- 微信小程序 openId 登录（需要先在【环境配置】->【小程序认证】中完成小程序认证）

#### 2. 配置安全域名（H5 端）

在云开发控制台的【环境配置】->【安全来源】->【安全域名】中添加：
- 开发域名：`http://localhost:5173`（本地开发）
- 生产域名：您的实际部署域名

#### 3. 配置安全域名（抖音小程序、支付宝小程序）
在云开发控制台的【环境配置】->【安全来源】->【安全域名】中添加域名：

- 抖音小程序开发域名：`tmaservice.developer.toutiao.com`
- 支付宝开发域名：`devappid.hybrid.alipay-eco.com`

#### 4. 配置微信小程序域名

在微信小程序管理后台的【开发】->【开发管理】->【开发设置】->【服务器域名】中配置：

**request 合法域名：**
```
https://tcb-api.tencentcloudapi.com
https://your-env-id.service.tcloudbase.com
```

**uploadFile 合法域名：**
```
https://cos.ap-shanghai.myqcloud.com
```

**downloadFile 合法域名：**
```
https://your-env-id.tcb.qcloud.la
https://cos.ap-shanghai.myqcloud.com
```


> 注意：请将 `your-env-id` 替换为您的实际环境 ID，地域根据您的云开发环境所在地域调整。

#### 5. **（仅 App 端需要）**配置安全应用来源
在云开发控制台的【环境配置】->【安全来源】->【移动应用安全来源】中添加应用：
- 应用标识：`your-appSign`
- 应用凭证：`your-appAccessKey`
在 `src/utils/cloudbase.ts` 文件中，找到 `appConfig` 对象，填入您获取到的凭证信息。

```typescript
const appConfig = {
    env: config.env || ENV_ID,
    timeout: config.timeout || 15000,
    appSign: 'your-appSign', // 应用标识
    appSecret: {
        appAccessKeyId: 1, // 凭证版本
        appAccessKey: 'your-appAccessKey' // 凭证
    }
```

</details>

<details>
<summary>本地开发</summary>

```bash
# H5 开发
npm run dev:h5

# 微信小程序开发
npm run dev:mp-weixin

# 抖音小程序开发
npm run dev:mp-toutiao

# 支付宝小程序开发
npm run dev:mp-alipay

# App (iOS/Android) 开发
# 1. 使用 HBuilderX 打开项目
# 2. 在顶部菜单栏选择【运行】->【运行到手机或模拟器】-> 选择您的设备

# 注意：目前仅支持 APP、H5、微信小程序、抖音小程序和支付宝小程序开发，其他平台适配开发中
```

</details>

<details>
<summary>构建生产版本</summary>

```bash
# 构建 H5 版本
npm run build:h5

# 构建微信小程序
npm run build:mp-weixin

# 构建抖音小程序
npm run build:mp-toutiao

# 构建支付宝小程序
npm run build:mp-alipay

# 注意：目前仅支持 H5 、微信小程序、抖音小程序和支付宝小程序构建，其他平台适配开发中
```

</details>

## 云开发使用示例

通过 `src/utils/cloudbase.ts` 访问云开发服务：

```typescript
import { app, ensureLogin } from './utils/cloudbase'

// 数据库操作
await ensureLogin();
const db = app.database();
const result = await db.collection('users').get(); // 查询数据
await db.collection('users').add({ name: 'test' }); // 添加数据

// 调用云函数
const funcResult = await app.callFunction({ name: 'hello' });

// 调用云托管
app.callContainer({
    name: 'helloworld',
    method: 'POST',
    path: '/abc',
    header:{
      'Content-Type': 'application/json; charset=utf-8'
    },
    data: {
      key1: 'test value 1',
      key2: 'test value 2'
    },
  }).then((res) => {
    console.log(res)
  });

// 文件上传
const uploadResult = await app.uploadFile({ cloudPath: 'test.jpg', filePath: file });

// 文件下载
cloudbase.downloadFile({
    fileID: "cloud://aa-99j9f/my-photo.png"
  }).then((res) => {});

```

## 部署指南

### 部署云函数

可以使用 CloudBase CLI 或 MCP 工具部署云函数：

```bash
# 使用 CloudBase CLI
tcb functions:deploy hello
```

### 部署到云开发静态网站托管（H5版本）

1. 构建 H5 版本：`npm run build:h5`
2. 登录腾讯云开发控制台
3. 进入您的环境 -> 静态网站托管
4. 上传 `dist/build/h5` 目录中的文件

### 微信小程序发布

1. 构建微信小程序版本：`npm run build:mp-weixin`
2. 使用微信开发者工具打开 `dist/build/mp-weixin` 目录
3. 上传代码包并发布

### 抖音小程序发布

1. 构建抖音小程序版本：`npm run build:mp-toutiao`
2. 使用抖音开发者工具打开 `dist/build/mp-toutiao` 目录
3. 上传代码包并发布

### 支付宝小程序发布

1. 构建支付宝小程序版本：`npm run build:mp-alipay`
2. 使用支付宝开发者工具打开 `dist/build/mp-alipay` 目录
3. 上传代码包并发布


## 平台适配状态

### ✅ 已适配平台

#### H5 端
- ✅ 完全支持所有云开发功能
- ✅ 支持本地开发和生产部署
- ✅ 已配置相关安全域名

#### 微信小程序
- ✅ 完全支持所有云开发功能
- ✅ 支持本地开发和发布
- ✅ 已配置相关域名白名单

#### 抖音小程序
- ✅ 完全支持所有云开发功能
- ✅ 支持本地开发和发布
- ✅ 已配置相关域名白名单

#### 支付宝小程序
- ✅ 完全支持所有云开发功能
- ✅ 支持本地开发和发布
- ✅ 已配置相关域名白名单

#### App 端 (iOS/Android)
- ✅ 完全支持所有云开发功能
- ✅ 支持通过 HBuilderX 进行本地开发
- ✅ 需要配置移动应用安全来源


### 🚧 开发中平台

#### 其他小程序平台
- 🚧 适配开发中

<!--
## 移动应用安全凭证配置

如果需要在 App 端使用，需要配置移动应用安全凭证：

1. 在云开发控制台【环境】->【安全配置】->【移动应用安全来源】中添加应用
2. 输入应用标识（如：`uni-app`）
3. 获取凭证信息
4. 在 `src/utils/cloudbase.ts` 中取消注释并配置：

```typescript
const config = {
  env: 'your-env-id',
  appSign: 'your-app-sign',
  appSecret: {
    appAccessKeyId: 1,
    appAccessKey: 'your-app-secret'
  }
};
```

-->

## 核心功能说明

### 需求广场（`/pages/demand/demand`）
- 卡片式展示 SAP 顾问需求
- 顶部筛选条支持：模块、城市、工作方式、年限、周期、语言
- 每条需求显示热门评论预览（横向滚动）
- 点击评论文字跳转到详情页

### 需求详情（`/pages/demand/detail`）
- 显示完整原始需求文本
- 结构化信息标签（模块、城市、周期、年限、语言等）
- 信息提供者展示（含积分解锁提示）
- 评论列表（新评论优先，有新回复的评论优先）
- 评论提交区域固定在顶部
- 支持点赞/踩、回复功能

### 评论系统
- **评论排序规则**：
  1. 新评论（5分钟内）显示在最前面
  2. 有新回复的评论（5分钟内有新回复）显示在第二位
  3. 其他评论按点赞数降序排序
  
- **回复功能**：
  - 回复输入框默认隐藏，点击"回复"按钮后显示
  - 回复提交后不重新排序，保持评论位置稳定
  - 回复立即显示在当前评论下方

## 功能演示

项目包含完整的云开发功能演示：

- **认证功能**: 匿名登录/退出、手机验证码登录、邮箱验证码登录、密码登录、微信小程序 openId 静默登录
- **云函数调用**: 调用示例云函数
- **云托管**: 调用云托管服务
- **数据库操作**: 增加和查询数据
- **数据库监听**: 实时监听数据变化
- **文件存储**: 上传和下载文件



## 使用 CloudBase CLI 部署

```bash
# 安装 CloudBase CLI
npm install -g @cloudbase/cli

# 登录
tcb login

# 部署到云开发
tcb framework deploy
```

## 技术栈

- **UniApp** - 跨平台应用开发框架
- **Vue 3** - 渐进式 JavaScript 框架
- **TypeScript** - JavaScript 的超集，提供类型支持
- **Vite** - 下一代前端构建工具
- **CloudBase JS SDK** - 腾讯云开发 JavaScript SDK

## 开发注意事项

1. **环境变量**: 确保正确配置云开发环境 ID
2. **安全域名**: 根据部署平台配置相应的安全域名
3. **权限配置**: 注意数据库集合的读写权限设置
4. **跨端兼容**: 部分 API 在不同平台表现可能不同，注意测试

## 相关链接

- [UniApp 官方文档](https://uniapp.dcloud.io/)
- [云开发官方文档](https://cloud.tencent.com/document/product/876)
- [云开发 JS SDK](https://docs.cloudbase.net/api-reference/webv3/initialization)
- [CloudBase AI ToolKit](https://github.com/TencentCloudBase/CloudBase-AI-ToolKit)

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进这个模板！

## 许可证

MIT License
