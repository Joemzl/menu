/**
 * menu 云函数 — 菜单与菜品 CRUD + 密码验证
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const VALID_CATEGORIES = ['breakfast', 'dinner', 'snack', 'drink'];

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  switch (action) {

    // =============================================
    // getMenu: 获取菜单 + 菜品列表
    // =============================================
    case 'getMenu': {
      const { menuId } = event;
      if (!menuId) return { code: -1, message: '缺少 menuId' };

      const menuRes = await db.collection('menus').doc(menuId).get();
      if (!menuRes.data) return { code: -1, message: '菜单不存在' };

      const menu = menuRes.data;
      const dishesRes = await db.collection('dishes')
        .where({ menuId, isAvailable: true })
        .orderBy('sortOrder', 'asc')
        .orderBy('createdAt', 'asc')
        .get();

      return {
        code: 0,
        data: { menu, dishes: dishesRes.data }
      };
    }

    // =============================================
    // verifyPassword: 密码验证
    // =============================================
    case 'verifyPassword': {
      const { menuId, password } = event;
      if (!menuId || !password) {
        return { code: -1, message: '缺少参数' };
      }

      const menuRes = await db.collection('menus').doc(menuId).get();
      const menu = menuRes.data;
      if (!menu) return { code: -1, message: '菜单不存在' };
      if (!menu.password) return { code: 0 }; // 无密码直接通过

      const lockKey = `pwdFail_${menuId}_${openid}`;
      const initialAttempts = (menu.passwordAttempts && menu.passwordAttempts[openid]) || { count: 0, lockUntil: 0 };

      // 检查锁定
      if (initialAttempts.lockUntil > Date.now()) {
        const remaining = Math.ceil((initialAttempts.lockUntil - Date.now()) / 1000);
        return { code: 40003, message: `密码错误次数过多，请${remaining}秒后重试` };
      }

      const isCorrect = menu.password === password;

      if (!isCorrect) {
        const newCount = initialAttempts.count + 1;
        const lockUntil = newCount >= 3 ? Date.now() + 30000 : 0;
        await db.collection('menus').doc(menuId).update({
          data: {
            [`passwordAttempts.${openid}`]: { count: newCount, lockUntil }
          }
        });

        if (lockUntil > 0) {
          return { code: 40003, message: '密码错误次数过多，请30秒后重试' };
        }
        return { code: 40007, message: '密码错误', data: { remaining: 3 - newCount } };
      }

      // 验证成功，清除错误记录
      await db.collection('menus').doc(menuId).update({
        data: { [`passwordAttempts.${openid}`]: { count: 0, lockUntil: 0 } }
      });

      return { code: 0 };
    }

    // =============================================
    // addDish: 添加菜品
    // =============================================
    case 'addDish': {
      const { menuId, name, iconUrl, price, category } = event;
      if (!menuId || !name || !price || !category) {
        return { code: -1, message: '缺少必填字段' };
      }
      if (!VALID_CATEGORIES.includes(category)) {
        return { code: -1, message: '无效分类' };
      }
      if (price <= 0) {
        return { code: -1, message: '价格必须大于0' };
      }

      const menuRes = await db.collection('menus').doc(menuId).get();
      if (menuRes.data.creatorId !== openid) {
        return { code: 40003, message: '仅菜单创建者可操作' };
      }

      const now = new Date();
      const res = await db.collection('dishes').add({
        data: {
          menuId,
          name,
          iconUrl: iconUrl || '',
          price,
          category,
          isAvailable: true,
          sortOrder: 0,
          createdAt: now,
          updatedAt: now
        }
      });

      return { code: 0, data: { dishId: res._id } };
    }

    // =============================================
    // updateDish: 修改菜品
    // =============================================
    case 'updateDish': {
      const { dishId, name, iconUrl, price, category } = event;
      if (!dishId) return { code: -1, message: '缺少 dishId' };

      const dishRes = await db.collection('dishes').doc(dishId).get();
      if (!dishRes.data) return { code: -1, message: '菜品不存在' };

      const menuRes = await db.collection('menus').doc(dishRes.data.menuId).get();
      if (menuRes.data.creatorId !== openid) {
        return { code: 40003, message: '仅菜单创建者可操作' };
      }

      const updates = { updatedAt: new Date() };
      if (name !== undefined) updates.name = name;
      if (iconUrl !== undefined) updates.iconUrl = iconUrl;
      if (price !== undefined) {
        if (price <= 0) return { code: -1, message: '价格必须大于0' };
        updates.price = price;
      }
      if (category !== undefined) {
        if (!VALID_CATEGORIES.includes(category)) return { code: -1, message: '无效分类' };
        updates.category = category;
      }

      await db.collection('dishes').doc(dishId).update({ data: updates });
      return { code: 0 };
    }

    // =============================================
    // deleteDish: 删除菜品（软删除）
    // =============================================
    case 'deleteDish': {
      const { dishId } = event;
      if (!dishId) return { code: -1, message: '缺少 dishId' };

      const dishRes = await db.collection('dishes').doc(dishId).get();
      if (!dishRes.data) return { code: -1, message: '菜品不存在' };

      const menuRes = await db.collection('menus').doc(dishRes.data.menuId).get();
      if (menuRes.data.creatorId !== openid) {
        return { code: 40003, message: '仅菜单创建者可操作' };
      }

      await db.collection('dishes').doc(dishId).update({
        data: { isAvailable: false, updatedAt: new Date() }
      });
      return { code: 0 };
    }

    default:
      return { code: -1, message: `未知 action: ${action}` };
  }
};
