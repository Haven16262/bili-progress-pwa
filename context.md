# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 无进行中 Phase。上一 Phase「视觉语言翻新 — 液体玻璃」已关闭（2026-09-03，commit `a1a4a93` + 归档 commit，已 push origin/master）。等待用户开启下一轮。
**当前任务:** 无。
**关键依据文档:** 上一 Phase 完整交互原文已归档 `context_history.md`「Phase：视觉语言翻新 — 液体玻璃（2026-09-03）」段（含 token 规格 + 5 项风险决策 + T1–T10 逐条）。视觉稿 Artifact `https://claude.ai/code/artifact/2da1c9e3-223d-4ba4-98df-8edb22efc2ea`（源 `plans/ui-refresh/canvas-src/`）。

**任务清单(给工作者):** 空。

**backlog（下次开 Phase 顺手项，非紧急）:**
- **真机性能确认**：液体玻璃的 `backdrop-filter` 只在 headless 4× throttle 下测过（43-50fps，A/B 证明掉帧源是既有 wave 动画、玻璃化增量 <3fps）。请用户在自己手机上滚一次首页确认无卡顿——若卡，第一手段是降 `--glass-blur*` 或减少同屏玻璃层。
- **`@supports` 玻璃回退块 DRY**：现在各组件 scoped 样式里复制了约 12 份 `@supports not (backdrop-filter...)` → 不透明 surface 的回退。`main.css` 的 `.glass-panel` / `.glass-control` 工具类没真正统一（组件多为内联样式）。可收敛。
- **`styleSrc 'unsafe-inline'`**（既有弱点，非液体玻璃轮引入，自 2026-04-30 commit e69e3c0）：移除需给 Vue scoped 样式 + 内联 `style=` 绑定上 nonce/hash 方案。
- 清掉 2 个 Dependabot 告警（qs medium / @babel/core low，均传递依赖、暴露面极小）：`server/package.json` 加 `"overrides": { "qs": "^6.15.2" }` 后 `npm install`；`cd client && npm update @babel/core` 升 ≥7.29.6。完成标准 `gh api repos/Haven16262/bili-progress-pwa/dependabot/alerts` 无 open。server 动 node_modules 后按测试封闭性约定跑干净环境测试、重启走 start.sh。
- M4 完整版（独立 `SESSDATA_ENC_KEY` + 迁移，全局者实现域）—— 跨多个 Phase 未启动的旧将来项。

**未验证的前提:** 无进行中任务。

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
- **杯子动感 = wave rotate 光影（用户定版，2026-07-07）**：Cylinder3D 波浪动画用 `rotate` 旋转 blob（4s/6s 双层），用户经 A/B/C 实物对比明确选定——「杯壁光影循环」的观感优先于物理正确的 translateX 晃动。杯内气泡已否决（过小冗余），主页桌面网格**不加** max-width 约束（自然铺满视口）。后续任何 UI 轮不得以「更真实/更物理」为由改回，除非用户主动提出。**「视觉语言翻新」轮（2026-09-03）确认：只换杯壁材质/配色，wave rotate 动画本身不动。**
- **当前视觉语言 = 液体玻璃（2026-09-03 起，用户经 /design 三方案选定，取代旧「深色仪表盘」）**：token 全在 `client/src/assets/styles/main.css` 的 `:root`（`--glass-*` 面板/导航/按钮、`--bg-blob-*` 背景网格、`--liquid-*-bloom` 杯子晕染、`--font-display`=Manrope、`--color-text-on-glass`），`tailwind.config.js` 同步。硬约束（后续轮沿用）：① `backdrop-filter` blur ≤20px、只用在卡片/面板/导航/弹窗/按钮，**杯子只用 radial 晕染不加 backdrop-filter**，每处必须配 `@supports not (backdrop-filter...)` 回退到不透明 `--color-surface`（`#1d1d31`）；② `--color-accent`（纯青）保留用于 `focus-visible` outline / nav-active / slider / 语义反馈——focus 可见性是 a11y 硬要求，不因玻璃美学丢；③ BottomNav 是浮起玻璃胶囊（`fixed` + `left/right:16px` + `bottom:18px`，桌面 `@media(min-width:769px)` 加 `max-width:420px`+`margin-inline:auto`），底部留白由 `App.vue` 的 `main` 统一（`pb-[calc(6.5rem+env(safe-area-inset-bottom))]`），两页面自身不再设 `padding-bottom`；④ 正文文字须过 WCAG AA（判定用声明色静态模型，渲染像素实测有抗锯齿稀释偏差）。Google Fonts 两域已在 `server/src/index.js` helmet CSP 放行（style-src fonts.googleapis.com / font-src fonts.gstatic.com）。
- **B站 图片必须 CORS 加载（2026-07-07 M2 教训）**：Chrome ORB 会拦截跨域 no-cors `<img>`（ERR_BLOCKED_BY_ORB，且报错只在网络层，DOM 只见裂图）。任何加载 B站 封面（`*.hdslb.com`/`*.bilibili.com`）的 `<img>` 都必须带 `crossorigin="anonymous"` + `referrerpolicy="no-referrer"`；CSP imgSrc 已含两域。首次误判为 CSP 问题，排查靠 Playwright 监听网络层
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **测试封闭性（2026-07-07 教训）**：测试必须在干净 shell 里可复现，不得依赖会话环境变量——工作者曾报「29 例全绿」实为其 shell 恰好导出了 JWT_SECRET，干净环境下新用例全被跳过。所需变量一律在 `server/vitest.config.js` 的 `test.env` 注入（现有 `TEST_DB=':memory:'` + 测试专用 JWT_SECRET）；**数据库隔离靠 TEST_DB，`NODE_ENV=test` 不隔离任何东西**。交接报测试结果前先在干净环境跑一遍
- **reduced-motion 策略 = 去位移留反馈（2026-07-12 定版）**：`main.css` 的 RM 块对动画压 `duration+delay` 至 0.01ms（**二者必须同压——只压 duration 时 `animation-delay` 残留会让 stagger 类动画在 RM 下逐个弹出甚至长时间不可见**），过渡用 `transition-property` 白名单（opacity/color/background-color/border-color/box-shadow）保留反馈。后续新动画不必单独写 RM 分支，但用 `opacity:0` 起始 + delay 的入场动画必须确认被该块覆盖
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

## [2026-09-03 15:40] 全局者 — Phase「视觉语言翻新 — 液体玻璃」关闭

**交付汇总：** T1–T10 全部落地。11 前端文件 + `server/src/index.js`（helmet CSP 放行 Google Fonts 两域）+ `index.html`/`vite.config.js`（theme-color / manifest bg → `#10101c`）。commit `a1a4a93`（feat，34 文件 1513+/216−，含 `plans/ui-refresh/` 设计源 + 3 验证脚本 + 10 断点截图；2MB `/design` seed payload `bili-pwa-visual-refresh.html` 因触发全局 pre-commit 机密扫描超时，加进 `.gitignore` 未入库，可由 `.dc.html` 源重生）。本条 docs commit 归档。已 push origin/master。

**审查轨迹：** 安全预检命中（50 处，噪音为主；真安全面只有 CSP 两行）+ 工作者「安全相关」非空 → invoke `critic`。critic：CSP 为「加 Google Fonts」最小必要改动，无其他 directive 放宽、无 `unsafe-eval`/通配符、无内联脚本、无 XSS 向量、`plans/` 无真实凭据；唯一存疑 `styleSrc 'unsafe-inline'` 经全局者 `git log -S"'unsafe-inline'"` 复核确认系 commit e69e3c0（2026-04-30）既有、非本轮引入。功能面全局者独立抽查：T2 wave 五件套零 `+/-`、T5 nav z-50/弹窗 z-51 契约 + safe-area + h-screen 滚动、T7 结构（杯子无 backdrop-filter / blur ≤20px / 无 will-change / `@supports` 回退）、T8 `#10101c` 三处落地、build 绿 —— 全过。T10（桌面导航 `max-width:420px` 居中）单独复核几何 + 手机端像素零差异，通过。

**偏离裁定：** 对比度驱动 4 处 token 微调 / 留白收敛到 `main` / slider 保留原生 accent-color —— 接受。桌面导航全宽 —— 用户看 1440 截图后拍板改限宽居中（落为 T10）。

**新增跨 Phase 约定：** 「当前视觉语言 = 液体玻璃」条（见上「跨 Phase 关键约定」，含 token 位置 + blur 预算 + `@supports` 回退 + accent 青保留 focus 可见性 + 浮起导航契约 + AA 判定方式）。

**backlog（滚动，见「当前状态」）：** 真机性能确认 / `@supports` 回退块 DRY / `styleSrc 'unsafe-inline'` 移除需 nonce / 2 个 Dependabot 告警 / M4 完整版。

**完整逐轮交互（Phase 开启 spec + T1–T9 交接 + 复审 + T10 交接）已归档 `context_history.md`「Phase：视觉语言翻新 — 液体玻璃（2026-09-03）」段。**
