# Cloud Function Contracts: 点菜小程序

**Feature**: 001-dish-ordering-system
**Date**: 2026-06-15

本项目通过 `wx.cloud.callFunction` 调用云函数，无 REST API。以下定义每个云函数的输入/输出契约。

---

## 1. login — 登录与初始化

**Purpose**: 微信登录、用户注册/查询、月度H币初始化

**Input**:
```json
{}
```
> 云函数内部通过 `cloud.getWXContext().OPENID` 获取用户身份

**Output (success)**:
```json
{
  "code": 0,
  "data": {
    "openid": "oXXXX_xxxxxxxxxxxxxx",
    "nickname": "用户昵称",
    "avatarUrl": "https://...",
    "coinBalance": 10000,
    "role": "diner"
  }
}
```

**Output (first login, new user created)**:
```json
{
  "code": 0,
  "data": {
    "openid": "oXXXX_new_user",
    "nickname": "",
    "avatarUrl": "",
    "coinBalance": 10000,
    "role": "",
    "isNewUser": true
  }
}
```

**Business Logic**:
1. 获取 OpenID → 查询 `users` 集合
2. 不存在 → 创建用户文档（coinBalance=10000, lastResetMonth=currentMonth）
3. 存在但 `lastResetMonth != currentMonth` → 重置余额为 10000
4. 返回用户信息

---

## 2. menu — 菜单与菜品管理

**Purpose**: 菜单 CRUD、菜品 CRUD

### Action: `getMenu`

**Input**:
```json
{
  "action": "getMenu",
  "menuId": "menu_xxx"
}
```

**Output**:
```json
{
  "code": 0,
  "data": {
    "menu": { "_id": "menu_xxx", "title": "周末聚餐", "creatorId": "oXXX" },
    "dishes": [
      { "_id": "d1", "name": "豆浆", "iconUrl": "cloud://xxx.png", "price": 50, "category": "breakfast" },
      { "_id": "d2", "name": "牛排", "iconUrl": "cloud://xxx.png", "price": 300, "category": "dinner" }
    ]
  }
}
```

### Action: `addDish`

**Input**:
```json
{
  "action": "addDish",
  "menuId": "menu_xxx",
  "name": "豆浆",
  "iconUrl": "cloud://xxx.png",
  "price": 50,
  "category": "breakfast"
}
```

**Output**:
```json
{
  "code": 0,
  "data": { "dishId": "dish_xxx" }
}
```

**Permission**: 仅 `menu.creatorId` 匹配当前用户可操作

### Action: `updateDish`

**Input**:
```json
{
  "action": "updateDish",
  "dishId": "dish_xxx",
  "name": "大杯豆浆",
  "price": 60
}
```

### Action: `deleteDish`

**Input**:
```json
{
  "action": "deleteDish",
  "dishId": "dish_xxx"
}
```

### Action: `verifyPassword`

**Input**:
```json
{
  "action": "verifyPassword",
  "menuId": "menu_xxx",
  "password": "1234"
}
```

**Output (wrong)**:
```json
{ "code": 40007, "message": "密码错误", "data": { "remaining": 2 } }
```

**Output (locked)**:
```json
{ "code": 40003, "message": "密码错误次数过多，请30秒后重试" }
```

---

## 3. order — 订单操作

**Purpose**: 下单、取消、接单、完成订单（含H币转账）、查询订单

### Action: `placeOrder`

**Input**:
```json
{
  "action": "placeOrder",
  "menuId": "menu_xxx",
  "chefId": "oXXX_chef",
  "items": [
    { "dishId": "d1", "dishName": "豆浆", "lockedPrice": 50, "quantity": 2 },
    { "dishId": "d2", "dishName": "馒头", "lockedPrice": 30, "quantity": 1 }
  ],
  "totalPrice": 130,
  "idempotencyKey": "uuid-xxx-xxx"
}
```

**Output (success)**:
```json
{
  "code": 0,
  "data": {
    "orderId": "order_xxx",
    "newBalance": 9870
  }
}
```

**Output (insufficient coins)**:
```json
{
  "code": 40001,
  "message": "H币不足，请调整菜品数量",
  "data": { "currentBalance": 5000, "required": 130 }
}
```

**Output (idempotent replay)**:
```json
{
  "code": 0,
  "data": {
    "orderId": "order_xxx",
    "newBalance": 9870,
    "duplicate": true
  }
}
```

**Business Logic**:
1. 核验菜单未过期（FR-005）→ 密码校验（若设置了密码则在客户端先验证）
2. 核验购物车非空 → FR-009
3. 幂等检查：`transactions` 中是否存在 `idempotencyKey`
4. 事务：读余额 → 校验充足 → 扣款 → 创建订单(status=placed) → 记录流水
5. 返回 orderId 和新余额

### Action: `cancelOrder`

**Input**:
```json
{
  "action": "cancelOrder",
  "orderId": "order_xxx"
}
```

**Permission**: 仅 `order.dinerId` 匹配当前用户可操作

**State Validation**: `order.status === "placed"`

**Output**:
```json
{
  "code": 0,
  "data": { "newBalance": 10000, "refundedAmount": 130 }
}
```

**Business Logic**: 事务中原子执行：status→cancelled → diner余额+totalPrice → 记录 type=order_refund 流水

### Action: `acceptOrder`

**Input**:
```json
{
  "action": "acceptOrder",
  "orderId": "order_xxx"
}
```

**Permission**: 仅 `order.chefId` 匹配当前用户可操作

**State Validation**: `order.status === "placed"` → `"accepted"`

### Action: `completeOrder`

**Input**:
```json
{
  "action": "completeOrder",
  "orderId": "order_xxx"
}
```

**State Validation**: `order.status === "accepted"` → `"completed"`

**Business Logic (completeOrder)**: 事务中原子执行：status→completed + completedAt → chef余额+=totalPrice → 记录两条流水（diner order_pay + chef order_income）

### Action: `getOrders`

**Input**:
```json
{
  "action": "getOrders",
  "role": "diner",
  "status": "all"
}
```

**Input (chef with filter)**:
```json
{
  "action": "getOrders",
  "role": "chef",
  "menuId": "menu_xxx",
  "status": "placed"
}
```

**Output**:
```json
{
  "code": 0,
  "data": {
    "orders": [
      { "_id": "order_xxx", "dinerName": "张三", "totalPrice": 130, "status": "placed", "placedAt": "..." }
    ]
  }
}
```

---

## 4. rating — 评分与奖励

**Purpose**: 提交评分、发放H币奖励

### Action: `submitRating`

**Input**:
```json
{
  "action": "submitRating",
  "orderId": "order_xxx",
  "rating": 5
}
```

**Output**:
```json
{
  "code": 0,
  "data": {
    "bonusCoins": 200,
    "newBalance": 10070
  }
}
```

**Validation**:
- `order.status === "completed"` → FR-020
- `order.rating` 为空（未评分）→ FR-022
- `order.completedAt` 距今 ≤ 7天 → FR-023
- `order.dinerId` 匹配当前用户

**Bonus Rules** (FR-021):

| 评分 | 奖励H币 |
|------|---------|
| 5星  | 200     |
| 4星  | 100     |
| 3星  | 50      |
| 1-2星| 0       |

**Business Logic**:
1. 校验订单状态和权限
2. 计算奖励金额
3. 事务：更新订单 rating 字段 → 增加用户余额 → 记录 type=rating_bonus 流水

---

## 5. schedule — 定时任务

**Purpose**: 月度H币重置（由云开发定时触发器调用，非客户端调用）

**Trigger**: Cron `0 0 1 * * * *`（每月1日0点）

**Input**:
```json
{}
```

**Business Logic**:
1. 查询 `users` 集合中 `lastResetMonth != currentMonth` 的所有用户
2. 批量更新 `coinBalance = 10000`, `lastResetMonth = currentMonth`
3. 为每个用户记录 `type=monthly_reset` 流水

---

## Error Codes

| Code  | Meaning               | HTTP-like |
|-------|-----------------------|-----------|
| 0     | Success               | 200       |
| 40001 | Insufficient H coins  | 402       |
| 40002 | Invalid state transition | 409    |
| 40003 | Permission denied     | 403       |
| 40004 | Rating expired (>7 days) | 410    |
| 40005 | Already rated         | 409       |
| 40006 | Empty cart            | 400       |
| 40007 | Wrong password        | 401       |
| 40008 | Menu expired          | 410       |
| 50001 | Transaction failed    | 500       |
