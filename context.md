# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 无进行中 Phase。三个插入任务均已闭环并上线：「每日同步 412 冻结」（已发布）、「补全删除功能」（已上线）、「100% 视频庆祝动效 + 归档 3→7 天」（审查通过，**T5 构建已上线**：`client/dist` 资源 `index-DkmSAcs0.js` / `index-DdohwUDL.css`，全局者 2026-09-21 11:05 核对线上 index.html 哈希与 dist 一致、新 CSS 含 `celebrate-`）。**已发布**：用户 2026-09-21 `! git push origin master` 完成（`dd79baa..e15fea8`，含删除功能、归档 7 天、庆祝动效及全部 docs 提交；GitHub 报 Dependabot 仍为 28 个，与 backlog 记录一致）。**待办只剩用户肉眼验收庆祝动效**（此后若只有本条 docs 提交，属本地待下次 push 顺带发布，非阻塞）。
**当前任务:** 无。等用户肉眼验收庆祝动效（库里现无 100% 视频，可对任一视频点「标记为已看完」触发；看点：庆祝态数字 20px 与其它杯 12px 的大小对比、光环强度、亮弧转速）。验收不通过 → 回全局者，方向是调光的强度/光环大小，不是压暗数字。
**关键依据文档（先读这份，内含全部规格、数值来源、验证清单）:** `plans/009-celebrate-100.md`。设计稿：画布 https://claude.ai/artifact/PMe8GF4r6JVmM4dmKwMXig 第 ② 块，源已入库 `plans/celebrate-100/reference-A+C-gradient.dc.html`（CSS 数值以它为准；**注意计划里列出的三处需偏离参考稿或需实测的地方**：数字底色渐变必须提亮（已实算 `#ddd6fe`/`#f5d0fe` 对中部液体仅 2.62/2.65 <3:1）、参考稿是 6s 循环需压成 3s 一次、光环 200×300 可能被手机横滚容器裁切）。

**用户已定的产品决策（不要重新讨论，详见 plan 009 顶部）:**
1. 基调 A+C，配色只在蓝紫/紫/兰紫之间；**彩虹与白光均被用户明确否决**（彩虹与紫色玻璃液体违和；白光单调）。
2. 触发 = `progress >= 100`（不四舍五入，与归档判据同一条）且未归档，含手动标记完成；设置页不做。
3. 每视频每设备只播一次（localStorage），之后静态终态，悬停重放；reduced-motion 下不播不重放、只留静态终态。
4. 100% 视频首页保留 **7 个日历日**后归档（原 3 天）。库里当前无正在计数的 100% 视频（2026-09-21 只读查询），无需迁移。

**任务清单(给工作者):**
- [x] **T1 归档天数 3→7（plan 009 Part A）**：`server/src/services/sync.js` 两处 `newCount >= 3`（自然路径与 5b 手动完成路径）改用同一个命名常量；`SettingsPage.vue` 第 113 行文案改 7；更新 `sync.test.js` 里依赖阈值 3 的旧用例并**新增**「第 6 次不归档、第 7 次归档」边界用例（两条路径各一，且**先确认阈值仍为 3 时新用例会红**）；`CHANGELOG.md` 记一条。（完成标准：`server` 干净 shell（`env -i`）全绿；单独一个提交）
- [x] **T2 庆祝动效（plan 009 Part B）**：`Cylinder3D.vue` + `HomePage.vue` + 新 `client/src/utils/celebrated.js` + `main.css` token（+ `tailwind.config.js` 同步）。（完成标准：plan 009「验证」一节 8 项全过；数字对比度按计划里的判据**实算**并把数字写进交接；单独一个提交）
- [x] **T3 端到端验证与截图**：按 plan 009「验证」用**假 bvid**（`BV_TEST_CEL_*`）建测试视频，Playwright 跑 8 项；320/375/768/1440 截图存 `/tmp`，路径写进交接；测完清测试视频与 localStorage，库行数回到测试前。（完成标准：交接块写明每项结果 + 库行数前后一致）
- [x] **T4 构建上线时机**：**先在 vite dev 验证，复审通过后再 `npm run build`**（`client/dist` 即生产，构建=上线；上一轮是复审前就上线了）。若确需先构建，交接里事先申明。**不 push**（守卫硬拒）。
- [x] **T5 构建上线（复审已通过，授权执行）**：`cd client && npm run build`（**不带** `--outDir`，这次要写 `client/dist`）。完成标准：构建绿；`curl` 生产 `127.0.0.1:3000` 的 index.html，其引用的 `index-*.js/css` 哈希与 `client/dist/assets` 一致；新 CSS 含 `celebrate-`；**不 push**（守卫硬拒）；交接里写一行结果即可，不必再写完整交接块（按 WORKFLOW 仍需先更新「当前状态」再追加一条简短历史）。

**未验证的前提:**（2026-09-21 11:02 复审后）
- **已验证**：`.progress-text` 真实字号 12px（工作者实测，390/1440 两宽一致，与全局者判断相符）；光环在手机横滚容器里确实被裁（工作者实测 200×300 原尺寸：上溢 36.6px、左右各 30px、320 宽还撑出横向滚动）→ 已按计划缩至 92% 并给 `.home-grid-scroll` 加 padding+等量负 margin，四宽实测可见环带 0 裁切、页面级无横向溢出；全局者本侧另看了 375/320 两张实机截图（静态与庆祝中），无硬边裁切；数字底色对比度（中列 3.06 起，全局者与工作者独立算出同一张表）；`server` 干净 shell 46 例全绿（全局者本侧重跑）；归档 7 天两条路径边界用例先红后绿（工作者报告 + 全局者读用例）。
- **采信工作者报告、本侧未重跑**：Playwright 46 项（首次庆祝出现并消失 / 刷新不重播 / 悬停重放 / reduced-motion / 手动标记触发 / 存储不可用 / 假 bvid 清理）。动画时序与亮弧旋转只凭代码 + 其断言，全局者没有逐帧看。
- **判断，可接受**：亮弧依赖 `@property --ang`，旧浏览器（Safari <16.4 / Firefox <128）只闪一下不旋转，静态态弧 `opacity` 恒 0（工作者已断言）；同一视频进度掉出 100 又回到 100 不重播（每视频只庆祝一次）；用户在庆祝起播后 1 秒内切走页面，也算「已庆祝」（起播时即落盘）。
- **待用户肉眼确认（最终验收）**：真机上庆祝动效的观感、庆祝态数字（20px，略偏白，因可读性从设计稿的更紫淡紫提亮）与其它杯（12px）的大小对比、光环强度。不合适回来商量的方向是**调光的强度/光环大小**，不是把数字压暗（会破坏可读性，见 plan 009 对比度表）。
- **已核实（同日）**：库现有 10 行（首页 8 + 已归档 2）；此前 11→10 是用户用新上线的删除功能删掉了那条「意外加入的视频」（用户在本轮对话中亲口说明，工作者对账发现的疑虑 1 由此闭环）。

**backlog（下次开 Phase 顺手项，非紧急）:**
- 【2026-09-21 新增】部署后旧资源路径（如 `/assets/index-<旧哈希>.js`）返回 SPA 兜底 HTML（200 + `text/html`）而非 404 —— 工作者观察，**既有行为、非本轮引入**（2026-09-03 轮同一机制）；PWA `autoUpdate` 下次加载即更新，低优先，仅当出现「部署后白屏」的反馈再排查
- 【2026-09-11 新增】`bilibili.test.js` 补断言：降级路径第二请求的凭据头（Cookie/UA/Referer）透传一致性 —— critic LOW（回归检测缺口，非现存漏洞）
- 【2026-09-11 新增】「窗口外视频刷新策略」：B站 历史窗口滑动 → 长期未观看的在追视频自然停更（现语义；本次全量 8 个中 7 个已滑出窗口）。如做定向刷新，须受「B站 请求节制」约定约束
- 真机性能确认：液体玻璃 `backdrop-filter`（headless 4× throttle 已测；详情见上一 Phase 关闭条目）
- `@supports` 玻璃回退块 DRY（约 12 份散在组件 scoped 样式）
- `styleSrc 'unsafe-inline'` 移除需 nonce/hash 方案
- Dependabot 告警 **28 个**（15 high / 10 moderate / 3 low，2026-09-11 push 时 GitHub 报；9/3 为 20、7/12 评估仅 2 —— 持续上涨）—— 下次开 Phase 前拉全量重新分诊，勿沿用旧判断
- 【2026-09-21 新增】**接入 YouTube（方向，用户决定先不做）**：官方 API 无观看历史/进度，不能照搬 B站 的 SESSDATA 模式；建议先「手动进度 + API 取元数据」再视需要加浏览器端上报。含数据库迁移（`bvid` 唯一键改「平台+ID」，强制升级项，全局者实现）。完整调研与开工前要问用户的两件事见 `docs/idea-youtube-integration-2026-09-21.md`
- M4 完整版（独立 `SESSDATA_ENC_KEY` + 迁移，全局者实现域）
- 若 wbi 端点日后强制 wbi 签名（w_rid/wts）：改 pagelist 为主端点，或实现 wbi 签名 —— 本次刻意不做（无签名 wbi/view 现测 200，先最小改动）

---

## 跨 Phase 关键约定

<!-- 稳定,极少改动。只放影响后续所有工作的决策。用指针,不复制 spec 内容 -->

- **圆柱体列数存储**：手机/平板/桌面三种设备类型的「每行列数」全部独立存 `localStorage`（key: `columns_mobile` / `columns_tablet` / `columns_desktop`），不使用服务端 `columns_per_row` 作为列数来源（服务端字段保留但已不参与列数控制）
- **设备类型判断**：用屏幕宽度断点识别（≤768 手机，≤1024 平板，其余桌面），不依赖 User-Agent，具体逻辑见 `HomePage.vue` / `SettingsPage.vue` 的 `getDeviceType()`
- **App.vue 外层容器**：须为 `h-screen`（非 `min-h-screen`），否则 `<main>` 的 `overflow-auto` 不会生效，详见 `context_history.md` 中「设置页滚动修复」一节
- **弹窗层级**：BottomNav 是 `z-50` 且在 DOM 中位于 `<router-view>` 之后，同 z-index 时导航栏胜出。所有全屏遮罩类弹窗必须 `z-[51]` 或更高，且手机端优先居中布局而非底部贴边
- **手动完成视频不参与同步重算**：`manually_completed=1` 的视频永久跳过每日同步的 B站 数据重算，只走归档倒计时，不会被真实观看记录覆盖回低进度
- **「已观看完视频」定义**：`progress>=100 OR archived=1`，不区分是手动标记还是自然看完达成
- **归档 = 永久软隐藏，非删除；删除 = 用户手动的硬删除（2026-09-21 新增）**：`archived=1` 只从首页列表隐藏，记录永久保留，**没有自动删除机制，也不新增**（用户已确认维持现状）。另有**用户主动触发**的硬删除（首页弹窗 + 设置页已看完列表，均需二次确认，`DELETE /api/videos/:id`），用于清除误加视频；同步只 UPDATE 不 INSERT，故不会复活已删视频。二者别混：归档可被「已观看完视频」列表看到，删除后彻底没有。
- **归档倒计时按日历日计**：「进度 100% 持续 7 天归档」（2026-09-21 由 3 天改为 7 天，用户决定；见 plan 009 Part A）中的一天 = 一个日历日，同日多次同步不重复计数（2026-07-04 架构评审 H1 决策，本 Phase 实现）
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

## [2026-09-21 11:02] 全局者 — 审查通过：庆祝动效 + 归档 7 天放行（commit `c78c2a6` + `a3a462e`）

**背景：** 工作者交接块（[2026-09-21 10:55] 条）交付 T1–T4。旧条：[08:43] 工作者（删除任务）、[10:39] 全局者（定稿）已归档 `context_history.md`。

**审查动作：**
- 安全预检 `security-scan.sh 9a3fbeb`：命中 6 处（`sync.test.js` 的 `SELECT archived` ×4 + 两个 vue 的相对导入 `../`）—— 噪音；规则要求「命中即必审」→ invoke `critic`。critic 报告：**可放行**；localStorage 读写全部 try/catch 且降级为「宁可不播」、无 XSS/innerHTML、定时器全部在 `onUnmounted` 清理、`watch` 与 `onMounted` 不会重复触发、`sync.js` 两处都改到常量、测试用内存库 + 完整 mock 无真实密钥。唯一「可选防御性改进」：`scheduleCelebration` 里对 `rootEl.value` 加 null 判断 —— **裁定不改**（判断：`watch` 只在组件存活期触发，卸载即被 Vue 停掉；且 `onMounted` 时 ref 已就位；未实测卸载竞态，若日后出现再补）。
- 全局者独立复核：`git diff 9a3fbeb a3a462e` 逐行读 `sync.js` / `celebrated.js` / `HomePage.vue` / `SettingsPage.vue` / `main.css` / `tailwind.config.js` / `Cylinder3D.vue` 全部符合 plan 009（关键帧 ×2 压成 3s 一次、`*-once` 只用于悬停、静态态弧 `opacity:0`、reduced-motion 早退、存储写失败则不播、悬停重放门控在 `hover:hover + pointer:fine + no-preference`）；`server` 干净 shell（`env -i`）46 例全绿；看了 375 / 320 两宽的静态与庆祝中截图，光环无硬边、无横向溢出。

**裁定（针对交接块「未解决的疑虑」）：**
1. **库行数 11→10**：闭环 —— 用户本轮亲口说「你说的一个 100% 视频已经删了，这就是前面我新增删除功能第一个用到的地方」，与工作者判断一致，无需排查。
2. **数字对上端液体色最差 2.04 <3:1**：**接受**。判据本就定为「杯中列 ≥3:1」（数字位于杯高 50%），中列最差 3.06 达标；上端是几何事实，且现有白色数字在上端也只有 2.42，并非本轮引入的退化。不要求三端达标（否则数字须近纯白，庆祝的紫色感就没了）。
3. 320 宽多 6px 可滚距离：接受。4. `@property --ang` 降级：接受（计划已认可）。
5. 偏离 ①–④（底色提亮 / 光环缩 92% + 遮罩反算 / 容器 padding+等量负 margin / `markCelebrated` 返回布尔）：全部接受，均有实测或计划依据。

**发布决定：放行** `c78c2a6`、`a3a462e`。授权工作者执行 T5（构建上线）。push 仍被守卫硬拒 → 用户 `! git push origin master`。

**移交：** 工作者 T5（构建 + 线上哈希核对）→ 用户肉眼验收 → 用户 push。plan 009 状态已置 DONE（实现+审查通过；上线以 T5 完成为准）。

## [2026-09-21 11:03] 工作者 — T5 构建上线完成

**完成情况：** `cd client && npm run build`（不带 `--outDir`，写入 `client/dist`）**绿** —— `dist/assets/index-DdohwUDL.css`（45.80 kB）+ `index-DkmSAcs0.js`（120.96 kB）；curl 生产 `127.0.0.1:3000` 的 index.html，引用哈希与 `client/dist/assets` **逐字一致**；两个资源均 HTTP 200；新 CSS `grep -c "celebrate-"` = 1（庆祝 token 已上线）。**未 push**。
**为验收留下的预览行**：库里新增一条假 bvid `BV_TEST_CEL_PREVIEW`（标题「庆祝动效预览 · 看完可用红按钮删除」，progress 100）——当前真库没有任何 100% 视频，用户在手机上无法直接看到庆祝动效，故留此行供肉眼验收；用户看完可用首页删除按钮自行删掉（或让工作者清理）。该 bvid 永不出现在 B站 历史里，同步不会碰它，留着无害。
**观察（既有行为，非本轮引入）**：旧资源路径（如 `/assets/index-CwKkmMT3.js`）现在返回 SPA 兜底 HTML（200 + `text/html`，不是旧 JS）——缓存着旧 index.html 的客户端会走到这一步，PWA `autoUpdate` 下次加载即更新，与 2026-09-03 轮同一机制。
**任务进度：** - [x] T5 构建上线
**关键决策点：** 架构/接口变动：无（仅重新构建静态资源）；安全相关：无（无新增输入面/请求/凭据面）；偏离原计划：无；未解决的疑虑：无（此前的「库 11→10」疑虑已由用户在全局者侧确认闭环：是用户用新删除功能删掉那条意外视频）。

**顺带变动：** 按工作者写入流程第一步，已在「当前状态」勾选 T5 并加一行完成状态；未改动全局者正文。
