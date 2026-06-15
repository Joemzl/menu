const { callFunction } = require('../../utils/api');
const { CF } = require('../../utils/constants');
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    orders: []
  },

  onShow() {
    this.loadOrders();
  },

  onUnload() {
    if (this._watcher) this._watcher.close();
  },

  async loadOrders() {
    const res = await callFunction(CF.ORDER, {
      action: 'getOrders', role: 'diner'
    }, { showLoading: false, silentError: true });

    if (res && res.code === 0) {
      this.setData({ orders: res.data.orders });
      if (!this._watcher) this.startWatch();
    }
  },

  startWatch() {
    this._watcher = db.collection('orders')
      .where({ dinerId: app.globalData.openid })
      .watch({
        onChange: () => { this.loadOrders(); },
        onError: (err) => { console.error('watch error', err); }
      });
  },

  // 取消订单
  async onCancelOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    const confirm = await wx.showModal({ title: '确认取消', content: '取消后退还H币' });
    if (!confirm.confirm) return;

    const res = await callFunction(CF.ORDER, { action: 'cancelOrder', orderId });
    if (res.code === 0) {
      app.globalData.coinBalance = res.data.newBalance;
      wx.showToast({ title: `已取消，退款${res.data.refundedAmount}H币`, icon: 'success' });
      this.loadOrders();
    }
  },

  // 查看详情
  onViewOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?orderId=${orderId}` });
  }
});
