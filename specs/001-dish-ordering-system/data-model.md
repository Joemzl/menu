# Data Model: 点菜小程序

**Feature**: 001-dish-ordering-system
**Date**: 2026-06-15

## Entity Relationship

```
Menu (1) ──< Dish (N)
User (1) ──< Order (N)   [as diner]
User (1) ──< Order (N)   [as chef, filter by menuId]
User (1) ──< Transaction (N)
Order (1) ──< OrderItem (N)
```

## Collections / Entities

### 1. menus（菜单）

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string (auto) | yes | 菜单唯一 ID |
| `creatorId` | string | yes | 创建者 OpenID |
| `title` | string | yes | 菜单名称，如"周末聚餐菜单" |
| `password` | string | no | 4位数字密码，null 表示公开访问 |
| `expiryTime` | date | yes | 截止时间，默认 createdAt + 24h |
| `sharePath` | string | no | 小程序分享路径 |
| `isActive` | boolean | yes | 是否启用，默认 true |
| `createdAt` | date | yes | 创建时间 |
| `updatedAt` | date | yes | 更新时间 |

**Indexes**: `creatorId` (普通索引)

---

### 2. dishes（菜品）

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string (auto) | yes | 菜品唯一 ID |
| `menuId` | string | yes | 所属菜单 ID |
| `name` | string | yes | 菜品名称 |
| `iconUrl` | string | yes | 示意图标（云存储 fileID 或 URL） |
| `price` | number | yes | 单价（H币），正整数 |
| `category` | string | yes | 分类：`breakfast` / `dinner` / `snack` / `drink` |
| `isAvailable` | boolean | yes | 是否可用，默认 true |
| `sortOrder` | number | no | 排序权重，默认 0 |
| `createdAt` | date | yes | 创建时间 |
| `updatedAt` | date | yes | 更新时间 |

**Indexes**: `{ menuId: 1, category: 1 }` (复合索引，用于分类查询)
**Validation**: `price > 0`, `category` 枚举值校验

---

### 3. orders（订单）

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string (auto) | yes | 订单唯一 ID |
| `menuId` | string | yes | 所属菜单 ID |
| `dinerId` | string | yes | 点菜用户 OpenID |
| `dinerName` | string | yes | 点菜用户昵称（冗余，方便显示） |
| `chefId` | string | yes | 厨师 OpenID（菜品的创建者） |
| `items` | array\<OrderItem\> | yes | 菜品明细列表 |
| `totalPrice` | number | yes | 总价（H币），为 items 单价×数量之和 |
| `status` | string | yes | 状态：`placed` / `accepted` / `completed` / `cancelled` |
| `rating` | number | no | 评分 1-5，仅在 status=`completed` 后可为非空 |
| `bonusCoins` | number | no | 评分奖励 H币数量 |
| `idempotencyKey` | string | yes | 幂等键，防重复下单 |
| `placedAt` | date | yes | 下单时间 |
| `acceptedAt` | date | no | 接单时间 |
| `completedAt` | date | no | 完成时间 |
| `cancelledAt` | date | no | 取消时间（仅 status=`cancelled` 时） |
| `ratedAt` | date | no | 评分时间 |

**OrderItem** (内嵌子文档):

| Field | Type | Description |
|-------|------|-------------|
| `dishId` | string | 菜品 ID |
| `dishName` | string | 菜品名称（冗余） |
| `lockedPrice` | number | 加入购物车时锁定的单价 |
| `quantity` | number | 数量 |

**Indexes**:
- `{ dinerId: 1, placedAt: -1 }` — 点菜端历史订单查询
- `{ menuId: 1, status: 1 }` — 厨师端按状态筛选订单
- `{ idempotencyKey: 1 }` (唯一索引) — 幂等去重

---

### 4. users（用户）

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string | yes | 用户 OpenID（作为文档 _id） |
| `nickname` | string | yes | 微信昵称 |
| `avatarUrl` | string | no | 微信头像 URL |
| `coinBalance` | number | yes | 当前 H币余额，默认 10,000 |
| `lastResetMonth` | number | yes | 上次余额重置月份（0-11），用于判断是否需要月初始化 |
| `role` | string | no | 角色标签：`chef` / `diner` / `both` |
| `createdAt` | date | yes | 首次登录时间 |
| `updatedAt` | date | yes | 最后活跃时间 |

**Validation**: `coinBalance >= 0`

---

### 5. transactions（H币流水）

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | string (auto) | yes | 流水唯一 ID |
| `userId` | string | yes | 用户 OpenID |
| `amount` | number | yes | 金额，正为收入负为支出 |
| `type` | string | yes | 类型：`monthly_reset` / `order_pay` / `order_refund` / `order_income` / `rating_bonus` |
| `orderId` | string | no | 关联订单 ID（order_pay 和 rating_bonus 时必填） |
| `balanceAfter` | number | yes | 交易后余额（冗余，便于审计） |
| `description` | string | no | 备注，如"订单#xxx 支付" |
| `createdAt` | date | yes | 交易时间 |

**Indexes**: `{ userId: 1, createdAt: -1 }` — 用户流水查询

---

## State Machine

```
ORDER STATUS:

                         ┌──(diner cancels, refund)──▶ cancelled [已取消]
                         │     ↑ 仅 placed 状态可取消
                         │     │
  placed ──(chef accepts)──▶ accepted ──(chef completes)──▶ completed
  [已下单]  (H币扣款)          [已接单]     (H币→厨师)        [已完成]
                                                               │
                                                    (diner rates 1-5★)
                                                               │
                                                               ▼
                                                         completed + {rating, bonusCoins}
                                                         [已完成/已评分]

RULES:
- placed → accepted: 仅 chefId 匹配用户可触发
- placed → cancelled: 仅 dinerId 匹配用户可触发，H币全额退还，记录 refund 流水
- accepted → completed: 仅 chefId 匹配用户可触发，H币从系统转入厨师余额，记录 income 流水
- completed → rated: 仅 dinerId 匹配用户可触发，不可重复，7天后过期
- 一旦进入 accepted 或 cancelled，不可回退或再次变更
- 删除订单不在此版本范围内
```
