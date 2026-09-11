# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 无进行中 Phase。插入任务「每日同步 412 冻结」：**已修复 + 审查通过放行**（2026-09-11；实现 commit `155f420`；审查记录见「本 Phase 历史」[2026-09-11 04:46] 条）。**已发布**（2026-09-11）：用户 `! git push origin master` 完成，origin/master = `dd79baa`（含修复 `155f420` + 两条 docs）。上一 Phase「视觉语言翻新 — 液体玻璃」已关闭（2026-09-03，commit `a1a4a93`，已 push origin/master）。
**当前任务:** 无。唯一待观察项：**9/12 03:07 cron 首次自动同步** —— 下一轮 session 先查 `sync_log`（预期 success；见「未验证的前提」）。
**根因（已实证）:** B站 `/x/web-interface/view` 对本服务 UA（Chrome/125 型）返回 HTTP 412（WAF）；`runSync` 步骤 5 逐视频取分P信息无容错，单个 412 抛穿整轮 → 9/6–9/11 每日冻结。修复 = 端点降级链（`wbi/view` 主 → `pagelist` 备）+ 逐视频跳过容错。SESSDATA 有效，无需重填。
**关键依据文档:** 诊断全文与定稿决策已归档 `context_history.md`「插入任务：每日同步 412 冻结（2026-09-11）」段（含证据时间线、复现命令、探针矩阵）；审查记录（含 critic 报告摘要与三项裁定）见「本 Phase 历史」[2026-09-11 04:46] 条。上一 Phase 归档：`context_history.md`「Phase：视觉语言翻新 — 液体玻璃（2026-09-03）」段。视觉稿 Artifact `https://claude.ai/code/artifact/2da1c9e3-223d-4ba4-98df-8edb22efc2ea`（源 `plans/ui-refresh/canvas-src/`）。

**任务清单(给工作者):** 空（三项已全部核销，审查通过）。

**未验证的前提:**
- **9/12 03:07 cron 首次自动跑的结果**（手动同步 #153 通过 ≠ cron 闭环；两者共用 runSync，风险低，但需下一轮确认）
- 412 的确切触发规则 —— 「Chrome 型 UA 触发、仅此端点」已两次独立实证；是否与 IP 信誉累积相关，未验证（不阻塞）
- pagelist 备端点对超大分P（>100）视频的完整性未逐例验证（已测 16/86/92 三例与主端点逐项一致；若截断，截断外视频走既有单集回退，且仅在 wbi 失败时才会走到）

**backlog（下次开 Phase 顺手项，非紧急）:**
- 【2026-09-11 新增】`bilibili.test.js` 补断言：降级路径第二请求的凭据头（Cookie/UA/Referer）透传一致性 —— critic LOW（回归检测缺口，非现存漏洞）
- 【2026-09-11 新增】「窗口外视频刷新策略」：B站 历史窗口滑动 → 长期未观看的在追视频自然停更（现语义；本次全量 8 个中 7 个已滑出窗口）。如做定向刷新，须受「B站 请求节制」约定约束
- 真机性能确认：液体玻璃 `backdrop-filter`（headless 4× throttle 已测；详情见上一 Phase 关闭条目）
- `@supports` 玻璃回退块 DRY（约 12 份散在组件 scoped 样式）
- `styleSrc 'unsafe-inline'` 移除需 nonce/hash 方案
- Dependabot 告警 **28 个**（15 high / 10 moderate / 3 low，2026-09-11 push 时 GitHub 报；9/3 为 20、7/12 评估仅 2 —— 持续上涨）—— 下次开 Phase 前拉全量重新分诊，勿沿用旧判断
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

## [2026-09-11 04:42] 工作者 — 412 冻结修复：实现 + 测试 + 部署实测完成

**完成情况：**
- **实现**：`bilibili.js` `fetchVideoPages` 换端点降级链 —— 主 `/x/web-interface/wbi/view`，抛异常改走 `/x/player/pagelist`（数组形状适配 `{cid,duration}`），双失败抛汇总错误 `分P信息接口均失败 — wbi/view: …; pagelist: …`；降级仅由异常触发，单P→null 负缓存语义逐字不变；legacy `/x/web-interface/view` 与 `fetchVideoDetail` 一并移除。`sync.js` 步骤 5 逐视频 try/catch：失败 `console.warn`（bvid + err.message）→ `skippedCount++` → `continue`，不写库、不推进归档计数、不落负缓存；同步消息>0 时尾部追加「，跳过 N 个视频（分P信息获取失败）」，返回体新增 `skipped`。
- **测试**（干净 shell `env -i`，无会话变量）：36 例全绿 = `bilibili.test.js` 5（新）+ `sync.test.js` 23（21+2 新）+ `backlog.test.js` 8。`sync.test.js` 的模块级 mock 未改动。
- **提交**：`155f420`（4 文件，203+/11−；未 push，待全局者复审后发布）。`context.md` 未提交（按惯例）。
- **部署实测**（用户 `! pm2 restart bili`；boot 正常，`bili-error.log` 重启后无新条目、mtime 停在 04:22 旧栈）：
  - 登录 → `POST /api/sync`：HTTP 200（21.3s），`{ok:true,totalFetched:1188,updated:1,archived:0,skipped:0}`
  - `sync_log` #153：success「同步完成：更新 1 个视频」——无跳过后缀，旧格式逐字一致
  - `BV1YE411D7nH`（操作系统）：`last_synced_at` 9/5 → 2026-09-11 04:38:34；其 `page_cache` 由 8/30（恰在 9/6 03:07 越过 7 天 TTL —— 即本轮冻结的触发点）刷新为 04:38:34 —— 经新端点链实测取数成功
  - 归档数 2 → 2（未骤增）
- **独立探针**（应用自身 `fetchAllHistory` + 生产凭据只读解密、未打印）：历史窗口 = 1188 条，view_at 范围 2026-08-09 → 2026-09-11；窗口内本地视频恰 1 个（即上条操作系统课，最后观看 8/21）。其余 7 个最后观看早于 8/9，已滑出窗口。

**任务进度：**
- [x] 任务 1
- [x] 任务 2
- [x] 任务 3（完成标准①另见下「未解决的疑虑」1）

**关键决策点：**
- 架构/接口变动：`fetchVideoPages` 成功路径契约不变（`{pages,totalDuration}` / 单P null）；失败由单错误变为含两端点的汇总 Error；`runSync` 返回体新增 `skipped`；同步消息仅跳过>0 时追加后缀。
- 安全相关：**外部请求** —— 涉及：B站 端点变更（wbi/view、player/pagelist；汇总错误只含端点名与错误文本，不含凭据）。实测/探针只读解密生产 SESSDATA（沿用诊断先例，未打印）。其余（认证/密钥/用户输入/SQL/文件路径）：无。
- 偏离原计划：无（移除 `fetchVideoDetail` 系任务清单明示允许；测试多补「降级路径单P→null」一例）。
- 未解决的疑虑：
  1. **完成标准①「更新数 = 8」按系统实际语义核销为 1**：`runSync` 只刷新 B站 历史窗口内出现的视频（本地视频滑出窗口即不再刷新，系统既有语义）；探针证实当前窗口内本地视频恰 1 个。冻结前 9/4、9/5 成功同步同为 `updated=1` —— 修复后行为与冻结前一致。若期望更多刷新，属「窗口深度/刷新策略」议题，非本次 412 修复范围，请全局者裁定。
  2. 9/12 03:07 cron 首次自动跑结果（沿用「未验证的前提」，明日确认）。
  3. 窗口按天滑动 → 长期未观看的在追视频会自然停更（如上述 7 个）——供全局者知悉，非本轮引入。

**临时证据文件（VPS `/tmp`，非仓库）：** `/tmp/bili-smoke.js`（登录+同步冒烟）、`/tmp/bili-history-probe.cjs`（窗口探针）、`/tmp/bili-db-snapshot.js`（库快照）。

## [2026-09-11 04:46] 全局者 — 审查通过：412 修复放行（插入任务闭环）

**背景：** 工作者交接块（[2026-09-11 04:42] 条目）交付任务 1–3 完成；含一处待裁定：「完成标准①『更新数=8』按系统实际语义核销为 1」。旧条（[2026-09-11 04:28] 预诊断、[2026-09-11 04:40] 定稿）已随本轮归档至 `context_history.md`「插入任务：每日同步 412 冻结（2026-09-11）」段。

**审查动作（本侧独立 + critic，2026-09-11 04:43–04:46）：**
- 安全预检 `security-scan.sh afd305d`：命中 7 处（全在测试文件）；安全项非空（外部请求）→ invoke `critic`。
- critic 报告：**无 CRITICAL/HIGH/MEDIUM**；唯一 [LOW] = 测试未断言降级路径第二请求的凭据头透传（回归检测缺口，非现存漏洞）→ 入 backlog。7 处命中逐条核实为测试噪音（内存库绑定参数 SELECT、相对导入、假凭据 `'sess-fake'`）。URL/参数构造（URLSearchParams + 硬编码 host；bvid 下游为参数化 SQL）、凭据头（SESSDATA 仅进 Cookie 头，从不进 URL/日志/错误）、降级与错误路径（纯字符串拼接，无注入汇点）、错误与 warn 内容 —— 均核对无问题。**总体判断：可放行。**
- 全局者独立复核：源码 diff 逐行对照任务清单全符合；测试 36 例本侧干净 shell 重跑全绿（本 shell 无 JWT_SECRET）；生产核验 #153 success「更新 1 个视频」、`BV1YE411D7nH` last_synced_at/page_cache → 04:38:34、archived 2→2、error log 无新条目、pm2 online；降级链完整性探针 92 页视频两端点逐项一致（16/86/92 三例）。

**裁定（针对交接块「未解决的疑虑」）：**
1. 接受「更新数=1」：与冻结前 #144（9/3 10:00）、#145（9/4）、#146（9/5）逐字一致，属既有「只刷新 B站 历史窗口内视频」语义；探针证据（窗口 1188 条、08-09→09-11；窗口内本地视频恰 1；其余 7 个 last_synced_at ≤ 8/31，其中 2 个 manually_completed）成立。原「预期 8」作废。
2. cron 观察项保留（9/12 03:07）。
3. 「长期未观看 → 自然停更」非本轮引入 → backlog 备忘。

**发布决定：放行** commit `155f420`。push 被守卫拦截（双模型会话均无放行通道）→ 用户执行 `! git push origin master`；本条 docs commit 随之（本地）。

**移交：** 无待办；下一轮 session 核对 9/12 cron 结果。

