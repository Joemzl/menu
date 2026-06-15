const { callFunction } = require('../../utils/api');
const { CF } = require('../../utils/constants');
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    menuId: '',
    orders: [],
    statusFilter: 'all',
    chefBalance: 0,
    transactions: [],
    showTransactions: false,
    statusOptions: [
      { label: '全部', value: 'all' },
      { label: '已下单', value: 'placed' },
      { label: '已接单', value: 'accepted' },
      { label: '已完成', value: 'completed' },
      { label: '已取消', value: 'cancelled' }
    ]
  },

  onLoad(options) {
    this.setData({ menuId: options.menuId || '', chefBalance: app.globalData.coinBalance });
    this.loadOrders();
    this.startWatch();
  },

  onUnload() {
    if (this._watcher) this._watcher.close();
  },

  async loadOrders() {
    const res = await callFunction(CF.ORDER, {
      action: 'getOrders', role: 'chef',
      menuId: this.data.menuId,
      status: this.data.statusFilter
    }, { showLoading: false, silentError: true });

    if (res && res.code === 0) {
      this.setData({ orders: res.data.orders });
    }
  },

  startWatch() {
    this._watcher = db.collection('orders')
      .where({ menuId: this.data.menuId })
      .watch({
        onChange: () => { this.loadOrders(); },
        onError: (err) => { console.error('watch error', err); }
      });
  },

  // 筛选
  onFilterTap(e) {
    const val = e.currentTarget.dataset.value;
    this.setData({ statusFilter: val });
    this.loadOrders();
  },

  // 接单
  async onAccept(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认接单',
      content: '接单后将开始准备菜品',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        const res = await callFunction(CF.ORDER, { action: 'acceptOrder', orderId });
        if (res.code === 0) {
          wx.showToast({ title: '已接单', icon: 'success' });
        }
      }
    });
  },

  // 完成
  async onComplete(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.showModal({
      title: '确认完成',
      content: '完成后H币将转入你的账户',
      success: async (modalRes) => {
        if (!modalRes.confirm) return;
        const res = await callFunction(CF.ORDER, { action: 'completeOrder', orderId });
        if (res.code === 0) {
          app.globalData.coinBalance = res.data.chefNewBalance;
          this.setData({ chefBalance: res.data.chefNewBalance });
          wx.showToast({ title: '已完成！', icon: 'success' });
        }
      }
    });
  },

  // 查看订单详情
  onViewOrder(e) {
    const orderId = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/order-detail/order-detail?orderId=${orderId}` });
  },

  // 查看交易流水
  async onShowTransactions() {
    const res = await db.collection('transactions')
      .where({ userId: app.globalData.openid, type: db.command.in(['order_income', 'monthly_reset']) })
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    this.setData({ showTransactions: true, transactions: res.data || [] });
  },

  onHideTransactions() {
    this.setData({ showTransactions: false });
  }
});
