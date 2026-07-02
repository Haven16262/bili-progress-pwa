# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**上一阶段：** 多P进度卡死修复 — 一键标记完成观看（已完成并 commit `cf4cf1e`，详见 `context_history.md`）

_当前无进行中任务，等待全局者写入下一阶段方向。_

**Backlog（下轮可选，建议凑一个代码质量小轮）：**
- `server/src/routes/videos.js` 三处 `:id` 校验统一改为 `Number.isInteger(id) && id > 0`（critic MEDIUM）
- `client/src/components/AddVideoModal.vue` 与编辑弹窗同病：`z-50` + 手机底部贴边会被 BottomNav 遮底部，改为 `z-[51]` + 居中

---

## 跨 Phase 关键约定

<!-- 稳定,极少改动。只放影响后续所有工作的决策。用指针,不复制 spec 内容 -->

- **圆柱体列数存储**：手机/平板/桌面三种设备类型的「每行列数」全部独立存 `localStorage`（key: `columns_mobile` / `columns_tablet` / `columns_desktop`），不使用服务端 `columns_per_row` 作为列数来源（服务端字段保留但已不参与列数控制）
- **设备类型判断**：用屏幕宽度断点识别（≤768 手机，≤1024 平板，其余桌面），不依赖 User-Agent，具体逻辑见 `HomePage.vue` / `SettingsPage.vue` 的 `getDeviceType()`
- **App.vue 外层容器**：须为 `h-screen`（非 `min-h-screen`），否则 `<main>` 的 `overflow-auto` 不会生效，详见 `context_history.md` 中「设置页滚动修复」一节
- **弹窗层级**：BottomNav 是 `z-50` 且在 DOM 中位于 `<router-view>` 之后，同 z-index 时导航栏胜出。所有全屏遮罩类弹窗必须 `z-[51]` 或更高，且手机端优先居中布局而非底部贴边
- **手动完成视频不参与同步重算**：`manually_completed=1` 的视频永久跳过每日同步的 B站 数据重算，只走归档倒计时，不会被真实观看记录覆盖回低进度
- **「已观看完视频」定义**：`progress>=100 OR archived=1`，不区分是手动标记还是自然看完达成
- **归档 = 永久软隐藏，非删除**：`archived=1` 只从首页列表隐藏，记录永久保留在数据库，没有自动删除机制，也不新增（用户已确认维持现状）
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

## [2026-07-02 18:30] 全局者 — Phase 关闭：多P进度卡死修复

**交付汇总：**
- `videos` 表新增 `manually_completed` 列（含旧库 ALTER TABLE 迁移）
- 新增 `POST /api/videos/:id/complete`、`GET /api/videos/completed`（requireAuth 覆盖）
- `runSync` 双阶段：手动完成视频跳过 B站 重算 + 独立归档倒计时（满 3 天 `archived=1`）
- 主页编辑弹窗：「标记为已看完」按钮（confirm 确认）、全尺寸居中、`z-[51]`、去自动聚焦
- 设置页：`<details>` 折叠「已观看完视频」列表（默认收起，刷新即复位）
- 顺带修复：工作者测试残留脏数据（OS progress 经同步自愈回 37.11）

**Commit 链：** `cf4cf1e` feat（本 Phase 全部代码）；工作流三段式升级 + 本次归档见后续 chore commit

**Critic 总览：** 1 次审查（新增写接口），结论可放行；1 个 MEDIUM（`:id` 校验偏松）入 backlog

**Backlog：** 见「当前状态」区块

**真机验证：** 用户确认通过（弹窗居中、三按钮可见可点、无自动键盘、折叠列表正常）

**完整轮次原文：** 已归档 `context_history.md`「Phase：多P进度卡死修复」段
