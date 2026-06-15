const { callFunction } = require('../../utils/api');
const { CF, OPTIONS } = require('../../utils/constants');
const app = getApp();
const db = wx.cloud.database();

Page({
  data: {
    menuId: '',
    menu: {},
    dishes: [],
    activeCategory: 'breakfast',
    filteredDishes: [],
    expired: false,
    // Cart
    cart: {},
    cartCount: 0,
    cartTotal: 0,
    showCart: false
  },

  onLoad(options) {
    const menuId = options.menuId;
    if (!menuId) {
      wx.showToast({ title: '无效菜单', icon: 'none' });
      return;
    }
    this.setData({ menuId });
    this.loadMenu();
    this.startWatch();
  },

  onUnload() {
    if (this._watcher) this._watcher.close();
  },

  async loadMenu() {
    const res = await callFunction(CF.MENU, {
      action: 'getMenu', menuId: this.data.menuId
    }, { showLoading: false, silentError: true });

    if (res && res.code === 0) {
      const menu = res.data.menu;
      const expired = menu.expiryTime && new Date(menu.expiryTime) < new Date();
      this.setData({ menu, dishes: res.data.dishes, expired });
      this.applyFilter();
    }
  },

  startWatch() {
    this._watcher = db.collection('dishes')
      .where({ menuId: this.data.menuId, isAvailable: true })
      .watch({
        onChange: (snapshot) => {
          this.setData({ dishes: snapshot.docs });
          this.applyFilter();
        },
        onError: (err) => { console.error('watch error', err); }
      });
  },

  // 分类切换
  onCategoryChange(e) {
    this.setData({ activeCategory: e.detail.key });
    this.applyFilter();
  },

  applyFilter() {
    const { dishes, activeCategory } = this.data;
    const filtered = dishes.filter(d => d.category === activeCategory);
    this.setData({ filteredDishes: filtered });
  },

  // 加减菜
  onDishChange(e) {
    const { dish, quantity } = e.detail;
    const cart = { ...this.data.cart };

    if (quantity <= 0) {
      delete cart[dish._id];
    } else {
      cart[dish._id] = {
        dishId: dish._id,
        dishName: dish.name,
        lockedPrice: dish.price,
        quantity
      };
    }

    this.updateCart(cart);
  },

  updateCart(cart) {
    let cartCount = 0, cartTotal = 0;
    Object.values(cart).forEach(item => {
      cartCount += item.quantity;
      cartTotal += item.lockedPrice * item.quantity;
    });

    this.setData({ cart, cartCount, cartTotal });
    this._idempotencyKey = this.generateUUID();
  },

  getItemQuantity(dishId) {
    const item = this.data.cart[dishId];
    return item ? item.quantity : 0;
  },

  // 查看购物车
  onOpenCart() {
    if (this.data.cartCount === 0) {
      wx.showToast({ title: '购物车空空如也', icon: 'none' });
      return;
    }
    const items = JSON.stringify(Object.values(this.data.cart));
    wx.navigateTo({
      url: `/pages/cart/cart?items=${encodeURIComponent(items)}&menuId=${this.data.menuId}&chefId=${this.data.menu.creatorId}&totalPrice=${this.data.cartTotal}`
    });
  },

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  onShareAppMessage() {
    const { menuId, menu } = this.data;
    const path = menu.password
      ? `/pages/password-entry/password-entry?menuId=${menuId}`
      : `/pages/menu/menu?menuId=${menuId}`;
    return { title: `来点菜吧：${menu.title || '美味菜单'}`, path };
  }
});
