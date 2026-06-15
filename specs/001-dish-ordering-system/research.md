# Research: 点菜小程序技术方案研究

**Feature**: 001-dish-ordering-system
**Date**: 2026-06-15

## Research Topics

### 1. 实时数据同步方案 — CloudBase watch

**Decision**: 使用 `db.collection().watch()` 实现订单状态实时监听。

**Rationale**:
- 微信云开发原生支持集合级实时监听，无需额外引入 WebSocket 库
- `watch.onChange` 回调在数据变更时触发，满足宪法 3s 同步要求（SC-002/SC-004）
- 对小程序包体积零影响
- 断线重连由 SDK 自动处理

**Alternatives Considered**:
- 手动 WebSocket：需要额外搭建 WebSocket 服务器，增加运维成本和延迟
- 轮询（setInterval）：违反宪法 II「禁止使用轮询」，且浪费带宽和云函数调用次数

**Implementation Pattern**:
```js
const watcher = db.collection('orders')
  .where({ menuId: currentMenuId })
  .watch({
    onChange: (snapshot) => {
      // snapshot.docs: 变更后的文档列表
      // snapshot.docChanges: 变更详情（新增/修改/删除）
      this.setData({ orders: snapshot.docs });
    },
    onError: (err) => {
      console.error('watch error', err);
      // 自动重连由 SDK 处理
    }
  });
```

---

### 2. H币原子扣款方案

**Decision**: 使用云函数事务（`db.runTransaction`）实现原子扣款。

**Rationale**:
- H币扣款涉及 read-check-write 三步操作（读余额→校验→写余额+写订单），必须原子化
- CloudBase 支持 ACID 事务（需在小程序后台开启事务功能）
- 并发场景下，事务内置乐观锁（冲突自动重试最多3次）防止并发扣款

**Alternatives Considered**:
- 客户端先读余额再调云函数扣款：TOCTOU 竞态条件，不可行
- 云函数直接更新余额：缺少并发控制，可能导致余额为负

**Implementation Pattern**:
```js
exports.main = async (event) => {
  const { userId, totalPrice, orderData } = event;
  
  const result = await db.runTransaction(async (transaction) => {
    const userRes = await transaction.collection('users').doc(userId).get();
    const user = userRes.data;
    
    if (user.coinBalance < totalPrice) {
      throw new Error('INSUFFICIENT_COINS');
    }
    
    // 原子更新：扣款 + 创建订单 + 记录流水
    await transaction.collection('users').doc(userId).update({
      data: { coinBalance: _.inc(-totalPrice) }
    });
    
    const orderRes = await transaction.collection('orders').add({ data: orderData });
    
    await transaction.collection('transactions').add({
      data: {
        userId, amount: -totalPrice, type: 'order_pay',
        orderId: orderRes._id, createdAt: new Date()
      }
    });
    
    return { orderId: orderRes._id, newBalance: user.coinBalance - totalPrice };
  });
  
  return result;
};
```

---

### 3. 下单幂等性设计

**Decision**: 客户端生成唯一幂等键（idempotencyKey），云函数以该键去重。

**Rationale**:
- 用户可能因网络异常重复点击下单按钮
- 微信小程序网络环境不稳定（弱网/切换），重试机制可能产生重复请求
- 幂等键确保同一订单不会被重复创建和重复扣款

**Implementation Pattern**:
- 每次用户进入购物车或修改购物车时，生成新的 `idempotencyKey = UUID`
- 云函数 order 在事务中首先查询 `transactions` 集合是否存在该 key
- 若已存在，直接返回已有订单信息，不重复扣款

---

### 4. 购物车价格锁定策略

**Decision**: 加入购物车时锁定该菜品的当前价格（`lockedPrice`），下单以锁定价格为准。

**Rationale**:
- 用户加入购物车后，厨师可能修改菜品价格
- 如果下单时以实时价格结算，用户预期与实际扣款可能不一致
- 锁定价格存储在客户端购物车数据结构中，下单时传给云函数

**Implementation Pattern**:
```js
// 客户端购物车数据结构
cart = [
  { dishId: 'xxx', name: '豆浆', lockedPrice: 50, quantity: 2 },
  { dishId: 'yyy', name: '馒头', lockedPrice: 30, quantity: 1 }
];
// 总价 = 50*2 + 30*1 = 130 H币
```

---

### 5. 月度H币重置方案

**Decision**: 使用云开发定时触发器（scheduled cloud function），每月1日0点重置。

**Rationale**:
- 云开发支持 cron 表达式定时触发云函数
- 定时函数查询所有用户，将 `coinBalance` 重置为 10,000
- 同时记录 `lastResetMonth` 字段防止重复重置

**Cron 表达式**: `0 0 1 * * * *`（每月1日0点）

**Implementation Pattern**:
```js
// cloudfunctions/schedule/index.js
exports.main = async (event) => {
  const currentMonth = new Date().getMonth(); // 0-11
  
  const users = await db.collection('users')
    .where({ lastResetMonth: _.neq(currentMonth) })
    .get();
  
  for (const user of users.data) {
    await db.collection('users').doc(user._id).update({
      data: { coinBalance: 10000, lastResetMonth: currentMonth }
    });
    await db.collection('transactions').add({
      data: {
        userId: user._id, amount: 10000 - (user.coinBalance || 0),
        type: 'monthly_reset', createdAt: new Date()
      }
    });
  }
};
```

---

### 6. 订单状态机设计

**Decision**: 三状态线性流转，不可逆。

```
已下单 (placed) ──[接单]──▶ 已接单 (accepted) ──[完成]──▶ 已完成 (completed)
                                              └──[评分]──▶ 已完成/已评分
```

**State Transition Rules**:
- `placed → accepted`: 仅厨师端可触发，云函数校验调用者是厨师
- `accepted → completed`: 仅厨师端可触发，云函数校验调用者是厨师
- `completed → rated`: 点菜端评分后追加 rating 字段，状态保持 completed
- 不允许回退或跳过状态

---

### 7. 并发点菜冲突解决

**Decision**: 基于 CloudBase 事务的乐观锁（optimistic locking）。

**Rationale**:
- 多人同时点菜，同一时刻可能有多个事务尝试修改同一个数据
- CloudBase 事务在检测到冲突时自动重试（内置重试机制）
- 购物车级别的冲突概率低（每个用户独立购物车），H币余额冲突由事务保证一致性

---

### 8. 菜品删除后购物车清理

**Decision**: 删除菜品时，云函数通知客户端；客户端在渲染购物车时过滤已删除菜品。

**Rationale**:
- 删除菜品不应导致未完成订单丢失
- 已加入购物车但被删除的菜品，在购物车中标记为"已下架"并自动移除
- 客户端通过 watch 监听菜品集合变化，实时清理购物车

---

### 9. 订单取消与H币退还

**Decision**: 仅"已下单"状态可取消，云函数事务中原子退还H币。

**Rationale**:
- 取消必须在接单前（chef 尚未开始制作），保护厨师免受已完成订单的退款争议
- 取消 + 退款必须在同一事务中完成：更新订单状态 → 退还余额 → 记录流水
- 取消后金额不可再次消费于同一订单（状态不可回退）

**Implementation Pattern**:
```js
// cloudfunctions/order/index.js - cancelOrder action
const result = await db.runTransaction(async (transaction) => {
  const order = (await transaction.collection('orders').doc(orderId).get()).data;
  if (order.status !== 'placed') throw new Error('INVALID_STATE');
  if (order.dinerId !== OPENID) throw new Error('PERMISSION_DENIED');
  
  await transaction.collection('orders').doc(orderId).update({
    data: { status: 'cancelled', cancelledAt: new Date() }
  });
  await transaction.collection('users').doc(OPENID).update({
    data: { coinBalance: _.inc(order.totalPrice) }
  });
  await transaction.collection('transactions').add({
    data: {
      userId: OPENID, amount: order.totalPrice,
      type: 'order_refund', orderId,
      balanceAfter: currentBalance + order.totalPrice,
      createdAt: new Date()
    }
  });
  return { newBalance: currentBalance + order.totalPrice };
});
```

---

### 10. 菜单过期执行策略

**Decision**: 云函数 order.placeOrder 中增加过期校验；客户端通过 watch 感知菜单状态变化。

**Rationale**:
- 过期检查在云函数下单时执行，客户端不可绕过
- 菜单过期后已下单未接单的订单仍可处理（chef 接单/完成不受限）
- 客户端 watch menus 集合，过期时禁用 UI 的 ± 按钮和下单按钮

**Validation Rule**: `new Date() < menu.expiryTime` 校验放在 placeOrder 事务第一步。

---

### 11. 密码验证与锁定机制

**Decision**: 菜单的 `password` 字段存储4位数字（null=公开），客户端调用 cloud function 验证，失败3次锁定30秒。

**Rationale**:
- 密码校验放在云函数中，防止客户端绕过
- 锁定状态存储在客户端内存（30s定时器），简单防暴力破解
- 密码仅存储于 menus 集合，不在客户端传输明文（云函数内部比对）

**Implementation Pattern**:
```js
// cloudfunctions/menu/index.js - verifyPassword action
let lockKey = `pwd_lock_${menuId}_${OPENID}`;
// 检查锁定状态（可用 Redis 或用 menus 文档中的 lockAttempts 字段）
if (lockState && lockState.until > Date.now()) {
  return { code: 40003, message: '密码错误次数过多，请30秒后重试' };
}
if (menu.password !== inputPassword) {
  // 记录失败次数，第3次设置 lockUntil = now + 30s
  return { code: 40007, message: '密码错误', remaining: 2 };
}
return { code: 0, data: { menuId } };
```

---

### 12. 厨师端H币入账（订单完成时）

**Decision**: 接单时仅从点菜端扣款暂存（不转入厨师账户），完成订单时将暂存的H币从点菜端原子转入厨师账户。

**Rationale**:
- 接单时H币已从点菜端扣除，防止重复消费
- 但此时不转入厨师账户（若厨师未完成应退回点菜端？当前设计：不可取消不可退回，H币在接单时已锁定于系统）
- 完成时：`chef.coinBalance += order.totalPrice` 在完成订单的同一事务中执行
- 如果完成时事务失败，已扣除H币不会丢失（点菜端已扣款已记录，厨师入账可补偿）

**Revised Design**:
- placeOrder: diner余额 -= totalPrice（H币暂时锁定于系统）
- cancelOrder (placed状态): diner余额 += totalPrice（全额退还）
- completeOrder: chef余额 += totalPrice（H币转入厨师） + status→completed
- 事务中记录两条流水：diner支出 + chef收入

---

## Summary of Resolved Clarifications

| 原问题 | 解决方案 |
|--------|---------|
| 购物车价格锁定 vs 实时价格 | 加入购物车时锁定价格（lockedPrice） |
| H币每月何时重置 | 每月1日0点，云函数定时触发器 |
| 并发扣款安全性 | CloudBase 事务 + 乐观锁 |
| 网络异常重复下单 | 幂等键（idempotencyKey）去重 |
| 菜品删除后购物车处理 | 客户端自动过滤 + 标记"已下架" |
| 订单取消与退款 | 仅 placed 状态可取消，事务内原子退款 |
| 菜单过期策略 | 云函数下单时校验 expiryTime，客户端 watch 感知 |
| 密码保护 | 云函数验证，客户端3次锁定30秒 |
| 厨师H币入账 | 完成订单时 atomic 转入厨师余额 |
