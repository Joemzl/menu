# MenuOrder Constitution

<!--
Sync Impact Report
==================
Version Change: N/A → 1.0.0 (Initial constitution)
Modified Principles: N/A (initial creation)
Added Sections:
  - Core Principles (5 principles)
  - Technology Stack
  - Development Workflow
  - Governance
Removed Sections: None
Templates Requiring Updates:
  - .specify/templates/plan-template.md (pending review)
  - .specify/templates/spec-template.md (pending review)
  - .specify/templates/tasks-template.md (pending review)
Follow-up TODOs: None
-->

## Core Principles

### I. 微信生态优先 (WeChat-First)
所有功能 MUST 优先适配微信小程序环境：
- 页面路由和交互 MUST 符合微信小程序设计规范；
- 支持微信聊天中一键分享菜单和订单，被分享者可直接打开参与点菜；
- 登录 MUST 使用微信一键授权（wx.login + getUserProfile），禁止要求用户名密码注册；
- 分享卡片 MUST 包含菜单名称、截止时间等关键信息。
**Rationale**: 项目核心场景是微信社交场景下的协作点菜，脱离微信生态将失去核心用户价值。

### II. 实时数据同步
点菜数据 MUST 在各用户之间保持实时同步：
- 用户B点菜后，用户A MUST 能在 3 秒内看到更新；
- 多人同时点菜 MUST 使用冲突解决策略（如最后写入胜出 + 乐观锁）；
- 禁止使用轮询方式同步数据，MUST 使用 WebSocket 或微信云开发实时数据监听；
- 断线重连后 MUST 自动拉取最新数据。
**Rationale**: 核心体验是"A看B点了什么"，延迟将导致误点、重复点菜。

### III. 极简用户体验
操作流程 MUST 追求最少步骤：
- 创建菜单流程 MUST 不超过 3 步（输入名称 → 添加菜品 → 分享）；
- 点菜流程 MUST 不超过 2 步（打开链接 → 勾选菜品并确认）；
- 页面加载时间 MUST < 2 秒，首屏 SHOULD 优先渲染关键信息；
- 所有按钮和交互元素 SHOULD 符合微信小程序 44pt 最小触摸区域标准。
**Rationale**: 聚餐场景下用户耐心有限，复杂操作导致放弃率上升。

### IV. 数据安全与隐私
用户数据 MUST 得到充分保护：
- 用户B只能看到自己点了什么，MUST NOT 看到其他用户B的个人信息；
- 用户A（创建者）可以看到所有用户的点菜内容，但 MUST NOT 获取非必要的微信个人信息；
- 菜单数据 MUST 支持设置访问权限（仅分享链接可访问 / 密码访问）；
- 敏感数据（如微信 OpenID）MUST NOT 在客户端明文存储或日志输出。
**Rationale**: 涉及多人社交数据，隐私泄露会严重影响用户信任和产品合规性。

### V. 渐进式交付
功能开发 MUST 遵循 MVP → 迭代模式：
- 第一个可发布版本 MUST 包含：创建菜单、添加菜品、分享、点菜、查看结果；
- 每个新功能 MUST 独立可测试，不得阻塞已有功能发布；
- 优先使用微信云开发降低后端运维成本，如后续规模扩大再考虑自建后端；
- 代码 MUST 保持简单，遵循 YAGNI（You Aren't Gonna Need It）原则。
**Rationale**: 早期过度设计会拖慢验证速度，快速上线获取真实反馈是第一要务。

## Technology Stack

本项目技术栈约束如下：

- **前端**: 微信小程序原生框架（WXML + WXSS + JavaScript / TypeScript）；
- **后端**: 微信云开发（CloudBase），优先使用云函数 + 云数据库 + 云存储；
- **实时通信**: 微信云开发实时数据监听（watch）或云函数 WebSocket；
- **数据库**: 云开发文档型数据库（类似 MongoDB）；
- **用户认证**: 微信登录（wx.login + 云函数获取 openid）；
- **分享**: 微信小程序分享接口（onShareAppMessage）；
- **部署**: 微信云开发自动部署 + 小程序代码审核上传。

新增技术选型 MUST 经过评估：是否增加用户端体积、是否兼容微信环境、是否有免费额度支撑 MVP 阶段。

## Development Workflow

开发流程遵循以下规则：

- 代码 MUST 托管在 Git 仓库，使用 main 分支作为稳定分支；
- 新功能开发 MUST 从 feature 分支开始，完成后通过 PR 合并；
- 每个 PR MUST 包含功能描述和手动测试步骤说明；
- 微信开发者工具 MUST 用于本地调试和预览；
- 发布前 MUST 在微信开发者工具真机调试模式下验证分享和实时同步功能；
- 原则上每个 Sprint 不超过 1 周，MVP 阶段 Sprint 不超过 3 天。

## Governance

本宪法是 MenuOrder 项目的最高指导文件。所有设计决策、代码审查、功能优先级排序 MUST 参照本宪法原则进行评估。

- **修订流程**: 任何团队成员可提出宪法修订建议，需说明修改原因和影响范围，经项目负责人批准后生效；
- **版本规则**: 采用语义化版本（MAJOR.MINOR.PATCH），原则增删属 MAJOR，原则重大修改属 MINOR，文字修正属 PATCH；
- **合规审查**: 每个迭代结束后 MUST 回顾本宪法的执行情况，发现偏差在下个迭代中纠正；
- **冲突处理**: 当原则之间发生冲突时，编号靠前的原则优先（I > II > III > IV > V）；
- **运行时指导**: 日常开发请参考 `CODEBUDDY.md` 获取具体命令和项目结构信息；
- 任何违反本宪法核心原则的代码 MUST NOT 合并入 main 分支。

**Version**: 1.0.0 | **Ratified**: 2026-06-15 | **Last Amended**: 2026-06-15
