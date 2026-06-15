/**
 * login 云函数 — 微信登录 + 用户初始化 + 月度H币发放
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const MONTHLY_COINS = 10000;

exports.main = async () => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const now = new Date();
  const currentMonth = now.getMonth();

  if (!openid) {
    return { code: -1, message: '获取OpenID失败' };
  }

  try {
    const userRes = await db.collection('users').doc(openid).get();
    const user = userRes.data;
    const updates = { updatedAt: now };
    let balanceChanged = false;

    // 月度H币重置（仅点菜端 role != 'chef'）
    if (user.lastResetMonth !== currentMonth && user.role !== 'chef') {
      const oldBalance = user.coinBalance || 0;
      updates.coinBalance = MONTHLY_COINS;
      updates.lastResetMonth = currentMonth;
      balanceChanged = true;

      // 记录月度发放流水
      await db.collection('transactions').add({
        data: {
          userId: openid,
          amount: MONTHLY_COINS - oldBalance,
          type: 'monthly_reset',
          balanceAfter: MONTHLY_COINS,
          description: `月度H币重置`,
          createdAt: now
        }
      });
    }

    if (Object.keys(updates).length > 1) {
      await db.collection('users').doc(openid).update({ data: updates });
    }

    const final = balanceChanged ? { ...user, ...updates } : user;

    return {
      code: 0,
      data: {
        openid,
        nickname: final.nickname || '',
        avatarUrl: final.avatarUrl || '',
        coinBalance: final.coinBalance,
        role: final.role || '',
        isNewUser: false
      }
    };

  } catch (err) {
    if (err.errCode === -1) {
      // 用户不存在，创建新用户
      const newUser = {
        _id: openid,
        nickname: '',
        avatarUrl: '',
        coinBalance: MONTHLY_COINS,
        lastResetMonth: currentMonth,
        role: '',
        createdAt: now,
        updatedAt: now
      };

      await db.collection('users').add({ data: newUser });

      return {
        code: 0,
        data: {
          openid,
          nickname: '',
          avatarUrl: '',
          coinBalance: MONTHLY_COINS,
          role: '',
          isNewUser: true
        }
      };
    }
    console.error('[login] error:', err);
    return { code: 50001, message: '登录失败' };
  }
};
