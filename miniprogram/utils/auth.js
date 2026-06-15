/**
 * 微信登录 & 用户信息
 */
const { callFunction } = require('./api');
const { CF } = require('./constants');

/**
 * 登录并获取用户信息
 * @returns {Promise<object|null>} user info or null on failure
 */
async function login() {
  try {
    // 已登录则直接返回缓存
    const app = getApp();
    if (app.globalData.openid) {
      return {
        openid: app.globalData.openid,
        nickname: app.globalData.userInfo?.nickName || '',
        avatarUrl: app.globalData.userInfo?.avatarUrl || '',
        coinBalance: app.globalData.coinBalance,
        role: app.globalData.role
      };
    }

    const res = await callFunction(CF.LOGIN, {}, { loadingText: '登录中...' });
    if (res && res.code === 0 && res.data) {
      const { openid, nickname, avatarUrl, coinBalance, role, isNewUser } = res.data;

      app.globalData.openid = openid;
      app.globalData.coinBalance = coinBalance;
      app.globalData.role = role || '';
      app.globalData.userInfo = { nickName: nickname, avatarUrl };

      // 新用户获取微信头像/昵称
      if (isNewUser && wx.getUserProfile) {
        // getUserProfile 需要用户主动触发，此处仅记录
      }

      return res.data;
    }
    return null;
  } catch (err) {
    console.error('[auth] login error:', err);
    return null;
  }
}

/**
 * 刷新余额
 */
async function refreshBalance() {
  const res = await callFunction(CF.LOGIN, {}, { showLoading: false, silentError: true });
  if (res && res.code === 0 && res.data) {
    getApp().globalData.coinBalance = res.data.coinBalance;
    return res.data.coinBalance;
  }
  return getApp().globalData.coinBalance;
}

module.exports = { login, refreshBalance };
