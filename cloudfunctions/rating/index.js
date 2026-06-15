/**
 * rating 云函数 — 评分 + H币奖励发放
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const RATING_BONUS = { 5: 200, 4: 100, 3: 50, 2: 0, 1: 0 };
const RATING_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7天

exports.main = async (event) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const { action } = event;

  switch (action) {

    // =============================================
    // submitRating: 提交评分
    // =============================================
    case 'submitRating': {
      const { orderId, rating } = event;
      if (!orderId || !rating) return { code: -1, message: '缺少参数' };
      if (rating < 1 || rating > 5) return { code: -1, message: '评分范围为1-5' };

      try {
        const result = await db.runTransaction(async (transaction) => {
          const orderRes = await transaction.collection('orders').doc(orderId).get();
          const order = orderRes.data;

          if (!order) throw new Error('ORDER_NOT_FOUND');
          if (order.dinerId !== openid) throw new Error('PERMISSION_DENIED');
          if (order.status !== 'completed') throw new Error('INVALID_STATE');
          if (order.rating != null) throw new Error('ALREADY_RATED');

          // 检查7天过期
          const completedAt = new Date(order.completedAt || order.placedAt);
          if (Date.now() - completedAt.getTime() > RATING_EXPIRY_MS) {
            throw new Error('RATING_EXPIRED');
          }

          const bonusCoins = RATING_BONUS[rating] || 0;
          const now = new Date();

          // 更新订单评分和奖励
          await transaction.collection('orders').doc(orderId).update({
            data: { rating, bonusCoins, ratedAt: now }
          });

          if (bonusCoins > 0) {
            // 发放奖励H币
            const userRes = await transaction.collection('users').doc(openid).get();
            const newBalance = (userRes.data.coinBalance || 0) + bonusCoins;

            await transaction.collection('users').doc(openid).update({
              data: { coinBalance: _.inc(bonusCoins), updatedAt: now }
            });

            // 记录奖励流水
            await transaction.collection('transactions').add({
              data: {
                userId: openid,
                amount: bonusCoins,
                type: 'rating_bonus',
                orderId,
                balanceAfter: newBalance,
                description: `${rating}星评分奖励`,
                createdAt: now
              }
            });

            return { bonusCoins, newBalance };
          }

          return { bonusCoins: 0 };
        });

        return { code: 0, data: result };
      } catch (err) {
        if (err.message === 'ALREADY_RATED') {
          return { code: 40005, message: '该订单已评分' };
        }
        if (err.message === 'RATING_EXPIRED') {
          return { code: 40004, message: '评分已过期（超过7天）' };
        }
        console.error('[rating] submitRating error:', err);
        return { code: 50001, message: '评分失败' };
      }
    }

    default:
      return { code: -1, message: `未知 action: ${action}` };
  }
};
