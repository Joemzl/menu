const { login } = require('./utils/auth');

App({
  globalData: {
    userInfo: null,
    openid: '',
    coinBalance: 0,
    role: ''
  },

  async onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }
    wx.cloud.init({
      env: 'menu-order-dev',
      traceUser: true
    });

    await login();
  }
});
