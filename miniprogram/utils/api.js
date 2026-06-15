/**
 * 云函数调用封装
 */
const { ERR } = require('./constants');

/**
 * 通用云函数调用
 * @param {string} name 云函数名
 * @param {object} data 参数
 * @param {object} options 额外选项 { showLoading, loadingText, silentError }
 * @returns {Promise<object>}
 */
async function callFunction(name, data = {}, options = {}) {
  const { showLoading = true, loadingText = '处理中...', silentError = false } = options;

  if (showLoading) {
    wx.showLoading({ title: loadingText, mask: true });
  }

  try {
    const res = await wx.cloud.callFunction({ name, data });
    wx.hideLoading();

    if (res.result && res.result.code === ERR.SUCCESS) {
      return res.result;
    }

    if (!silentError) {
      const msg = res.result?.message || '操作失败，请重试';
      wx.showToast({ title: msg, icon: 'none', duration: 2000 });
    }
    return res.result;

  } catch (err) {
    wx.hideLoading();
    if (!silentError) {
      wx.showToast({ title: '网络异常，请重试', icon: 'none', duration: 2000 });
    }
    console.error(`[api] ${name} error:`, err);
    return { code: -1, message: err.message || 'network error' };
  }
}

module.exports = { callFunction };
