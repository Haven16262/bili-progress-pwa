# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** Phase「动画品味改进轮」已关闭（2026-07-12，commit 见本 Phase 历史关闭总结）。当前无进行中 Phase，等待用户开启下一轮
**当前任务:** 无。将来项：M4 完整版（独立 SESSDATA_ENC_KEY + 迁移，全局者实现域）
**关键依据文档:** 本轮产出归档于 `plans/`（8 份自包含计划，状态全 DONE）+ `context_history.md`「Phase：动画品味改进轮」段
**任务清单(给工作者):** 空
**下次开 Phase 顺手项（2026-07-12 全局者查证，非紧急）:** 清掉 2 个 Dependabot 告警，均为传递依赖、实际暴露面极小：
- qs（medium，GHSA-q8mj-m7cp-5q26）：express/body-parser 精确锁版带入 6.14.2/6.15.1，`npm update` 带不动——在 `server/package.json` 加 `"overrides": { "qs": "^6.15.2" }` 后 `npm install`。漏洞点在 `qs.stringify` 特定选项组合，服务端无此调用路径，仅为归零告警
- @babel/core（low，GHSA-4x5r-pxfx-6jf8）：`cd client && npm update @babel/core` 升到 ≥7.29.6（workbox-build 是 ^7 范围，可直升）。纯构建期工具链，产物不含 babel
- 完成标准：`gh api repos/Haven16262/bili-progress-pwa/dependabot/alerts` 无 open 告警。**注意：server 动了 node_modules，按跨 Phase 测试封闭性约定跑干净环境测试，重启走 start.sh（ABI 自愈）**

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
- **杯子动感 = wave rotate 光影（用户定版，2026-07-07）**：Cylinder3D 波浪动画用 `rotate` 旋转 blob（4s/6s 双层），用户经 A/B/C 实物对比明确选定——「杯壁光影循环」的观感优先于物理正确的 translateX 晃动。杯内气泡已否决（过小冗余），主页桌面网格**不加** max-width 约束（自然铺满视口）。后续任何 UI 轮不得以「更真实/更物理」为由改回，除非用户主动提出
- **B站 图片必须 CORS 加载（2026-07-07 M2 教训）**：Chrome ORB 会拦截跨域 no-cors `<img>`（ERR_BLOCKED_BY_ORB，且报错只在网络层，DOM 只见裂图）。任何加载 B站 封面（`*.hdslb.com`/`*.bilibili.com`）的 `<img>` 都必须带 `crossorigin="anonymous"` + `referrerpolicy="no-referrer"`；CSP imgSrc 已含两域。首次误判为 CSP 问题，排查靠 Playwright 监听网络层
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **测试封闭性（2026-07-07 教训）**：测试必须在干净 shell 里可复现，不得依赖会话环境变量——工作者曾报「29 例全绿」实为其 shell 恰好导出了 JWT_SECRET，干净环境下新用例全被跳过。所需变量一律在 `server/vitest.config.js` 的 `test.env` 注入（现有 `TEST_DB=':memory:'` + 测试专用 JWT_SECRET）；**数据库隔离靠 TEST_DB，`NODE_ENV=test` 不隔离任何东西**。交接报测试结果前先在干净环境跑一遍
- **reduced-motion 策略 = 去位移留反馈（2026-07-12 定版）**：`main.css` 的 RM 块对动画压 `duration+delay` 至 0.01ms（**二者必须同压——只压 duration 时 `animation-delay` 残留会让 stagger 类动画在 RM 下逐个弹出甚至长时间不可见**），过渡用 `transition-property` 白名单（opacity/color/background-color/border-color/box-shadow）保留反馈。后续新动画不必单独写 RM 分支，但用 `opacity:0` 起始 + delay 的入场动画必须确认被该块覆盖
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

## [2026-07-12 16:15] 工作者 — R1 修复 + R2 运行时验证全绿

**完成情况：**
- **R1**：main.css reduced-motion 块追加 `animation-delay: 0.01ms !important`，构建通过。
- **R2**：用 Playwright（Chromium headless）对 001–007 逐一跑运行时验证，19 项全部通过：

| 计划 | 验证项 | 结果 |
|------|--------|------|
| 001 | hover 规则全部在 @media(hover:hover) 内，无裸 :hover transform | ✅ |
| 002 | 模态 scale-in 入场 / close 后 v-if 移除 / rapid toggle 重开成功 | ✅ |
| 003 | RM 块存在 / transition-property 白名单生效（非 duration 全灭） | ✅ |
| R1 | RM 块 animation-delay: 0.01ms 已生效 | ✅ |
| 004 | liquid-fill 使用 translateY transform（matrix 含 translate），transition 属性为 transform 非 height | ✅ |
| 005 | nav-icon 有 transform transition；add-modal-item transition 含 transform | ✅ |
| 006 | 首载后 liquid-fill transform 非 identity（注水已执行）；progress text 94%（count-up 完成） | ✅ |
| 007 | stagger delays 正确递进（0s→0.04s→0.08s…）/ RM 下 8 个圆柱 opacity 全为 1 立即可见（R1 修复确认生效）/ 动画中可点击 | ✅ |

**关键发现：**
- R1 修复前 RM stagger delays 为 `calc(var(--stagger)*40ms)`（最长 400ms），修复后压为 `1e-05s`（0.01ms），圆柱全部立即可见。
- 第一次 RM 测试中 opacity 误报为 0 系测试脚本未等待数据加载完毕，修正后通过。
- `@click.self` 在 `.modal-overlay` 上，Playwright 需通过"取消"按钮或 overlay 边距区域触发关闭。

**任务进度：**
- [x] R1 reduced-motion 块补 animation-delay
- [x] R2 运行时验证（19/19 全绿）
- [x] 001–008 全部实现 + 修复 + 验证完成

**关键决策点：**
- 架构/接口变动：无
- 安全相关：无
- 偏离原计划：无
- 未解决的疑虑：无

## [2026-07-12 16:30] 全局者 — Phase「动画品味改进轮」关闭

**交付汇总：** 8 份计划（001–008）全部落地 + 复审打回的 R1 修复 + Playwright 运行时验证 19/19 全绿。改动纯前端 6 文件：hover 触屏门控（001）、RM 去位移留反馈（003+R1）、双模态退场（002）、液面 height→transform（004）、按压反馈（005）、首载注水+count-up（006）、网格入场 stagger（007）、删 --ease-spring（008）。
**审查轨迹：** 安全预检两轮零命中，未触发 critic。全局者抽查三处风险面（007 隐形风险/004 溢出裁剪/006 rAF 泄漏）均安全；打回 1 缺陷（RM 块漏压 animation-delay）+ 1 纪律项（8 条交接零运行时验证报告），二者均闭环。001 偏离（独立 media 块）接受。
**新增跨 Phase 约定：** reduced-motion 策略定版（duration+delay 必须同压 + transition-property 白名单）。
**backlog：** 空。唯一将来项 M4 完整版（独立 ENC_KEY，全局者实现域）。前段历史已归档 `context_history.md`。
