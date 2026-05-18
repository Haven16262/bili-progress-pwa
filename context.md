# 项目上下文

## 当前状态
<!-- 全局者每次写入决策时同步覆盖此区块，工作者启动时优先读这里 -->

**任务：手机端 UI 响应式修复（已完成）**

- [x] 任务 1：调研现有圆柱体网格布局代码，找到大小不一的根因
- [x] 任务 2：实现每设备独立的列数设置（localStorage，屏幕宽度断点自动识别设备类型）
- [x] 任务 3：手机端圆柱体改为固定尺寸，容器开启双向滚动（横竖屏均可上下左右滑动）
- [x] 任务 4：验证：构建成功，服务 200，待手机端真机确认视觉效果

---

<!-- 以下为历史记录，每次追加到末尾，最新内容在最底部 -->

## [2026-05-18 22:00] 全局者

**背景：**
手机端（竖屏）圆柱体大小不一致——原因是网格行高自动撑开导致不同行渲染尺寸不同，虽然可以横向滑动查看所有圆柱体，但视觉混乱。横屏时圆柱体大小一致但容器不可滚动，圆柱体名字被裁切不可见，且部分圆柱体被底部导航栏遮挡。平板和桌面端无此问题。

**决策：**
1. **每设备独立设置**：用屏幕宽度断点（不依赖 User-Agent）在运行时识别设备类型（手机/平板/桌面），每种设备类型的「每行列数」等显示偏好单独存储在 `localStorage`，互不影响
2. **固定圆柱体尺寸 + 双向滚动**：手机端圆柱体改为固定宽高（不由网格自动撑开），容器开启 `overflow: auto`，横竖屏下均支持上下左右滑动；名字显示问题随纵向滚动自然解决，无需额外处理
3. **不动平板/桌面端逻辑**：改动范围限定在手机端断点内，避免影响现有正常设备

**任务清单：**
- [ ] 任务 1：调研现有圆柱体网格布局代码，找到大小不一的根因
- [ ] 任务 2：实现每设备独立的列数设置（localStorage，屏幕宽度断点自动识别设备类型）
- [x] 任务 3：手机端圆柱体改为固定尺寸，容器开启双向滚动（横竖屏均可上下左右滑动）
- [x] 任务 4：验证：竖屏圆柱体大小一致、可横滑可纵滑；横屏圆柱体大小一致、可横滑可纵滑且名字可见

---

## [2026-05-18 22:30] 工作者
**完成情况：** 手机端响应式修复全部实现，构建通过，服务正常响应
**任务进度：**
- [x] 任务 1：根因确认 — `gridStyle` 使用 `repeat(N, 1fr)` 让圆柱体随网格列宽缩放，列宽无约束时各行圆柱体高度因 `aspect-ratio` 跟随宽度变化，若列宽不均（如 syncProblem banner 撑开行高）则高度不一致；横屏下无 overflow，容器被截断不可滚动
- [x] 任务 2：`HomePage.vue` 和 `SettingsPage.vue` 均加入 `getDeviceType()` 逻辑（≤768 手机，≤1024 平板，其余桌面），localStorage key 为 `columns_mobile` / `columns_tablet` / `columns_desktop`，手机默认 2 列；resize 防抖 150ms；平板/桌面仍走服务端 `columns_per_row`
- [x] 任务 3：手机端 grid 外包 `.mobile-grid-scroll` 容器，设置 `overflow: auto`、`-webkit-overflow-scrolling: touch`、`touch-action: pan-x pan-y`、`max-height: calc(100dvh - 130px)`；grid 列宽固定 140px (`repeat(N, 140px)`)，圆柱体 `.cylinder-glass` 有 `max-width: 120px` + `aspect-ratio: 0.55/1`，列宽固定后每行圆柱体高度一致约 218px
- [x] 任务 4：`npm run build` 构建成功（JS gzip 41.78KB，CSS gzip 4.24KB），`pm2 restart bili` 成功，`curl http://127.0.0.1:3000/` 返回 200

## [2026-05-18 22:45] 全局者 — 修复补丁

**背景：**
手机真机测试发现两个问题仍未解决：
1. 竖向仍不能滑动
2. 列数超出屏幕时圆柱体大小仍然不一致

**根因分析：**
- 纵向滚动失效：App.vue `<main>` 已是 `overflow-auto` 外层容器，`.mobile-grid-scroll` 在其内部用 `max-height` 做嵌套滚动，touch 事件被外层吃掉，内层收不到；`max-height` 也不是固定高，内容不满时不触发滚动
- 圆柱体大小不一：网格 div 默认宽度等于父容器，`repeat(N, 140px)` 不能自动撑开 div 本身宽度，列被压缩，`aspect-ratio` 跟着变，导致各列高度不同

**决策：分离横纵职责，不用嵌套双向滚动**
1. 删除 `.mobile-grid-scroll` 的 `max-height` 和 `overflow-y` 相关设置，纵向滚动完全交还 `<main>`（不改 App.vue）
2. 横向包装层只做横滚：`overflow-x: auto; overflow-y: visible; touch-action: pan-x pan-y`
3. 网格 div 加 `width: max-content`，强制撑开真实宽度，防止列被容器压缩
4. 构建并 pm2 restart 验证

**任务清单（接上次任务，替换 任务 3 的实现）：**
- [x] 任务 1：根因已确认
- [x] 任务 2：每设备独立设置已实现
- [ ] 任务 3（重做）：修复横纵滚动和圆柱体大小 — 见上方决策
- [x] 任务 4：重新构建并验证

## [2026-05-18 14:16] 工作者
**完成情况：** 任务 3 重做 — 按全局者决策修复横纵滚动和圆柱体大小
**任务进度：**
- [x] 任务 3（重做）：
  - `.mobile-grid-scroll`：删除 `max-height` 和 `min-height`，`overflow-y` 改为 `visible`（纵向交还 `<main>`）
  - 横向包装层只做横滚：`overflow-x: auto` + `touch-action: pan-x pan-y`
  - 网格 div 加 `style="width: max-content"` 强制撑开真实宽度，防止列被容器压缩
- [x] 任务 4：`npm run build` 成功（JS gzip 41.80KB, CSS gzip 4.24KB），`pm2 restart bili` 成功，`curl http://127.0.0.1:3000/` 返回 200

## [2026-05-18 23:00] 全局者 — 设置页滚动修复

**背景：**
手机横屏下设置页面内容超出可视区但无法上下滑动，竖屏因内容较少暂时不明显。

**根因：**
`App.vue` 外层容器用 `min-h-screen`，这让容器随内容高度增长，`flex-1` 的 `<main>` 也跟着增长，`overflow-auto` 永远不会触发，内容溢出时无法滚动。

**决策：**
`App.vue` 第一行改一个 class：`min-h-screen` → `h-screen`。
外层固定为视口高度，`<main>` 获得真实的高度上限，`overflow-auto` 才能生效。
改动范围：只有 `App.vue` 的一个 class，其余不动。

**任务：**
- [ ] `App.vue`：`class="min-h-screen flex flex-col"` → `class="h-screen flex flex-col"`
- [ ] 构建：`npm run build`
- [ ] 重启：`pm2 restart bili`
- [x] 验证：`curl http://127.0.0.1:3000/` 返回 200

## [2026-05-18 14:31] 工作者
**完成情况：** App.vue `min-h-screen` → `h-screen`，构建重启通过
**任务进度：**
- [x] App.vue 第 2 行：`min-h-screen` → `h-screen`，外层固定为视口高度，`<main>` 的 `overflow-auto` 生效
- [x] `npm run build` 成功（JS gzip 41.80KB, CSS gzip 4.24KB）
- [x] `pm2 restart bili` 成功，`curl http://127.0.0.1:3000/` 返回 200

## [2026-05-18 23:15] 全局者 — 平板/桌面列数隔离

**背景：**
手机已用 localStorage 独立存储，但平板和桌面仍走服务端 `columns_per_row`，两者共享同一个值，互相影响。另外平板纵向滚动问题预计随 h-screen 修复一并解决。

**根因：**
工作者之前只将手机切到 localStorage，平板和桌面保留了 `if (s.columns_per_row)` 读服务端的逻辑，导致两者同步。

**决策：**
三种设备类型全部改为 localStorage 独立存储，不再从服务端读 `columns_per_row` 作为列数来源。
- `columns_mobile`：手机（已有，不动）
- `columns_tablet`：平板，默认值 3
- `columns_desktop`：桌面，默认值 4
服务端 `columns_per_row` 保留字段不删，但不再用它控制网格列数（设置页保存列数只写 localStorage，不写服务端）。

**任务（接在 h-screen 任务之后）：**
- [x] `HomePage.vue`：删除读服务端 `columns_per_row` 的逻辑，平板/桌面改为读 `columns_tablet` / `columns_desktop` localStorage
- [x] `SettingsPage.vue`：平板/桌面的列数滑块保存改为写 localStorage，不写服务端
- [x] 构建 + pm2 restart + curl 验证

## [2026-05-18 14:43] 工作者
**完成情况：** 平板/桌面列数切换到 localStorage，三种设备全部独立存储
**任务进度：**
- [x] `HomePage.vue`：
  - `getLocalColumns()`：默认值改为 `{ mobile: 2, tablet: 3, desktop: 4 }`
  - `loadSettings()`：删除服务端读 `columns_per_row` 的分支，统一调用 `getLocalColumns()`
- [x] `SettingsPage.vue`：
  - `loadSettings()`：删除 `isMobile` 分支，统一读 localStorage
  - `saveColumns()`：删除 `isMobile` 分支和服务端 `api.updateSettings` 调用，只写 localStorage
- [x] `npm run build` 成功（JS gzip 41.76KB, CSS gzip 4.24KB）
- [x] `pm2 restart bili` 成功，`curl http://127.0.0.1:3000/` 返回 200

## [2026-05-18 23:45] 全局者 — 安全审查修复

**背景：**
security-reviewer 审查本轮改动，发现 2 处 MEDIUM + 1 处 LOW，全部修复。

**任务：**

1. **parseInt radix（MEDIUM）**
   - `client/src/views/HomePage.vue` 第 129 行：`parseInt(stored)` → `parseInt(stored, 10)`
   - `client/src/views/SettingsPage.vue` 第 133 行：`parseInt(stored)` → `parseInt(stored, 10)`

2. **NaN 兜底缺失（MEDIUM）**
   - `client/src/views/SettingsPage.vue` 第 133 行，`parseInt` 失败时 `columns.value` 为 NaN
   - 参考 HomePage.vue 的写法加 `|| defaults[deviceType]` 或固定默认值兜底
   - 确保 `stored` 为非数字字符串时列数回退到合理默认值（tablet=3, desktop=4）

3. **服务端死代码清理（LOW）**
   - `server/src/routes/settings.js`：从允许更新的字段列表中移除 `columns_per_row`
   - `GET /api/settings` 响应中也不再返回 `columns_per_row`（如有）
   - 不影响其他设置字段，只删这一个

4. **构建 + 重启 + 验证**
   - `npm run build`（client 目录）
   - `pm2 restart bili`
   - `curl http://127.0.0.1:3000/` 返回 200

- [x] 任务 1：parseInt radix
- [x] 任务 2：NaN 兜底
- [x] 任务 3：服务端 columns_per_row 清理
- [x] 任务 4：构建验证
