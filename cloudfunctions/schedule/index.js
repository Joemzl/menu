/**
 * schedule 云函数 — 月度H币重置（定时触发器）
 * Cron: 0 0 1 * * * * (每月1日0点)
 */
const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();

const MONTHLY_COINS = 10000;

exports.main = async () => {
  const now = new Date();
  const currentMonth = now.getMonth();

  try {
    // 查询本月尚未重置的点菜用户（非chef角色 + lastResetMonth != currentMonth）
    const usersRes = await db.collection('users')
      .where({
        role: db.command.neq('chef'),
        lastResetMonth: db.command.neq(currentMonth)
      })
      .limit(200)
      .get();

    const users = usersRes.data;
    let processed = 0;

    for (const user of users) {
      try {
        const newBalance = MONTHLY_COINS;
        const oldBalance = user.coinBalance || 0;

        await db.collection('users').doc(user._id).update({
          data: {
            coinBalance: newBalance,
            lastResetMonth: currentMonth,
            updatedAt: now
          }
        });

        await db.collection('transactions').add({
          data: {
            userId: user._id,
            amount: MONTHLY_COINS - oldBalance,
            type: 'monthly_reset',
            balanceAfter: newBalance,
            description: '月度H币重置',
            createdAt: now
          }
        });

        processed++;
      } catch (e) {
        console.error(`[schedule] failed for user ${user._id}:`, e);
      }
    }

    return { code: 0, data: { processed, total: users.length } };
  } catch (err) {
    console.error('[schedule] error:', err);
    return { code: 50001, message: '定时任务执行失败' };
  }
};
