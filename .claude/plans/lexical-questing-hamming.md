# 执行计划：多P进度卡死问题修复

## Context

全局者已完成详细技术方案（context.md 任务清单），工作者按清单逐项执行。8 个任务覆盖：DB schema → queries → routes → sync 改造 → 前端 API → HomePage → SettingsPage → 构建验证。

## 执行顺序

按依赖关系串行执行（后续任务依赖前面的 schema/queries/routes）：

### 任务 1：DB schema — `manually_completed` 列
- 文件：`server/src/db/init.js`
- 方案：`initSchema()` 里 `PRAGMA table_info(videos)` 检测列是否存在，不存在则 ALTER TABLE ADD COLUMN
- 完成标准：新库和已有 data.db 都能启动

### 任务 2：DB queries — 三个新函数
- 文件：`server/src/db/queries.js`
- 三个函数：`markVideoCompleted(id)`, `getManuallyCompletedBvids()`, `listCompletedVideos()`
- 风格对齐现有 `getDb()` + `db.prepare().run/all/get` 模式

### 任务 3：Routes — 两个新路由
- 文件：`server/src/routes/videos.js`
- `POST /:id/complete` + `GET /completed`
- 复用 `requireAuth`、现有 id 校验

### 任务 4：Sync 改造
- 文件：`server/src/services/sync.js`
- 载入 manuallyCompletedSet → 主循环跳过 → 结束后独立归档逻辑

### 任务 5：前端 API
- 文件：`client/src/services/api.js`
- 新增 `markVideoCompleted(id)` / `getCompletedVideos()`

### 任务 6：HomePage 按钮
- 文件：`client/src/views/HomePage.vue`
- 编辑弹窗加「标记为已看完」按钮 + confirm + 本地状态更新

### 任务 7：SettingsPage 折叠列表
- 文件：`client/src/views/SettingsPage.vue`
- `<details>` 折叠区块，加载 completed videos 列表

### 任务 8：构建 + 冒烟验证
- `npm run build` + 重启服务 + curl 测试

## 验证

- 任务 1-4：重启 server 不报错，curl 验证新接口
- 任务 5-7：`npm run build` 不报错，浏览器验证交互
- 任务 8：完整冒烟测试
