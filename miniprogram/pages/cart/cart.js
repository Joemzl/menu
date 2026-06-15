const { callFunction } = require('../../utils/api');
const { refreshBalance } = require('../../utils/auth');
const { CF } = require('../../utils/constants');
const app = getApp();

Page({
  data: {
    items: [],
    menuId: '',
    chefId: '',
    totalPrice: 0,
    submitting: false
  },

  onLoad(options) {
    const items = JSON.parse(decodeURIComponent(options.items || '[]'));
    const totalPrice = Number(options.totalPrice || 0);
    const menuId = options.menuId || '';
    const chefId = options.chefId || '';

    this.setData({ items, menuId, chefId, totalPrice });
  },

  // 更新数量
  onQuantityChange(e) {
    const { index, delta } = e.currentTarget.dataset;
    const items = [...this.data.items];
    items[index].quantity = Math.max(0, items[index].quantity + delta);

    if (items[index].quantity === 0) {
      items.splice(index, 1);
    }

    const totalPrice = items.reduce((sum, i) => sum + i.lockedPrice * i.quantity, 0);
    this.setData({ items, totalPrice });
  },

  // 下单
  async onPlaceOrder() {
    if (this.data.items.length === 0) {
      wx.showToast({ title: '请先选择菜品', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });

    // 生成幂等键
    const idempotencyKey = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

    const res = await callFunction(CF.ORDER, {
      action: 'placeOrder',
      menuId: this.data.menuId,
      chefId: this.data.chefId,
      items: this.data.items.map(i => ({
        dishId: i.dishId, dishName: i.dishName,
        lockedPrice: i.lockedPrice, quantity: i.quantity
      })),
      totalPrice: this.data.totalPrice,
      idempotencyKey,
      dinerName: app.globalData.userInfo?.nickName || '食客'
    });

    this.setData({ submitting: false });

    if (res.code === 0) {
      if (res.data.duplicate) {
        wx.showToast({ title: '请勿重复下单', icon: 'none' });
        return;
      }
      app.globalData.coinBalance = res.data.newBalance;
      wx.showToast({ title: '下单成功！', icon: 'success' });
      setTimeout(() => {
        wx.navigateBack({ delta: 2 });
      }, 1000);
    }
  },

  onBack() {
    wx.navigateBack();
  }
});
