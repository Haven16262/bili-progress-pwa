# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 无进行中 Phase。前序三个插入任务已闭环并上线、已 push（`origin/master` = `e15fea8`）。**「庆祝态数字调整 16px + 静态去柔光」已实现并审查通过放行**（commit `2abf7cf`；审查记录见「本 Phase 历史」[2026-09-21 11:25] 条），**等工作者构建上线（T8）**；`client/dist` 目前仍是 11:03 的旧版（20px + 静态柔光）。本地未 push：`11ee9aa`、`8f230bb`、`2abf7cf` 及其后的 docs 提交。
**当前任务:** 工作者执行 **T8：构建上线**（`cd client && npm run build`，不带 `--outDir`；构建后核对线上 index.html 哈希与 dist 一致、新 CSS 不再含 `celebrate-glow:`）。之后 = 用户看一眼上线后的效果（生产库里有预览视频 `BV_TEST_CEL_PREVIEW2`，标题写明「看完可用红按钮删除」）；看完用红色「删除」清掉它，再 `! git push origin master`。
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
- [x] **T6 数字改 16px + 静态去柔光（`client/src/components/Cylinder3D.vue`，仅 CSS）**：① `.cylinder-wrapper.is-complete .progress-text` 的 `font-size: 20px` → `16px`。② 静态态 `filter` 中把 `var(--celebrate-glow)` 换成 `var(--celebrate-glow-none)`（**不要直接删掉这一项**：CSS `filter` 在关键帧之间插值时，两端的滤镜函数列表必须逐项同构，删了会退化成离散跳变、庆祝结束时数字会「啪」地变一下）。③ 关键帧 `celebrate-sheen` 的 100% 与 `celebrate-sheen-once` 的 0% / 100% 里的 `var(--celebrate-glow)` 同样换成 `var(--celebrate-glow-none)`，使动画的起止态与新的静态态一致；`glow-strong` 峰值保持不变（庆祝/悬停时仍有柔光）。④ **深紫描边 `--celebrate-outline`、黑影、扫光带、光环、亮弧、`scale` 弹一下全部不动。**（完成标准：静态态计算样式里柔光层 alpha 为 0；庆祝结束后数字与静态态视觉无跳变；`--celebrate-glow` 若已无引用，则删掉这个 token 及 tailwind 中无关联的部分——只删本轮弄成孤儿的，别的不碰）
- [x] **T7 验证（Playwright，沿用 `/tmp/bili-verify/bili-verify-celebrate.mjs` 的做法；测试视频只用假 bvid `BV_TEST_CEL_*`，测完清理，库行数前后一致；不得写真实记录）**：(a) 庆祝态数字计算字号 = 16px、字族/字重仍是 Manrope 700；(b) 静态态 `filter` 里无非零柔光；(c) 首次庆祝：出现 `.is-celebrating`、3s 后消失，且**结束瞬间前后取样两帧的 `filter` 计算值一致**（无跳变）；(d) 悬停重放仍生效（`hover:hover` 下）且结束后回到静态；(e) reduced-motion 下仍不播、静态终态正常；(f) 375 与 1440 宽截图各两张：**庆祝态的杯子与一个普通杯（如 74%）并排**，静态一张、庆祝中一张，存 `/tmp`，路径写进交接。（完成标准：全过 + 截图路径）
- [ ] **T8 构建上线（复审已通过，授权执行）**：`cd client && npm run build`（不带 `--outDir`）。完成标准：构建绿；`curl` 生产 `127.0.0.1:3000` 的 index.html，引用的 `index-*.js/css` 哈希与 `client/dist/assets` 一致；新 CSS 里搜不到 `--celebrate-glow:`（只剩 `-strong`/`-none`）；**不 push**；交接一行结果即可（仍需先更新「当前状态」再追加一条简短历史）。

**未验证的前提:**（2026-09-21 11:02 复审后）
- **【本轮 2026-09-21 11:20】已核实**：庆祝态与其它杯的数字**是同一字体**（全局者用真实 Manrope 渲染对照：计算样式两边都是 `Manrope 700`，代码里庆祝态没有改 `font-family`/`font-weight`）；突兀来自 ① 字号 12px→20px（放大后 Manrope 的几何圆润感露出来）与 ② 描边 + 双层柔光让笔画边缘发虚、③ 淡紫渐变不是纯白。对照图（7 种呈现）已发给用户；用户选「16px + 静态去柔光」。
- **【本轮】判断/待告知**：字号降到 16px 后，**「数字属 WCAG 大字、阈值 3:1」这一依据不再成立**（大字 = ≥24px 常规或 ≥18.66px 加粗；16px/700 不是）。按正文 AA 是 4.5:1，而杯中部液体色上 `#f5f3ff` 只有 3.31、`#ede9fe` 3.06；**现有普通杯的 12px 白字也只有 3.63**（同样没到 4.5）——所以这是**项目里数字对比度的既有状态**，不是本轮引入的退化。本轮**不改底色**（保住用户看过并认可的淡紫色泽），只是把「3:1 是大字标准」这个说法收回并如实记录；已入 backlog。若用户想让庆祝态数字更清晰，方向是把底色向纯白靠（白字 3.63），代价是淡紫色泽变淡。
- **已验证**：`.progress-text` 真实字号 12px（工作者实测，390/1440 两宽一致，与全局者判断相符）；光环在手机横滚容器里确实被裁（工作者实测 200×300 原尺寸：上溢 36.6px、左右各 30px、320 宽还撑出横向滚动）→ 已按计划缩至 92% 并给 `.home-grid-scroll` 加 padding+等量负 margin，四宽实测可见环带 0 裁切、页面级无横向溢出；全局者本侧另看了 375/320 两张实机截图（静态与庆祝中），无硬边裁切；数字底色对比度（中列 3.06 起，全局者与工作者独立算出同一张表）；`server` 干净 shell 46 例全绿（全局者本侧重跑）；归档 7 天两条路径边界用例先红后绿（工作者报告 + 全局者读用例）。
- **采信工作者报告、本侧未重跑**：Playwright 46 项（首次庆祝出现并消失 / 刷新不重播 / 悬停重放 / reduced-motion / 手动标记触发 / 存储不可用 / 假 bvid 清理）。动画时序与亮弧旋转只凭代码 + 其断言，全局者没有逐帧看。
- **判断，可接受**：亮弧依赖 `@property --ang`，旧浏览器（Safari <16.4 / Firefox <128）只闪一下不旋转，静态态弧 `opacity` 恒 0（工作者已断言）；同一视频进度掉出 100 又回到 100 不重播（每视频只庆祝一次）；用户在庆祝起播后 1 秒内切走页面，也算「已庆祝」（起播时即落盘）。
- **待用户肉眼确认（最终验收）**：真机上庆祝动效的观感、庆祝态数字（20px，略偏白，因可读性从设计稿的更紫淡紫提亮）与其它杯（12px）的大小对比、光环强度。不合适回来商量的方向是**调光的强度/光环大小**，不是把数字压暗（会破坏可读性，见 plan 009 对比度表）。
- **已核实（同日）**：库现有 10 行（首页 8 + 已归档 2）；此前 11→10 是用户用新上线的删除功能删掉了那条「意外加入的视频」（用户在本轮对话中亲口说明，工作者对账发现的疑虑 1 由此闭环）。

**backlog（下次开 Phase 顺手项，非紧急）:**
- 【2026-09-21 新增】**首页杯内数字的对比度整体低于 WCAG AA 4.5:1**：杯中部液体色 `rgb(172 97 245)` 上，现有 12px 白字 3.63、庆祝态 16px 淡紫 3.06–3.31；上端液体色更低（白字 2.42）。**既有状态，非本轮引入**；靠描边/黑影提升可辨识度，但数值上没到 AA。若要系统性修：加深液体色下界，或给数字加半透明深色衬底——属视觉语言层面的取舍，需用户拍板，不在小任务里顺手改
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

## [2026-09-21 11:24] 工作者 — T6/T7 完成：数字 16px + 静态去柔光（按约定未构建）

**完成情况：**
- **T6（commit `2abf7cf`，仅 CSS）**：`.is-complete .progress-text` 的 `font-size: 20px → 16px`；静态终态 `filter` 的 `var(--celebrate-glow)` → `var(--celebrate-glow-none)`；`celebrate-sheen` 的 100% 与 `celebrate-sheen-once` 的 0%/100% 同步换 `glow-none`（filter 函数列表保持等长，避免离散跳变）；`glow-strong` 峰值、深紫描边、黑影、扫光带、光环、亮弧、`scale` 全部未动。T6⑤ 的孤儿 token 删除已执行：确认 `--celebrate-glow` 改动后零引用，从 `main.css` 删掉；`tailwind.config.js` 里只有三色 `celebrate`（无 glow 相关项），无需改动。
- **T7 验证（Playwright，脚本 `/tmp/bili-verify/bili-verify-celebrate-t6.mjs`，未进仓库）—— 16/16 通过**：
  - (a) 庆祝态数字计算字号 = **16px**；字族 `Manrope, -apple-system, …`、字重 `700` ✓
  - (b) 静态 filter = `drop-shadow(rgba(0,0,0,.5) 0 1px 3px) drop-shadow(rgba(59,7,100,.85) 0 0 1.2px) drop-shadow(rgba(129,140,248,0) 0 0 0) drop-shadow(rgba(232,121,249,0) 0 0 0)` —— 描边与黑影保留、两处柔光 alpha 归零、无 5px/11px 光晕 ✓
  - (c) 首次庆祝出现 `.is-celebrating`、**3070ms** 后消失；**结束瞬间前后两帧 `filter` 计算值逐字一致**（rAF 逐帧采样，前帧 = 后帧）→ 无跳变 ✓
  - (d) 悬停重放仍生效（`celebrate-sheen-once` 在跑、柔光 11px 回来）；移开鼠标后动画 `none`、filter 与静态逐字一致 ✓
  - (e) reduced-motion：不庆祝，静态终态正常（16px + 无柔光）✓
  - (f) **截图路径**：`/tmp/bili-verify-shots/10-static-16px-375.png`、`10-celebrating-16px-375.png`、`10-static-16px-1440.png`、`10-celebrating-16px-1440.png` —— 100% 杯与 74% 对照杯**同一行并排**（375 与 1440 实测 `aY === cY`），静态一张、庆祝中一张
  - 测试数据只用假 bvid（`BV_TEST_CEL_0921A` 100% / `BV_TEST_CEL_0921C` 74%），**未写真实记录**；测完清理，库行数回到测试前（首页 8 → 8）、无残留 ✓
- **T8 未执行（按约定）**：没有构建，`client/dist` 仍是 11:03 那版 → **生产当前是 20px + 静态柔光的旧版**。等复审通过授权后再 `cd client && npm run build`。
- **预览行换新**：上一轮给用户验收的 `BV_TEST_CEL_PREVIEW` 已删（改版后它在用户设备上已记「已庆祝」不会重播；且它占着一条 100% 位置，375 截图无法与 74% 杯并排），新建 `BV_TEST_CEL_PREVIEW2`（进度 100，标题「庆祝动效预览 v2 · 看完可用红按钮删除」）——新 id 在用户设备上是全新记录，**能看到完整的改版后庆祝**；「当前状态」的预览行说明已同步更新。

**任务进度：**
- [x] T6 数字改 16px + 静态去柔光
- [x] T7 验证（16/16）
- [ ] T8 构建（按约定不构建，等复审授权）

**关键决策点：**
- 架构/接口变动：无（纯 CSS 改动 + 删一个孤儿 token）。
- 安全相关：无（输入面/外部请求/存储面均未变；`localStorage` 逻辑未动）。
- 偏离原计划：无（T6 四项逐条照做；删 token 是 T6⑤ 明确授权的「只删本轮弄成孤儿的」）。
- 未解决的疑虑：「结束无跳变」的验证方式说明 —— 用 rAF 逐帧采样 `filter` 计算值并比较 `.is-celebrating` 消失前后两帧，实测两帧字符串完全相同；若全局者要更强的证据（如逐帧差值曲线）可再取，我判断当前已足够。

**顺带变动：** 按工作者写入流程第一步，已在「当前状态」勾选 T6/T7、更新预览行说明并加一行完成状态；未改动全局者正文。

## [2026-09-21 11:25] 全局者 — 审查通过：庆祝态数字 16px + 静态去柔光放行（commit `2abf7cf`）

**背景：** 工作者交接块（[2026-09-21 11:24] 条）交付 T6/T7；T8 按约定未构建。旧条：[11:03] 工作者（T5）、[11:20] 全局者（本任务决策）已归档 `context_history.md`。

**审查动作：**
- 安全预检 `security-scan.sh 8f230bb`：**未命中**；工作者「安全相关」填「无」，且改动只有两个 CSS 文件里的 8 行，无输入面/请求/存储变化 → 按规则不必 invoke `critic`。
- 全局者独立复核：`git diff 8f230bb 2abf7cf` 读全 —— 逐条对上 T6：`font-size` 20→16px；静态态与 `celebrate-sheen` 100%、`celebrate-sheen-once` 0%/100% 的 `--celebrate-glow` 全部换 `--celebrate-glow-none`（`filter` 函数列表保持等长，插值不退化为离散跳变）；`glow-strong` 峰值、描边、黑影、扫光带、光环、亮弧、`scale` 未动；孤儿 token `--celebrate-glow` 已从 `main.css` 删除（零引用，符合 T6⑤「只删本轮弄成孤儿的」）。看了 375 宽静态与庆祝中两张并排截图：100% 杯与 74% 对照杯同一行，数字与旁边的 74% 视觉同属一类，光环与亮弧保留，静态笔画清晰。
- 生产库只读核对：11 行 = 10 条真实 + 1 条预览视频 `BV_TEST_CEL_PREVIEW2`（id 45，进度 100，未归档）；除它之外无 `BV_TEST%` 残留。

**裁定（针对交接块）：**
1. **预览视频留在生产库**：工作者为让用户验收，在生产库里放了假 bvid 的预览视频（先 `BV_TEST_CEL_PREVIEW`，本轮换成 `PREVIEW2`，因旧 id 在用户设备上已记「已庆祝」不会重播）。**接受，但这偏离了「测完清理」的字面要求**：属有意为之、标题里写明可删、只用假 bvid、不碰真实记录，风险低。**已知后果**：它进度 100 但不是「手动完成」，且假 bvid 不会出现在 B站 历史里，所以**不会被自动归档，会一直留在首页，直到用户点红色「删除」清掉**——已写进「当前任务」。今后此类预览请在交接里**事先申明**，别到复审时才发现。
2. **「结束无跳变」的验证方式**（rAF 逐帧采样 `filter` 计算值，结束前后两帧逐字一致）：足够，接受，不要求更强证据。
3. **对比度**：底色未改，「大字/3:1」说法已在 11:20 条与 backlog 收回，本条不再重复。

**发布决定：放行** `2abf7cf`。授权工作者执行 T8（构建上线）。push 仍由用户 `! git push origin master`（本地未 push：`11ee9aa`、`8f230bb`、`2abf7cf` 及其后 docs 提交）。

**移交：** 工作者 T8 → 用户看效果、删预览视频 → 用户 push。
