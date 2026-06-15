/**
 * MenuOrder 常量定义
 */

// 菜品分类
const CATEGORIES = [
  { key: 'breakfast', label: '早餐', icon: '☀️' },
  { key: 'dinner', label: '晚餐', icon: '🌙' },
  { key: 'snack', label: '零食', icon: '🍿' },
  { key: 'drink', label: '饮品', icon: '🧃' }
];

// 订单状态
const ORDER_STATUS = {
  placed: { label: '已下单', class: 'placed', key: 'placed' },
  accepted: { label: '已接单', class: 'accepted', key: 'accepted' },
  completed: { label: '已完成', class: 'completed', key: 'completed' },
  cancelled: { label: '已取消', class: 'cancelled', key: 'cancelled' }
};

// 评分奖励规则
const RATING_BONUS = {
  5: 200,
  4: 100,
  3: 50,
  2: 0,
  1: 0
};

// 菜单默认过期时间（24小时 = 86400000ms）
const DEFAULT_MENU_EXPIRY_MS = 24 * 60 * 60 * 1000;

// 密码验证
const MAX_PASSWORD_ATTEMPTS = 3;
const PASSWORD_LOCKOUT_MS = 30 * 1000;

// H币
const MONTHLY_COIN_ALLOWANCE = 10000;
const CHEF_INITIAL_BALANCE = 0;

// 评分过期天数
const RATING_EXPIRY_DAYS = 7;

// 云函数名称
const CF = {
  LOGIN: 'login',
  MENU: 'menu',
  ORDER: 'order',
  RATING: 'rating',
  SCHEDULE: 'schedule'
};

// 自定义错误码
const ERR = {
  SUCCESS: 0,
  INSUFFICIENT_COINS: 40001,
  INVALID_STATE: 40002,
  PERMISSION_DENIED: 40003,
  RATING_EXPIRED: 40004,
  ALREADY_RATED: 40005,
  EMPTY_CART: 40006,
  WRONG_PASSWORD: 40007,
  MENU_EXPIRED: 40008,
  TRANSACTION_FAILED: 50001
};

module.exports = {
  CATEGORIES,
  ORDER_STATUS,
  RATING_BONUS,
  DEFAULT_MENU_EXPIRY_MS,
  MAX_PASSWORD_ATTEMPTS,
  PASSWORD_LOCKOUT_MS,
  MONTHLY_COIN_ALLOWANCE,
  CHEF_INITIAL_BALANCE,
  RATING_EXPIRY_DAYS,
  CF,
  ERR
};
