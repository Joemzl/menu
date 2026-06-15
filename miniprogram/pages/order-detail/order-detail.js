const { callFunction } = require('../../utils/api');
const { CF } = require('../../utils/constants');
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    orderId: '',
    order: {},
    rated: false,
    ratingExpired: false,
    submitting: false,
    items: []
  },

  onLoad(options) {
    const orderId = options.orderId || '';
    this.setData({ orderId });
    this.loadOrder();
  },

  async loadOrder() {
    const res = await db.collection('orders').doc(this.data.orderId).get();
    const order = res.data;
    if (order) {
      const rated = order.rating != null;
      const ratingExpired = order.status === 'completed' && order.completedAt
        ? Date.now() - new Date(order.completedAt).getTime() > 7 * 24 * 60 * 60 * 1000
        : false;

      this.setData({
        order, rated, ratingExpired,
        items: order.items || []
      });
    }
  },

  // 评分
  async onRate(e) {
    const { rating } = e.detail;
    this.setData({ submitting: true });

    const res = await callFunction(CF.RATING, {
      action: 'submitRating', orderId: this.data.orderId, rating
    });

    this.setData({ submitting: false });

    if (res.code === 0) {
      if (res.data.bonusCoins > 0) {
        app.globalData.coinBalance = res.data.newBalance;
      }
      wx.showToast({ title: '评分成功！', icon: 'success' });
      this.loadOrder();
    }
  },

  // 取消订单 (from detail page too)
  async onCancelOrder() {
    const confirm = await wx.showModal({ title: '确认取消', content: '取消后退还H币' });
    if (!confirm.confirm) return;

    const res = await callFunction(CF.ORDER, { action: 'cancelOrder', orderId: this.data.orderId });
    if (res.code === 0) {
      app.globalData.coinBalance = res.data.newBalance;
      wx.showToast({ title: `已退款${res.data.refundedAmount}H币`, icon: 'success' });
      this.loadOrder();
    }
  }
});
