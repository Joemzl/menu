# Implementation Plan: 点菜小程序 — 菜品浏览、下单、接单与H币货币系统

**Branch**: `001-dish-ordering-system` | **Date**: 2026-06-15 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-dish-ordering-system/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

构建一个微信原生点菜小程序，核心能力：厨师端管理菜品（按早餐/晚餐/零食/饮品四分类、含图标+名称+价格、可选密码保护、默认24h菜单有效期）、点菜端浏览分类菜单并通过±按钮点菜、购物车汇总后提交订单、H币（每月10,000额度）实时扣款支付、订单取消与退款（仅"已下单"状态）、厨师端接单/完成订单流转、订单完成后H币自动转入厨师账户、订单历史状态追踪（已下单→已接单→已完成/已取消）、订单完成后的1-5星评分与H币奖励机制。技术方案采用微信小程序原生框架 + 微信云开发（CloudBase），云函数处理核心业务逻辑，云数据库存储订单与流水，watch 实时监听实现状态同步。

## Technical Context

**Language/Version**: JavaScript (ES6+) / 微信小程序 WXML + WXSS

**Primary Dependencies**: 微信小程序基础库 2.x+、微信云开发 SDK（wx.cloud）、云函数（Node.js 18.x 运行时）

**Storage**: 微信云开发文档型数据库（CloudBase Database，类 MongoDB），集合包括：menus、dishes、orders、users、transactions

**Testing**: 微信开发者工具（内置模拟器 + 真机调试）、云函数本地调试、手动验收测试

**Target Platform**: 微信小程序（iOS + Android 微信客户端内运行）

**Project Type**: 微信小程序（mobile-app）+ 云开发后端（mini-app with serverless backend）

**Performance Goals**: 页面首屏加载 < 2s，实时状态同步延迟 < 3s，H币余额更新 < 1s，支持同一菜单 ≥20 人并发点菜

**Constraints**: 必须使用微信云开发免费额度支撑 MVP 阶段、必须通过微信分享接口分发、敏感数据（OpenID）不准在客户端明文存储、小程序包大小 < 2MB

**Scale/Scope**: MVP阶段：1个厨师端 + 最多50个点菜端用户/菜单、4个固定菜品分类、约50道菜品上限

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 检查项 | 状态 |
|------|--------|------|
| **I. 微信生态优先** | 使用微信小程序原生框架 + 微信云开发；登录使用 wx.login；分享使用 onShareAppMessage | ✅ PASS |
| **II. 实时数据同步** | 使用 CloudBase watch 实现订单状态实时监听；禁止轮询；断线重连自动拉最新数据 | ✅ PASS |
| **III. 极简用户体验** | 点菜流程 ≤2 步（浏览+下单）；页面加载目标 <2s；44pt 最小触摸区域 | ✅ PASS |
| **IV. 数据安全与隐私** | 用户只能看自己的订单；创建者可看所有订单但仅限必要信息；OpenID 仅在云函数中使用；菜单支持可选4位数字密码保护（默认公开） | ✅ PASS |
| **V. 渐进式交付** | MVP 仅包含 P1 故事（US1-US3）；每个故事独立可测；优先云开发降低运维成本 | ✅ PASS |

**Gate Result**: ✅ ALL GATES PASSED — No violations, no complexity justifications needed.

## Project Structure

### Documentation (this feature)

```text
specs/001-dish-ordering-system/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── cloud-functions.md   # 云函数接口契约
│   └── database-schema.md   # 数据库集合 schema
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
miniprogram/                    # 微信小程序前端
├── pages/
│   ├── index/                  # 首页：菜单入口 + 角色选择
│   ├── menu-manage/            # 厨师端：菜品管理（增删改 + 密码设置 + 截止时间）
│   ├── menu/                   # 点菜端：分类菜单浏览 + 点菜
│   ├── password-entry/         # 密码验证页（密码保护菜单入口）
│   ├── cart/                   # 购物车 + 下单确认
│   ├── chef-orders/            # 厨师端：订单消息列表 + H币余额
│   ├── history/                # 点菜端：历史订单
│   └── order-detail/           # 订单详情（含评分入口 + 取消按钮）
├── components/
│   ├── category-bar/           # 左侧分类栏组件
│   ├── dish-card/              # 菜品卡片（图标+名称+价格±按钮）
│   ├── cart-summary/           # 购物车汇总条
│   ├── star-rating/            # 星级评分组件
│   └── status-badge/           # 订单状态标签（含"已取消"灰色）
├── utils/
│   ├── api.js                  # 云函数调用封装
│   ├── auth.js                 # 微信登录封装
│   └── constants.js            # 常量（分类、状态、评分规则、菜单默认24h）
├── app.js
├── app.json
└── app.wxss

cloudfunctions/                 # 微信云开发云函数
├── login/                      # 微信登录 + 用户初始化（点菜端月H币 + 厨师端账户）
│   ├── index.js
│   └── package.json
├── menu/                       # 菜单与菜品 CRUD + 密码验证 + 截止时间管理
│   ├── index.js
│   └── package.json
├── order/                      # 下单 + 取消 + 状态流转 + H币扣款/退款 + 厨师入账
│   ├── index.js
│   └── package.json
├── rating/                     # 评分 + H币奖励发放
│   ├── index.js
│   └── package.json
└── schedule/                   # 定时触发器：月度H币重置（点菜端 + 厨师端）
    ├── index.js
    └── package.json
```

**Structure Decision**: 采用微信小程序 + 云开发的经典分层结构。`miniprogram/` 为小程序前端代码，`cloudfunctions/` 为云函数后端。前后端通过 `wx.cloud.callFunction` 通信，无独立 HTTP API 层。云函数按业务域划分（login/menu/order/rating/schedule），每个域独立部署和调试。

## Complexity Tracking

> **No violations detected. This section intentionally left empty.**
