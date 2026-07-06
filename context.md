# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** Phase — UI 视觉美化（第二轮：杯子活化）
**当前任务:** 第一轮全站 polish 已审查通过并 commit（`6ee438d`）。第二轮聚焦 Cylinder3D 单组件「活化」：液面波动 + 杯内气泡 + 玻璃质感微升级。范围极窄，防过度修改
**关键依据文档:** 参考收藏见项目记忆 `ref-ui-inspiration.md`（液体玻璃/喝水App/波浪实现链接）；第一轮改版后截图 `docs/screenshots/{home,settings}-{320,768,1024,1440}.png`

**设计方向（全局者定调，2026-07-06 用户授权全局者组合选择）：**
- **只借细节，不换语言**：从 Liquid Glass 潮流只借「杯子本体」的玻璃质感；从喝水类 App 借「液面波动 + 杯内气泡」微细节；卡通/吉祥物风格、整体玻璃化一概不采用
- **效果标准是 subtle**：静止时一眼看仍是原来的杯子，动起来才注意到差别。宁可不够炫，不可过度
- **实现红线**：动画只允许 transform/opacity；禁用 `backdrop-filter`、`feDisplacementMap`、gooey blur+contrast 滤镜（手机端开销大）；不新增任何依赖

**任务清单(给工作者):**

- [ ] 1. 分级色收进 token：`Cylinder3D.vue` 里 `liquidColor` 四级八个硬编码 hex 挪到 `main.css` token（完成标准：组件内无硬编码色值；四级分级逻辑与视觉不变）
- [ ] 2. 液面波动：液面顶部双层波浪（前后两层、速度/透明度错开），SVG path 或 CSS 实现均可，但循环动画必须 transform-only（完成标准：DevTools Performance 无持续 layout/paint;`prefers-reduced-motion` 下波浪静止为平面）
- [ ] 3. 杯内气泡：2-4 颗小气泡自液底缓升，opacity/transform 动画，随机错峰（完成标准：进度为 0 时不渲染气泡；reduced-motion 下不渲染；肉眼观感 subtle 不抢戏）
- [ ] 4. 玻璃质感微升级：杯口 rim 高光 + 液面顶部 meniscus 亮线，纯 CSS 渐变实现（完成标准：不使用任何 filter/backdrop-filter；静态截图对比第一轮有可感知但不突兀的质感提升）
- [ ] 5. 自查交付：reduced-motion 开关两种状态验证 + 构建体积对比（完成标准：JS+CSS gzip 增幅 < 5KB）+ 杯子特写截图（一张常态、一张 hover）存 `docs/screenshots/`

**Scope 边界（本轮红线）：**
- **只允许改两个文件**：`Cylinder3D.vue` + `main.css`（token 段）。其他任何组件/页面/配置一律不碰
- 不改 Cylinder3D 的 props/emit 接口、分级色阈值(30/60/90)、液面高度计算
- 不新增依赖；不用 SVG/CSS 滤镜
- 遵守「跨 Phase 关键约定」全部条目

**待办（非工作者任务，上轮遗留）：**
- [ ] 任务 6b 生产回归验证（PM2 重启 + 手动同步一轮 + 确认无风控告警/无数据回退）— 用户操作
- [ ] 用户真机确认 M2：手机打开「添加视频」弹窗，看 B站 封面图是否正常显示（决定 M2 是否进功能轮）

**Backlog（功能轮候选，本轮不做，详见 `docs/architecture-review-2026-07-04.md`）：**
- H3 设置页 SESSDATA「已设置」徽章永远显示未设置（服务端加 `sessdata_set` 布尔）
- M2 CSP `imgSrc` 缺 `https://*.hdslb.com`，疑似封面图被阻断（待用户真机确认）
- M3 api.js 统一错误/401 处理 + App.vue 裸 fetch 收编
- L1 `videos.js` 三处 `:id` 校验改 `Number.isInteger(id) && id > 0`（critic MEDIUM）
- L3 AddVideoModal `addOne` 与 HomePage `markCompleted` 的错误判断语义混乱
- M4/L4/L5/L6 顺手项：密钥耦合注释、updateVideo 白名单收紧、settings PUT 存根删除、columns_per_row 停止 seed

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
- **归档倒计时按日历日计**：「进度 100% 持续 3 天归档」中的一天 = 一个日历日，同日多次同步不重复计数（2026-07-04 架构评审 H1 决策，本 Phase 实现）
- **B站 请求节制**：历史翻页必须有提前终止 + 页数上限 + 页间延时，防触发风控（2026-07-04 架构评审 H2 决策）
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

> 本 Phase 第一轮（全站 polish）的工作者交付与全局者审查放行记录已归档至 `context_history.md`「Phase：UI 视觉美化」段。

## [2026-07-07 00:20] 全局者 — 第二轮「杯子活化」开启（组合选择）

**背景：** 用户浏览参考后授权全局者组合选择。参考搜集结论（液体玻璃只借局部、喝水 App 借微细节、波浪用轻量实现）已存项目记忆 `ref-ui-inspiration.md`。

**决策：**
1. 组合 = 液面波动（双层错速波浪）+ 杯内气泡（2-4 颗缓升）+ 玻璃质感微升级（rim 高光 + meniscus 亮线）+ 顺手把四级分级色收进 token
2. 不采用：整体 Liquid Glass 化、卡通风格、filter 系特效、分级色重设计（现有 30/60/90 阈值四级已工作良好）
3. 范围锁死两个文件：`Cylinder3D.vue` + `main.css`。这是防过度修改的硬约束，工作者不得以「顺手统一」为由扩散
4. 效果验收标准：subtle——静止时一眼看仍是原来的杯子;构建体积增幅 < 5KB gz

**移交工作者：** 按任务清单 1→5 执行。波浪实现优先参考记忆里的纯 CSS/SVG 方案（transform-only）;做完自查交付回全局者审查。

