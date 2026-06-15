# Tasks: 点菜小程序 — 菜品浏览、下单、接单与H币货币系统

**Input**: Design documents from `specs/001-dish-ordering-system/spec.md`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/

**Tests**: Manual validation via quickstart.md scenarios (12 scenarios, VS-1 through VS-12).

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **miniprogram/**: 微信小程序前端代码
- **cloudfunctions/**: 微信云开发云函数

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create root project directories: miniprogram/pages/index/, miniprogram/pages/menu-manage/, miniprogram/pages/menu/, miniprogram/pages/password-entry/, miniprogram/pages/cart/, miniprogram/pages/chef-orders/, miniprogram/pages/history/, miniprogram/pages/order-detail/, miniprogram/components/category-bar/, miniprogram/components/dish-card/, miniprogram/components/cart-summary/, miniprogram/components/star-rating/, miniprogram/components/status-badge/, miniprogram/utils/, cloudfunctions/login/, cloudfunctions/menu/, cloudfunctions/order/, cloudfunctions/rating/, cloudfunctions/schedule/
- [ ] T002 Initialize miniprogram app shell: miniprogram/app.js, miniprogram/app.json, miniprogram/app.wxss
- [ ] T003 [P] Create constants file with category list (breakfast/dinner/snack/drink), order status enums (placed/accepted/completed/cancelled), rating bonus rules, default menu expiry (24h), max password attempts (3), lockout duration (30s) in miniprogram/utils/constants.js
- [ ] T004 [P] Create CloudBase environment configuration, cloud function call wrapper with loading/error handling, and error code constants in miniprogram/utils/api.js
- [ ] T005 [P] Create WeChat auth utility with wx.login + login cloud function wrapper, cache user info + coin balance to app.globalData in miniprogram/utils/auth.js
- [ ] T006 Create all cloud function scaffold directories with package.json (Node.js 18.x, wx-server-sdk dependency) in cloudfunctions/login/, cloudfunctions/menu/, cloudfunctions/order/, cloudfunctions/rating/, cloudfunctions/schedule/

**Checkpoint**: Project skeleton ready. CloudBase environment configured in WeChat DevTools.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Database

- [ ] T007 Create CloudBase database collections (menus, dishes, orders, users, transactions) with indexes and permission rules per contracts/database-schema.md — include password field in menus, cancelledAt in orders, order_refund + order_income in transactions validation

### Cloud Functions — Core

- [ ] T008 Implement login cloud function: wx.login → getUser → auto-create user, set coinBalance=10000 (diner role) or coinBalance=0 (chef role), lastResetMonth=currentMonth, return user info + balance in cloudfunctions/login/index.js
- [ ] T009 [P] Implement menu cloud function getMenu action: fetch menu doc + all dishes by menuId, ordered by sortOrder in cloudfunctions/menu/index.js
- [ ] T010 [P] Implement order cloud function getOrders action: diner query by dinerId + placedAt desc, chef query by menuId + optional status filter in cloudfunctions/order/index.js
- [ ] T011 [P] Implement schedule cloud function: monthly H-coin reset via cron 0 0 1 * * * *, update all users where lastResetMonth != currentMonth, reset to 10000, record monthly_reset transactions in cloudfunctions/schedule/index.js
- [ ] T012 [P] Implement menu cloud function verifyPassword action: check menu.password, track failed attempts, lock for 30s after 3 failures in cloudfunctions/menu/index.js
- [ ] T013 Deploy all foundational cloud functions (login, menu-getMenu+verifyPassword, order-getOrders, schedule) to CloudBase

### App Shell

- [ ] T014 Implement app.js onLaunch: call login cloud function, cache user info + coinBalance to globalData
- [ ] T015 Configure app.json with all page routes (index, menu-manage, menu, password-entry, cart, chef-orders, history, order-detail) and tabBar if needed
- [ ] T016 Create global styles in miniprogram/app.wxss: color variables (primary/secondary/status colors), card styles, button styles, 44pt minimum touch area, empty state placeholders, password input styles

**Checkpoint**: Foundation ready — login works, database collections exist, core cloud functions deployed. User story implementation can begin.

---

## Phase 3: User Story 1 — 菜品管理与分类浏览 (Priority: P1) 🎯 MVP

**Goal**: 厨师创建菜单（含可选密码+24h截止时间）并添加/删除/修改菜品，点菜端按四分类浏览菜单，空分类显示提示

**Independent Test**: 创建菜单设置密码"8888"，添加4道分属不同分类的菜品，分享给另一用户，用户输入密码后可看到分类栏并能切换分类

### Implementation for User Story 1

- [ ] T017 [P] [US1] Implement menu cloud function addDish action: validate category enum, price>0, creator-only permission, set timestamps in cloudfunctions/menu/index.js
- [ ] T018 [P] [US1] Implement menu cloud function updateDish + deleteDish actions: creator-only check, delete sets isAvailable=false, update sets updatedAt in cloudfunctions/menu/index.js
- [ ] T019 [US1] Create index page: role selection (chef/diner), create new menu form (title, optional password with toggle, custom expiry time defaulting to now+24h), existing menu list in miniprogram/pages/index/index.js + .wxml + .wxss
- [ ] T020 [US1] Create menu-manage page: menu title + password + expiry display/edit, add-dish form (name, icon upload via wx.chooseImage + cloud.uploadFile, price input, category picker), dish list with edit/delete actions in miniprogram/pages/menu-manage/menu-manage.js + .wxml + .wxss
- [ ] T021 [US1] Create password-entry page: numeric keypad UI, 4-digit input mask, error count display, lockout countdown, call verifyPassword cloud function on confirm, navigate to menu on success in miniprogram/pages/password-entry/password-entry.js + .wxml + .wxss
- [ ] T022 [US1] Create category-bar component: vertical left sidebar with 4 categories (早餐/晚餐/零食/饮品), active state highlight, tap-to-switch event in miniprogram/components/category-bar/
- [ ] T023 [US1] Create dish-card component: dish icon image, name text, price label, card layout in miniprogram/components/dish-card/
- [ ] T024 [US1] Create menu page (diner view): receive menuId from share/navigate query, check menu.password → navigate to password-entry if set, check menu.expiryTime → show "已结束" if expired, integrate category-bar + dish-card, filter dishes by selected category, show "该分类暂无菜品" for empty categories, CloudBase watch for real-time dish updates in miniprogram/pages/menu/menu.js + .wxml + .wxss
- [ ] T025 [US1] Add CloudBase watch on dishes collection (where menuId) in menu page and menu-manage page for real-time add/delete/update sync
- [ ] T026 [US1] Implement image upload flow: wx.chooseImage → cloud.uploadFile → store cloud fileID as iconUrl, show upload progress in menu-manage page

**Checkpoint**: US1 fully functional — chef can CRUD dishes with expiry + optional password, diner can browse categorized menu with live sync

---

## Phase 4: User Story 2 — 点菜、购物车与H币支付 (Priority: P1) 🎯 MVP

**Goal**: 点菜端使用±按钮选菜，购物车汇总并展示总价，下单时菜单过期校验+H币扣款+幂等防重

**Independent Test**: 用户选2份馒头(30H币/份)+1杯橙汁(20H币/份)，购物车显示80H币，下单后余额减少80

### Implementation for User Story 2

- [ ] T027 [US2] Add cart state management (add/remove/updateQuantity/clearCart) using page-local data, store dishId + dishName + lockedPrice + quantity, generate new idempotencyKey (UUID) on cart change in miniprogram/pages/menu/menu.js
- [ ] T028 [P] [US2] Update dish-card component: add +/- quantity buttons below price, emit quantity-change event with dishId+lockedPrice, display current quantity badge, disable buttons when menu expired in miniprogram/components/dish-card/
- [ ] T029 [P] [US2] Create cart-summary component: floating bottom bar showing total item count + total H-coin price, tap to open cart page, hide when cart empty in miniprogram/components/cart-summary/
- [ ] T030 [US2] Create cart page: full item list with dish name, lockedPrice, quantity ±, subtotal per item, total H-coin summary, empty cart placeholder "购物车空空如也", "下单" button disabled when cart empty in miniprogram/pages/cart/cart.js + .wxml + .wxss
- [ ] T031 [US2] Implement order cloud function placeOrder action: menu expiry check → cart non-empty check → idempotency check → transaction (read diner balance → check sufficient → deduct coins → create order status=placed → record transaction type=order_pay) in cloudfunctions/order/index.js
- [ ] T032 [US2] Wire cart page "下单" button: call order.placeOrder, handle success (clear cart, show new balance toast), handle INSUFFICIENT_COINS (toast "H币不足，请调整"), handle MENU_EXPIRED (toast "菜单已结束"), handle duplicate (silent success)
- [ ] T033 [US2] Add H-coin balance display to menu page header (read from globalData, refresh after order) and cart page footer

**Checkpoint**: US2 fully functional — diner can select dishes, review cart, place order with H-coin payment, duplicate + expiry prevention

---

## Phase 5: User Story 3 — 厨师端订单处理 (Priority: P1) 🎯 MVP

**Goal**: 厨师端收到新订单，可接单和完成，完成后H币自动转入厨师余额

**Independent Test**: 下单后厨师收到新订单 → 接单 → 完成 → 厨师余额增加订单金额

### Implementation for User Story 3

- [ ] T034 [P] [US3] Create status-badge component: display status text with color coding (placed=orange, accepted=blue, completed=green, cancelled=gray) in miniprogram/components/status-badge/
- [ ] T035 [US3] Create chef-orders page: order list with diner name, total price, placedAt time, status-badge; sorted by placedAt descending; tap to expand order detail (items list); display chef H-coin balance in header in miniprogram/pages/chef-orders/chef-orders.js + .wxml + .wxss
- [ ] T036 [US3] Implement order cloud function acceptOrder action: validate chefId matches, status must be "placed", update status→"accepted" + acceptedAt timestamp in cloudfunctions/order/index.js
- [ ] T037 [US3] Implement order cloud function completeOrder action: validate chefId matches, status must be "accepted"; transaction (update status→"completed" + completedAt → add totalPrice to chef coinBalance → record transaction type=order_income for chef) in cloudfunctions/order/index.js
- [ ] T038 [US3] Add "接单" button to order detail in chef-orders page (visible when status=placed), on tap call acceptOrder
- [ ] T039 [US3] Add "完成" button to order detail in chef-orders page (visible when status=accepted, replaces 接单), on tap call completeOrder, update chef balance display
- [ ] T040 [US3] Add CloudBase watch on orders collection (where menuId) in chef-orders page for real-time new order notifications and status updates
- [ ] T040a [US3] Add chef H-coin transaction history section to chef-orders page: load transactions where userId=chefId filtered by type order_income + monthly_reset, display list with amount/type/orderId/time, sorted by createdAt descending per FR-016

**Checkpoint**: US3 fully functional — complete order lifecycle with chef H-coin earnings + transaction history: diner places → chef accepts → chef completes (+coins + visible flow)

---

## Phase 6: User Story 4 — 订单历史与状态追踪 (Priority: P2)

**Goal**: 点菜端和厨师端均可查看历史订单（含已取消），状态实时更新，厨师端可按状态筛选

**Independent Test**: 点菜端提交3份订单（已下单/已接单/已完成）+ 1份取消，历史订单显示4条各有对应状态

### Implementation for User Story 4

- [ ] T041 [US4] Implement order cloud function cancelOrder action: validate dinerId matches, status must be "placed"; transaction (update status→"cancelled" + cancelledAt → add totalPrice back to diner coinBalance → record transaction type=order_refund) in cloudfunctions/order/index.js
- [ ] T042 [US4] Create history page (diner view): load orders by dinerId via order.getOrders, display list with status-badge (incl. cancelled), totalPrice, item summary, placedAt, tap to expand full detail, "取消订单" button for placed-status orders in miniprogram/pages/history/history.js + .wxml + .wxss
- [ ] T043 [US4] Add CloudBase watch on diner's orders in history page for real-time status updates (placed→accepted→completed)
- [ ] T044 [US4] Wire cancel button in history page: call order.cancelOrder, on success show refund amount toast + update status to cancelled + refresh balance
- [ ] T045 [US4] Add status filter tabs to chef-orders page: "全部"/"已下单"/"已接单"/"已完成"/"已取消", re-query with status filter on tap
- [ ] T046 [US4] Create order-detail page (read-only view): header with status-badge + all timestamps (placed/accepted/completed/cancelled), itemized list with dishName × quantity × lockedPrice, total price summary, chef income display if chef viewing; accessible from history and chef-orders pages in miniprogram/pages/order-detail/order-detail.js + .wxml + .wxss

**Checkpoint**: US4 fully functional — both sides have complete order history with cancellation, refund, and real-time status

---

## Phase 7: User Story 5 — 订单评分与H币奖励 (Priority: P2)

**Goal**: 订单完成后可评分1-5星，按星级发放H币奖励，禁止重复，7天过期

**Independent Test**: 完成订单后评4星 → H币余额立即增加100，评2星 → 余额不变

### Implementation for User Story 5

- [ ] T047 [P] [US5] Create star-rating component: display 5 tappable stars, highlight selected rating, read-only mode for already-rated orders, hide when order cancelled or not completed in miniprogram/components/star-rating/
- [ ] T048 [US5] Implement rating cloud function submitRating action: validate order status=completed + dinerId match + rating is null + completedAt within 7 days; transaction (update order rating+bonusCoins → add bonusCoins to diner balance → record transaction type=rating_bonus) in cloudfunctions/rating/index.js
- [ ] T049 [US5] Add rating section to order-detail page: show star-rating when status=completed and unrated, show "已评分 ★X星 +X H币" when rated, show "评分已过期(>7天)" when expired
- [ ] T050 [US5] Wire star-rating submit: call rating.submitRating, on success update order-detail (stars + bonus + new balance), hide rating component
- [ ] T051 [US5] Add rating results display to history page order items: show star rating and bonus coins for rated orders

**Checkpoint**: US5 fully functional — rating flow with bonus, expiry, duplicate prevention

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T052 [P] Implement WeChat share functionality: onShareAppMessage in menu page (share menu with title + path params), in chef-orders page (share order summary), sharing card excludes password in path params
- [ ] T053 [P] Add empty state handling: menu page "暂无菜品，等待厨师添加" when all categories empty, history page "暂无订单记录" placeholder, chef-orders page "暂无新订单" placeholder
- [ ] T054 Add loading states (wx.showLoading/wx.hideLoading) to all cloud function calls and page data fetches across all pages
- [ ] T055 Add error handling with user-friendly toasts for: network failures, cloud function errors, transaction conflicts, menu expiry, password lockout across all pages
- [ ] T056 Add pull-to-refresh (onPullDownRefresh) on menu page, chef-orders page, and history page as fallback for watch reconnection
- [ ] T057 Code cleanup: extract repeated patterns (cloud function call wrapper with loading/error handling), ensure consistent naming conventions, verify all FR numbers map to implementations
- [ ] T058 Run quickstart.md validation: execute all 12 validation scenarios (VS-1 through VS-12), fix issues found
- [ ] T059 [P] Execute concurrent order stress test per SC-007: ≥20 simultaneous placeOrder calls from different user accounts on same menu, verify no data corruption/duplicate charges/negative balances
- [ ] T060 Deploy all cloud functions to CloudBase production environment and verify scheduled trigger is active

**Checkpoint**: Feature ready for production review — all flows work, share enabled, error handling complete, 12 scenarios validated

---

## Dependencies & Execution Order

### Phase Dependencies

```
Setup (Phase 1) → Foundational (Phase 2) ──BLOCKS──▶ US1 (P1) ──▶ US2 (P1) ──▶ US3 (P1) ──▶ US4 (P2) ──▶ US5 (P2) ──▶ Polish
```

| Phase | Depends On | Blocks |
|-------|-----------|--------|
| Phase 1 Setup | — | — |
| Phase 2 Foundational | Phase 1 | All user stories |
| Phase 3 US1 | Phase 2 | US2 (needs dish-card) |
| Phase 4 US2 | US1 (dish-card, menu page) | US3 (needs placed orders) |
| Phase 5 US3 | US2 (placeOrder) | US4 (needs all statuses) |
| Phase 6 US4 | US1+US2+US3 | US5 (needs completed orders + order-detail) |
| Phase 7 US5 | US3+US4 | — |
| Phase 8 Polish | All stories | — |

### Parallel Opportunities

- **Phase 1**: T003, T004, T005 can run in parallel (different utils files)
- **Phase 2**: T009, T010, T011, T012 can run in parallel (different cloud functions)
- **US1**: T017, T018 can run in parallel (same cloud function, different actions); T022, T023 can run in parallel (different components)
- **US2**: T028, T029 can run in parallel (different components)
- **US5**: T047 can run in parallel with T048 (component vs cloud function)
- **Phase 8**: T052, T053 can run in parallel (share config vs empty states)

---

## Parallel Example: User Story 1

```bash
# Launch cloud function additions in parallel:
Task: "Implement menu cloud function addDish action in cloudfunctions/menu/index.js"
Task: "Implement menu cloud function updateDish + deleteDish actions in cloudfunctions/menu/index.js"

# Launch component builds in parallel:
Task: "Create category-bar component in miniprogram/components/category-bar/"
Task: "Create dish-card component in miniprogram/components/dish-card/"
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Phase 1: Setup (T001–T006)
2. Phase 2: Foundational (T007–T016)
3. Phase 3: User Story 1 (T017–T026)
4. **STOP and VALIDATE**: Chef CRUD dishes + password + expiry, diner browses categorized menu
5. This is already a shareable menu system

### MVP+ (US1 + US2 + US3) — Full Transaction Flow

1. Setup + Foundational → US1 → US2 → US3
2. **STOP and VALIDATE**: Complete order lifecycle (browse → order → pay → accept → complete + chef earns + transaction history)
3. This is the minimum viable feature per constitution Principle V

### Incremental Delivery

| Milestone | Phases | Tasks | What's Delivered |
|-----------|--------|-------|------------------|
| M1 | P1+P2+US1 | 26 | Menu system with categories + password + expiry |
| M2 | +US2 | 33 | Ordering with H-coin payment + cart |
| M3 | +US3 | 41 | Chef order processing + coin earnings + transaction history |
| M4 | +US4 | 47 | History + cancellation + refund |
| M5 | +US5 | 52 | Rating + bonus system |
| Final | +Polish | 62 | Production-ready with share + error handling + stress test |

---

## Notes

- **Total tasks**: 62
- **MVP (US1-US3)**: 41 tasks — covers complete order lifecycle + chef transaction history
- [P] tasks can run in parallel (different files, no shared dependencies)
- Each user story has an independent test checkpoint in quickstart.md
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- New since last version: password-entry page, cancelOrder actions, menu expiry checks, chef coin transfer + transaction history, concurrent stress test
- Chef initial balance = 0 (earns only through order completion per FR-012)
