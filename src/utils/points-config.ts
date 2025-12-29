/**
 * 积分系统配置
 * 所有积分相关的规则和阈值都在这里配置
 */

export interface PointsConfig {
  // 积分获取规则（加分）
  rewards: {
    register: number // 注册成功
    completeProfile: number // 完善个人资料（首次）
    publishDemand: number // 发布需求
    comment: number // 发表评论
    commentLiked: number // 评论被点赞（每次）
  }
  
  // 积分消耗规则（减分，暂未使用，预留）
  costs: {
    viewContact: number // 查看联系方式（暂未实现）
  }
  
  // 积分门槛
  thresholds: {
    viewContact: number // 查看发布者联系方式所需积分
  }
}

/**
 * 默认积分配置
 */
export const DEFAULT_POINTS_CONFIG: PointsConfig = {
  rewards: {
    register: 10, // 注册成功：+10 分
    completeProfile: 10, // 完善个人资料：+10 分
    publishDemand: 5, // 发布需求：+5 分
    comment: 1, // 发表评论：+1 分
    commentLiked: 1, // 评论被点赞：+1 分/次
  },
  costs: {
    viewContact: 0, // 查看联系方式：暂不扣分（预留）
  },
  thresholds: {
    viewContact: 30, // 查看联系方式需要 30 积分
  },
}

/**
 * 获取积分配置
 * 可以从环境变量或配置文件读取，目前使用默认配置
 */
export function getPointsConfig(): PointsConfig {
  // 可以从环境变量或配置文件读取
  // 例如：return JSON.parse(process.env.POINTS_CONFIG || '{}')
  return DEFAULT_POINTS_CONFIG
}

/**
 * 获取积分奖励值
 */
export function getRewardPoints(action: keyof PointsConfig['rewards']): number {
  const config = getPointsConfig()
  return config.rewards[action] || 0
}

/**
 * 获取积分消耗值
 */
export function getCostPoints(action: keyof PointsConfig['costs']): number {
  const config = getPointsConfig()
  return config.costs[action] || 0
}

/**
 * 获取积分门槛值
 */
export function getThresholdPoints(action: keyof PointsConfig['thresholds']): number {
  const config = getPointsConfig()
  return config.thresholds[action] || 0
}





























