# Database Schema: 点菜小程序

**Feature**: 001-dish-ordering-system
**Date**: 2026-06-15

> 参考 [data-model.md](../data-model.md) 中的实体定义，本文档定义 CloudBase 数据库集合的安全规则和索引。

## Collection: `menus`

**Permission Rules**:
```json
{
  "read": "auth.openid == doc.creatorId || doc.isActive == true",
  "write": "auth.openid == doc.creatorId"
}
```
- 创建者可读写自己的菜单
- 任何登录用户可读已激活的菜单（通过分享链接访问）

**Indexes**:
- `creatorId` (ascending)

---

## Collection: `dishes`

**Permission Rules**:
```json
{
  "read": true,
  "write": "auth.openid == doc._openid"
}
```
> 实际权限在云函数中控制：非创建者不可增删改菜品

**Indexes**:
- `{ menuId: 1, category: 1 }` (复合索引)
- `menuId` (ascending, 用于删除菜单时级联查询)

**Validation**:
```json
{
  "price": { "gt": 0 },
  "category": { "in": ["breakfast", "dinner", "snack", "drink"] }
}
```

---

## Collection: `orders`

**Permission Rules**:
```json
{
  "read": "auth.openid == doc.dinerId || auth.openid == doc.chefId",
  "write": false
}
```
- 点菜用户和厨师可读相关订单
- 客户端不可直接写入订单（所有写操作通过云函数事务）

**Indexes**:
- `{ dinerId: 1, placedAt: -1 }` — 点菜端历史订单（按时间倒序）
- `{ menuId: 1, status: 1 }` — 厨师端按状态筛选
- `{ idempotencyKey: 1 }` (唯一索引) — 幂等去重

**Validation**:
```json
{
  "status": { "in": ["placed", "accepted", "completed", "cancelled"] },
  "totalPrice": { "gt": 0 },
  "rating": { "gte": 1, "lte": 5 }
}
```

---

## Collection: `users`

**Permission Rules**:
```json
{
  "read": "auth.openid == doc._id",
  "write": false
}
```
- 用户只能读自己的信息
- 余额变更必须通过云函数事务

**Indexes**:
- (无需额外索引，`_id` 即为 OpenID)

**Validation**:
```json
{
  "coinBalance": { "gte": 0 }
}
```

---

## Collection: `transactions`

**Permission Rules**:
```json
{
  "read": "auth.openid == doc.userId",
  "write": false
}
```
- 用户只能读自己的流水
- 流水不可篡改（仅云函数事务中写入）

**Indexes**:
- `{ userId: 1, createdAt: -1 }` — 用户流水按时间倒序

**Validation**:
```json
{
  "type": { "in": ["monthly_reset", "order_pay", "order_refund", "order_income", "rating_bonus"] }
}
```

---

## Collection Size Estimates (MVP)

| Collection   | Est. Docs | Avg Size | Total   |
|-------------|-----------|----------|---------|
| menus       | 50        | 0.5 KB   | 25 KB   |
| dishes      | 500       | 0.3 KB   | 150 KB  |
| orders      | 2,000     | 1 KB     | 2 MB    |
| users       | 200       | 0.5 KB   | 100 KB  |
| transactions| 5,000     | 0.3 KB   | 1.5 MB  |
| **Total**   |           |          | **≈3.8 MB** |

> 远在 CloudBase 免费额度内（2GB 存储）
