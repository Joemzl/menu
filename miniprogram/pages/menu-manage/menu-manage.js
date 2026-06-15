const { callFunction } = require('../../utils/api');
const { CF, CATEGORIES, DEFAULT_MENU_EXPIRY_MS } = require('../../utils/constants');
const app = getApp();

const db = wx.cloud.database();

Page({
  data: {
    menuId: '',
    menuTitle: '',
    menu: {},
    dishes: [],
    categories: CATEGORIES,
    showAdd: false,
    editMode: false,
    editDish: null,
    formName: '',
    formPrice: '',
    formCategory: 'breakfast',
    formIconUrl: '',
    uploading: false
  },

  onLoad(options) {
    const { menuId, title } = options;
    this.setData({ menuId, menuTitle: decodeURIComponent(title || '') });
    this.loadData();
    this.startWatch();
  },

  onUnload() {
    if (this._watcher) { this._watcher.close(); }
  },

  async loadData() {
    const res = await callFunction(CF.MENU, { action: 'getMenu', menuId: this.data.menuId }, { showLoading: false, silentError: true });
    if (res && res.code === 0) {
      this.setData({ menu: res.data.menu, dishes: res.data.dishes });
    }
  },

  startWatch() {
    this._watcher = db.collection('dishes')
      .where({ menuId: this.data.menuId })
      .watch({
        onChange: (snapshot) => {
          this.setData({ dishes: snapshot.docs.filter(d => d.isAvailable) });
        },
        onError: (err) => { console.error('watch error', err); }
      });
  },

  // 显示添加弹窗
  onShowAdd() {
    this.setData({ showAdd: true, editMode: false, formName: '', formPrice: '', formCategory: 'breakfast', formIconUrl: '' });
  },

  onCloseAdd() {
    this.setData({ showAdd: false, editDish: null });
  },

  // 选择图片
  onChooseImage() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      success: (res) => {
        this.setData({ uploading: true });
        wx.cloud.uploadFile({
          cloudPath: `dishes/${Date.now()}_${Math.random().toString(36).slice(2)}.png`,
          filePath: res.tempFilePaths[0],
          success: (uploadRes) => {
            this.setData({ formIconUrl: uploadRes.fileID, uploading: false });
          },
          fail: () => {
            wx.showToast({ title: '上传失败', icon: 'none' });
            this.setData({ uploading: false });
          }
        });
      }
    });
  },

  // 添加菜品
  async onAddDish() {
    const { formName, formPrice, formCategory, formIconUrl } = this.data;
    if (!formName.trim() || !formPrice) {
      wx.showToast({ title: '请填写完整', icon: 'none' }); return;
    }
    const res = await callFunction(CF.MENU, {
      action: 'addDish', menuId: this.data.menuId,
      name: formName, price: Number(formPrice),
      category: formCategory, iconUrl: formIconUrl
    });
    if (res.code === 0) {
      this.setData({ showAdd: false, formName: '', formPrice: '', formIconUrl: '' });
      wx.showToast({ title: '已添加', icon: 'success' });
    }
  },

  // 编辑菜品
  onEditDish(e) {
    const dish = e.currentTarget.dataset.dish;
    this.setData({
      editDish: dish, editMode: true, showAdd: true,
      formName: dish.name, formPrice: String(dish.price),
      formCategory: dish.category, formIconUrl: dish.iconUrl || ''
    });
  },

  async onUpdateDish() {
    const { editDish, formName, formPrice, formCategory, formIconUrl } = this.data;
    const res = await callFunction(CF.MENU, {
      action: 'updateDish', dishId: editDish._id,
      name: formName, price: Number(formPrice),
      category: formCategory, iconUrl: formIconUrl
    });
    if (res.code === 0) {
      this.setData({ showAdd: false, editDish: null });
      wx.showToast({ title: '已更新', icon: 'success' });
    }
  },

  // 删除菜品
  async onDeleteDish(e) {
    const dish = e.currentTarget.dataset.dish;
    const confirm = await wx.showModal({ title: '确认删除', content: `删除"${dish.name}"？` });
    if (!confirm.confirm) return;
    const res = await callFunction(CF.MENU, { action: 'deleteDish', dishId: dish._id });
    if (res.code === 0) wx.showToast({ title: '已删除', icon: 'success' });
  },

  // 分享
  onShareAppMessage() {
    const { menuId, menuTitle } = this.data;
    const path = this.data.menu.password
      ? `/pages/password-entry/password-entry?menuId=${menuId}`
      : `/pages/menu/menu?menuId=${menuId}`;
    return { title: `来点菜吧：${menuTitle}`, path };
  }
});
