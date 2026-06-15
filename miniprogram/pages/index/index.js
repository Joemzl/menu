const { callFunction } = require('../../utils/api');
const { auth } = require('../../utils/auth');
const { CF, DEFAULT_MENU_EXPIRY_MS } = require('../../utils/constants');

const app = getApp();

Page({
  data: {
    role: '',
    menus: [],
    showCreate: false,
    newMenuTitle: '',
    newMenuPassword: '',
    usePassword: false,
    expiryTime: '',
    creating: false
  },

  onLoad() {
    this.setData({ role: app.globalData.role || '' });
  },

  onShow() {
    this.setData({ role: app.globalData.role || '' });
    this.loadMenus();
  },

  onPullDownRefresh() {
    this.loadMenus().then(() => wx.stopPullDownRefresh());
  },

  async loadMenus() {
    const menusRes = await db.collection('menus')
      .where({ creatorId: app.globalData.openid })
      .orderBy('createdAt', 'desc')
      .get();
    this.setData({ menus: menusRes.data || [] });
  },

  // 角色选择
  onRoleSelect(e) {
    const role = e.currentTarget.dataset.role;
    app.globalData.role = role;
    this.setData({ role });
  },

  // 显示新建菜单
  onShowCreate() {
    const expiry = new Date(Date.now() + DEFAULT_MENU_EXPIRY_MS);
    this.setData({
      showCreate: true,
      expiryTime: this.formatDatetime(expiry)
    });
  },

  onCancelCreate() {
    this.setData({ showCreate: false, newMenuTitle: '', newMenuPassword: '', usePassword: false });
  },

  // 创建菜单
  async onCreateMenu() {
    const { newMenuTitle, newMenuPassword, usePassword } = this.data;
    if (!newMenuTitle.trim()) {
      wx.showToast({ title: '请输入菜单名称', icon: 'none' });
      return;
    }
    this.setData({ creating: true });

    const now = new Date();
    const menuData = {
      creatorId: app.globalData.openid,
      title: newMenuTitle.trim(),
      password: usePassword ? newMenuPassword : null,
      expiryTime: new Date(now.getTime() + DEFAULT_MENU_EXPIRY_MS),
      isActive: true,
      createdAt: now,
      updatedAt: now
    };

    const res = await db.collection('menus').add({ data: menuData });
    this.setData({ creating: false, showCreate: false, newMenuTitle: '', newMenuPassword: '', usePassword: false });
    wx.showToast({ title: '菜单已创建', icon: 'success' });
    this.loadMenus();
  },

  // 进入菜单管理
  onMenuManage(e) {
    const menuId = e.currentTarget.dataset.id;
    const menu = this.data.menus.find(m => m._id === menuId);
    wx.navigateTo({
      url: `/pages/menu-manage/menu-manage?menuId=${menuId}&title=${encodeURIComponent(menu.title)}`
    });
  },

  // 分享
  onShareMenu(e) {
    const menuId = e.currentTarget.dataset.id;
    const menu = this.data.menus.find(m => m._id === menuId);
    return {
      title: `来点菜吧：${menu.title}`,
      path: `/pages/menu/menu?menuId=${menuId}`,
      imageUrl: ''
    };
  },

  formatDatetime(date) {
    const y = date.getFullYear();
    const M = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${M}-${d}T${h}:${m}`;
  }
});
