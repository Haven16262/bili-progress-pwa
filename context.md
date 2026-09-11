# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 插入任务（无进行中 Phase）：「每日同步 412 冻结」修复 —— 方案已定稿（2026-09-11：blog 侧会话预诊断 + bili 侧全局者独立复测证认）。上一 Phase「视觉语言翻新 — 液体玻璃」已关闭（2026-09-03，commit `a1a4a93`，已 push origin/master）。
**当前任务:** 工作者按下方任务清单 1–3 执行（修复 → 测试 → 部署实测），完成后按惯例写交接块。
**根因（已实证）:** B站 `/x/web-interface/view` 对本服务 UA（Chrome/125 型）返回 HTTP 412（WAF 拦截）；`runSync` 步骤 5 逐视频取分P信息无容错，单个 412 抛穿整轮同步 → 自 2026-09-06 起每日同步全部冻结。SESSDATA 本身有效（nav isLogin=true），无需用户重填。
**关键依据文档:** 诊断全文（证据时间线 + 复现命令 + 探针矩阵）见「本 Phase 历史」[2026-09-11 04:28] 条目 —— 保留作证据，勿清理。上一 Phase 归档：`context_history.md`「Phase：视觉语言翻新 — 液体玻璃（2026-09-03）」段。视觉稿 Artifact `https://claude.ai/code/artifact/2da1c9e3-223d-4ba4-98df-8edb22efc2ea`（源 `plans/ui-refresh/canvas-src/`）。

**任务清单(给工作者):**

- [ ] **任务 1：`fetchVideoPages` 端点降级链**（`server/src/services/bilibili.js`；`fetchVideoDetail` 只被它调用，可随之改写/移除）
  - 主端点 `/x/web-interface/wbi/view`（形状与 /view 相同：`data.pages[{cid,duration}]`）；主端点**抛出异常**时改走备端点 `/x/player/pagelist`（`data` 是数组，适配为 `{cid,duration}`）。两端都失败 → 抛出**含两个端点各自错误信息**的汇总错误（形如 `分P信息接口均失败 — wbi/view: …; pagelist: …`）
  - 降级只由**异常**触发；形状语义逐字保持现状：成功但 `pages.length <= 1`（含 1）→ 返回 null（负缓存）；legacy `/x/web-interface/view` 不再使用（本侧复测仍 412）
  - 完成标准（新测试文件 `server/tests/bilibili.test.js`，stub 全局 `fetch`，不改 `sync.test.js` 的模块级 mock）：① wbi 成功 → 返回 `{pages, totalDuration}` 正确；② wbi 抛错 → pagelist 成功 → 形状适配正确（且断言请求顺序 wbi→pagelist）；③ 两端皆失败 → 抛出且 message 含两端点名；④ `pages.length=1` → null
- [ ] **任务 2：`runSync` 步骤 5 逐视频容错**（`server/src/services/sync.js`，现 `getPagesInfo` 调用在 sync.js:159）
  - 该调用外套 per-video try/catch：失败 → `console.warn`（bvid + err.message）→ 跳过计数 +1 → `continue`（**不写库、不推进归档计数、不落负缓存**；负缓存只在成功路径写入，现逻辑已满足）
  - 成功消息：跳过数 > 0 时在消息**末尾**追加「，跳过 N 个视频（分P信息获取失败）」；返回体加 `skipped` 字段
  - 完成标准（扩展 `server/tests/sync.test.js`，沿用其模块 mock + 内存库模式）：① 对某视频 `fetchVideoPages` reject → 该视频行进度/计数未被改动、其余视频照常更新、返回 `skipped=1`、`sync_log` 消息含「跳过 1 个」；② 无失败时消息与旧格式逐字一致（无跳过后缀）
- [ ] **任务 3：测试 + 提交 + 部署实测**
  - 干净 shell：`cd server && npm test`（确认新用例真的执行、全绿）
  - `git commit -- <路径>` 提交代码（新文件先 `git add <文件>` 再带路径 commit；**不要 push**，全局者复审后发布；`context.md` 不必由你提交）
  - 重启请用户敲 `! pm2 restart bili`（Worker 守卫拦 pm2；重启走 `scripts/start.sh`，含 ABI 自愈）；随后 curl 手动触发同步：`POST /api/auth/login`（body `{"password": …}`，密码在 `server/.env` 的 `APP_PASSWORD`，**勿打印**）取 JWT → `POST /api/sync`（Bearer；服务 `127.0.0.1:3000`）
  - 完成标准：① 手动同步 success、`skipped=0`、更新数 = 本地在追视频数（诊断观测为 8，以 DB 实况为准）；② `sync_log` 新行消息格式正确；③ 抽查一个此前冻结视频：progress / last_synced_at 确实更新；④ 无异常归档（archived 未因本次骤增）

**未验证的前提:**
- 9/12 03:07 cron 首次自动跑的结果（手动同步通过 ≠ cron 闭环；两者共用 runSync，风险低，但需下一轮确认）
- 412 的确切触发规则 —— 「Chrome 型 UA 触发、仅此端点」已两次独立实证；是否与 IP 信誉累积相关，未验证（不阻塞修复）
- ~~wbi/view 带真实凭据稳定性~~ —— **已消除**：2026-09-11 bili 侧全局者以生产 SESSDATA 复测（nav isLogin=true、wbi/view 200 / 86 页、单P视频 pages=1；凭据只读解密自 DB，未打印）

**backlog（下次开 Phase 顺手项，非紧急）:**
- 真机性能确认：液体玻璃 `backdrop-filter`（headless 4× throttle 已测；详情见上一 Phase 关闭条目）
- `@supports` 玻璃回退块 DRY（约 12 份散在组件 scoped 样式）
- `styleSrc 'unsafe-inline'` 移除需 nonce/hash 方案
- Dependabot 告警 20 个（11 high / 6 moderate / 3 low）—— 下次开 Phase 前拉全量重新分诊
- M4 完整版（独立 `SESSDATA_ENC_KEY` + 迁移，全局者实现域）
- 【2026-09-11 新增】若 wbi 端点日后强制 wbi 签名（w_rid/wts）：改 pagelist 为主端点，或实现 wbi 签名 —— 本次刻意不做（无签名 wbi/view 现测 200，先最小改动）

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

## [2026-09-11 04:28] 全局者（blog 侧会话预诊断，经用户转交）— 插入任务：每日同步 412 冻结

**背景：** 用户报「bili 项目 SESSDATA 填了但无法同步」。本条由误起于 blog 目录的会话完成初步诊断后转交 —— **bili 侧全局者请复核后再定稿任务清单。**

**已实证（本机实测/查证）：**
- 服务：PM2 `bili`（`server/scripts/start.sh`）在线，uptime 7D；日志 `~/.pm2/logs/bili-{out,error}.log`。
- DB `sync_log` 时间线：8/20–8/31 每日成功（更新 4）；9/1–9/3 03:07「Cookie 验证失败 — SESSDATA 已过期」×3；**9/3 10:00 用户更新 Cookie 后恢复**（9/3 10:00、9/4、9/5 成功）；**9/6–9/11 每日「定时同步异常，请查看服务器日志」**；`last_sync_status` 停在 9/11 03:07。
- error log 栈（9/6 起每日；手动同步 `routes/sync.js` 同样失败）：`B站 API 请求失败: HTTP 412` @ `biliGet(bilibili.js:25)` ← `fetchVideoPages(bilibili.js:188)` ← `getPagesInfo(sync.js:75)` ← `runSync(sync.js:159)`。失败点在**逐视频分P信息** `/x/web-interface/view`，位于 nav 验证与历史拉取**之后** → SESSDATA 有效，非 Cookie 问题。
- 无凭据探针（2026-09-11，本 VPS，curl；UA 取 `bilibili.js:2` 常量，Referer=`https://www.bilibili.com/`）：
  - `/x/web-interface/view`：裸 curl（默认 UA）→ 200；仅 Referer（curl UA）→ 200；**仅 Chrome/125 型 UA → 412**；UA+Referer → 412（复现两次）→ **触发条件是 UA**。
  - UA+Referer+`buvid3`（`/x/frontend/finger/spi` 现取）→ 412（**buvid3 无效**）。
  - **`/x/web-interface/wbi/view` + UA + Referer → 200**，`code=0`、`data.pages` 160 项（与 /view 同形状）。
  - **`/x/player/pagelist?bvid=` + UA + Referer → 200**，含 cid/duration。
  - 对照：`/x/web-interface/nav`、`/x/web-interface/history/cursor` 探针均 200（无登录态 code -101，预期）。
- 【推断】9/4、9/5 成功是因分P缓存（7 天 TTL）未过期、无 /view 请求；9/6 起首个缓存过期条目触发 /view → 412 → 整轮抛异常 → 每日复现。`page_cache` 最后写入 2026-09-03 11:45。

**给 bili 侧全局者的建议方向（未定稿）：**
1. **修复（最小改动）**：`fetchVideoDetail` 端点换 **`/x/web-interface/wbi/view`**（实证 200 同形状）；备选 `/x/player/pagelist`。可考虑失败降级链（wbi/view → /view → pagelist）。
2. **容错（结构性问题，与根因独立）**：`runSync` 第 5 步逐视频 `getPagesInfo` 加 per-video try/catch —— 失败跳过该视频本次更新（保留库中原值）记警告、继续其余；参照 `getAddCandidates` 既有降级写法。理由：本次一个 412 冻结全站 6 天。
3. **验证**：改后本地手动 `POST /api/sync`（或 node 直调 runSync）确认 8 个视频恢复更新、归档逻辑无回归；测试走既有约定（干净环境 + TEST_DB）；重启走 `scripts/start.sh`；留意 9/12 03:07 cron 首次自动跑结果。
4. 如需复测：上列 curl 探针可原样重跑（带真实 SESSDATA 的 wbi/view 稳定性属未验证项，见「当前状态」）。

**移交：** bili 侧全局者复核本诊断 → 定稿方案与任务清单 → 派工作者。

## [2026-09-11 04:40] 全局者 — 412 冻结：复核证认与方案定稿

**背景：** blog 侧会话预诊断（「本 Phase 历史」[2026-09-11 04:28] 条目）转交本侧复核定稿。

**复核动作（本侧独立，2026-09-11 04:32）：** DB `sync_log` 9/6–9/11 六行 failed，错误栈与代码逐行对码（bilibili.js:188 ← sync.js:75 ← sync.js:159）；PM2 `bili` online（uptime 7D）。curl 复测（UA 取 `bilibili.js:2` 常量）：无凭据 —— `/view` → 412、`wbi/view` → 200/86 页、`pagelist` → 200/86 项；**带生产 SESSDATA**（只读解密自 DB，未打印）—— nav isLogin=true、wbi/view → 200/86 页、单P视频 pages=1。诊断全部成立（含「分P缓存 7 天 TTL 解释 9/4–9/5 成功」的推断）。

**决策：**
1. 端点换 **`wbi/view`（主）→ `pagelist`（备）** 两端点降级链；不收 legacy `/view` 进链（现测必 412，白费请求）。降级由异常触发，单P/null 语义逐字保留。
2. 容错采纳 per-video try/catch，但语义为**跳过式（保留库中原值）**，不用 `getAddCandidates` 式的单集进度降级 —— 后者对多P视频可能高估（单集 100% ≠ 全局 100%）并误触发归档倒计时；跳过是保守且不写错数据。跳过数上浮到同步消息 + 返回体（本次事故本质是「静默冻结 6 天」，可观测性是修复的一部分）。
3. 不实现 wbi 签名（KISS：无签名现测 200；已入 backlog 备忘）。
4. 升级判定：非强制升级项（不涉认证/密钥/并发/不可逆），交工作者；真实凭据下的生产实测放任务 3。

**移交工作者：** 任务清单 1–3 已写入「当前状态」；完成后写交接块。
