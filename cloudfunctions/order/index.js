/**
 * order 云函数 — 下单、取消、接单、完成 + H币转账
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  switch (action) {

    // =============================================
    // placeOrder: 下单
    // =============================================
    case 'placeOrder': {
      const { menuId, chefId, items, totalPrice, idempotencyKey, dinerName } = event;
      if (!menuId || !chefId || !items || items.length === 0) {
        return { code: 40006, message: '请先选择菜品' };
      }
      if (!totalPrice || totalPrice <= 0) {
        return { code: 40006, message: '请先选择菜品' };
      }

      // 校验菜单过期
      try {
        const menuRes = await db.collection('menus').doc(menuId).get();
        if (menuRes.data && menuRes.data.expiryTime && new Date(menuRes.data.expiryTime) < new Date()) {
          return { code: 40008, message: '菜单已结束' };
        }
      } catch (e) { /* menu may be deleted */ }

      // 幂等检查
      if (idempotencyKey) {
        const dupRes = await db.collection('orders')
          .where({ idempotencyKey, dinerId: openid })
          .get();
        if (dupRes.data.length > 0) {
          return {
            code: 0,
            data: { orderId: dupRes.data[0]._id, newBalance: null, duplicate: true }
          };
        }
      }

      // 事务：扣款 + 创建订单
      try {
        const result = await db.runTransaction(async (transaction) => {
          const userRes = await transaction.collection('users').doc(openid).get();
          const user = userRes.data;

          if (!user || user.coinBalance < totalPrice) {
            throw new Error('INSUFFICIENT_COINS');
          }

          const newBalance = user.coinBalance - totalPrice;
          const now = new Date();

          // 扣款
          await transaction.collection('users').doc(openid).update({
            data: { coinBalance: _.inc(-totalPrice), updatedAt: now }
          });

          // 创建订单
          const orderRes = await transaction.collection('orders').add({
            data: {
              menuId,
              dinerId: openid,
              dinerName: dinerName || '',
              chefId,
              items,
              totalPrice,
              status: 'placed',
              idempotencyKey: idempotencyKey || '',
              placedAt: now
            }
          });

          // 记录扣款流水
          await transaction.collection('transactions').add({
            data: {
              userId: openid,
              amount: -totalPrice,
              type: 'order_pay',
              orderId: orderRes._id,
              balanceAfter: newBalance,
              description: `下单支付`,
              createdAt: now
            }
          });

          return { orderId: orderRes._id, newBalance };
        });

        return { code: 0, data: result };
      } catch (err) {
        if (err.message === 'INSUFFICIENT_COINS') {
          return { code: 40001, message: 'H币不足，请调整菜品数量' };
        }
        console.error('[order] placeOrder error:', err);
        return { code: 50001, message: '交易失败，请重试' };
      }
    }

    // =============================================
    // cancelOrder: 取消订单
    // =============================================
    case 'cancelOrder': {
      const { orderId } = event;
      if (!orderId) return { code: -1, message: '缺少 orderId' };

      try {
        const result = await db.runTransaction(async (transaction) => {
          const orderRes = await transaction.collection('orders').doc(orderId).get();
          const order = orderRes.data;

          if (!order) throw new Error('ORDER_NOT_FOUND');
          if (order.dinerId !== openid) throw new Error('PERMISSION_DENIED');
          if (order.status !== 'placed') throw new Error('INVALID_STATE');

          const now = new Date();
          const userRes = await transaction.collection('users').doc(openid).get();
          const newBalance = (userRes.data.coinBalance || 0) + order.totalPrice;

          // 更新订单状态
          await transaction.collection('orders').doc(orderId).update({
            data: { status: 'cancelled', cancelledAt: now }
          });

          // 退还H币
          await transaction.collection('users').doc(openid).update({
            data: { coinBalance: _.inc(order.totalPrice), updatedAt: now }
          });

          // 退款流水
          await transaction.collection('transactions').add({
            data: {
              userId: openid,
              amount: order.totalPrice,
              type: 'order_refund',
              orderId,
              balanceAfter: newBalance,
              description: `取消订单退款`,
              createdAt: now
            }
          });

          return { newBalance, refundedAmount: order.totalPrice };
        });

        return { code: 0, data: result };
      } catch (err) {
        if (err.message === 'INVALID_STATE') {
          return { code: 40002, message: '当前状态不可取消' };
        }
        if (err.message === 'PERMISSION_DENIED') {
          return { code: 40003, message: '无权操作' };
        }
        console.error('[order] cancelOrder error:', err);
        return { code: 50001, message: '取消失败' };
      }
    }

    // =============================================
    // acceptOrder: 接单
    // =============================================
    case 'acceptOrder': {
      const { orderId } = event;
      if (!orderId) return { code: -1, message: '缺少 orderId' };

      const orderRes = await db.collection('orders').doc(orderId).get();
      const order = orderRes.data;
      if (!order) return { code: -1, message: '订单不存在' };
      if (order.chefId !== openid) return { code: 40003, message: '仅该菜单厨师可操作' };
      if (order.status !== 'placed') return { code: 40002, message: '当前状态不可接单' };

      const now = new Date();
      await db.collection('orders').doc(orderId).update({
        data: { status: 'accepted', acceptedAt: now }
      });

      return { code: 0 };
    }

    // =============================================
    // completeOrder: 完成订单 + 厨师入账
    // =============================================
    case 'completeOrder': {
      const { orderId } = event;
      if (!orderId) return { code: -1, message: '缺少 orderId' };

      try {
        const result = await db.runTransaction(async (transaction) => {
          const orderRes = await transaction.collection('orders').doc(orderId).get();
          const order = orderRes.data;
          if (!order) throw new Error('ORDER_NOT_FOUND');
          if (order.chefId !== openid) throw new Error('PERMISSION_DENIED');
          if (order.status !== 'accepted') throw new Error('INVALID_STATE');

          const now = new Date();

          // 更新订单状态
          await transaction.collection('orders').doc(orderId).update({
            data: { status: 'completed', completedAt: now }
          });

          // 厨师入账
          const chefRes = await transaction.collection('users').doc(openid).get();
          const chefNewBalance = (chefRes.data.coinBalance || 0) + order.totalPrice;
          await transaction.collection('users').doc(openid).update({
            data: { coinBalance: _.inc(order.totalPrice), updatedAt: now }
          });

          // 记录厨师收入流水
          await transaction.collection('transactions').add({
            data: {
              userId: openid,
              amount: order.totalPrice,
              type: 'order_income',
              orderId,
              balanceAfter: chefNewBalance,
              description: `订单收入`,
              createdAt: now
            }
          });

          return { chefNewBalance };
        });

        return { code: 0, data: result };
      } catch (err) {
        if (err.message === 'INVALID_STATE') {
          return { code: 40002, message: '当前状态不可完成' };
        }
        console.error('[order] completeOrder error:', err);
        return { code: 50001, message: '操作失败' };
      }
    }

    // =============================================
    // getOrders: 查询订单
    // =============================================
    case 'getOrders': {
      const { role, menuId, status } = event;
      const now = new Date();
      let query = {};

      if (role === 'chef') {
        if (!menuId) return { code: -1, message: '缺少 menuId' };
        query.menuId = menuId;
      } else {
        query.dinerId = openid;
      }

      if (status && status !== 'all') {
        query.status = status;
      }

      const ordersRes = await db.collection('orders')
        .where(query)
        .orderBy('placedAt', 'desc')
        .limit(100)
        .get();

      return { code: 0, data: { orders: ordersRes.data } };
    }

    default:
      return { code: -1, message: `未知 action: ${action}` };
  }
};
