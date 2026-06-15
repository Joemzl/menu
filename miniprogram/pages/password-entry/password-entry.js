const { callFunction } = require('../../utils/api');
const { CF, MAX_PASSWORD_ATTEMPTS, PASSWORD_LOCKOUT_MS } = require('../../utils/constants');

Page({
  data: {
    menuId: '',
    password: '',
    attempts: 0,
    locked: false,
    lockSeconds: 0,
    errorMsg: ''
  },

  onLoad(options) {
    this.setData({ menuId: options.menuId || '' });
  },

  onKeyTap(e) {
    if (this.data.locked) return;
    const key = e.currentTarget.dataset.key;
    let { password, errorMsg } = this.data;

    if (key === 'del') {
      password = password.slice(0, -1);
    } else if (password.length < 4) {
      password += key;
    }

    this.setData({ password, errorMsg: '' });

    if (password.length === 4) {
      this.verifyPassword(password);
    }
  },

  async verifyPassword(pwd) {
    const res = await callFunction(CF.MENU, {
      action: 'verifyPassword',
      menuId: this.data.menuId,
      password: pwd
    }, { loadingText: '验证中...' });

    if (res.code === 0) {
      wx.navigateTo({ url: `/pages/menu/menu?menuId=${this.data.menuId}` });
    } else if (res.code === 40007) {
      const remaining = res.data?.remaining || 0;
      this.setData({ password: '', errorMsg: `密码错误，剩余${remaining}次`, attempts: 3 - remaining });
    } else if (res.code === 40003) {
      this.setData({ locked: true, lockSeconds: 30, password: '', errorMsg: '锁定30秒' });
      this.startLockCountdown();
    } else {
      this.setData({ password: '', errorMsg: res.message || '验证失败' });
    }
  },

  startLockCountdown() {
    this._timer = setInterval(() => {
      const sec = this.data.lockSeconds - 1;
      if (sec <= 0) {
        clearInterval(this._timer);
        this.setData({ locked: false, lockSeconds: 0, errorMsg: '' });
      } else {
        this.setData({ lockSeconds: sec, errorMsg: `请${sec}秒后重试` });
      }
    }, 1000);
  },

  onUnload() {
    if (this._timer) clearInterval(this._timer);
  }
});
