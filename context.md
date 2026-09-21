# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 无进行中 Phase。前序任务（含 Dependabot 依赖清理：GitHub open 15 → 0）均已闭环。**本轮新插入任务「依赖冷却期 + 依赖体检脚本」**：用户 2026-09-21 同意 backlog 里的两条建议——① 依赖冷却期，② 把 `npm audit` 放进例行体检；并追问「体检是指 pitstop 吗」。
**当前任务:** 做一个**可执行**的检查脚本 `scripts/lock-check.mjs`（`--diff` 管冷却期与供应链断言，`--audit` 管漏洞体检），并写 `docs/dependency-policy.md`。**不改 `package.json`、不动依赖、不重启、不 push。**
**关键依据文档:** `docs/dependabot-triage-2026-09-21.md`（含「执行结果与补充」：验证方法、npm 崩溃绕法）；起点草稿 `plans/dep-audit/lockcheck-draft.mjs`（全局者 Dependabot 复审时写的一次性脚本，**只当起点**：基准提交写死、无退出码约定、不可回归测试）。

**用户/全局者已定（不要重新讨论）:**
1. **冷却期默认 N = 7 天**（全局者定，用户只同意了「要冷却期」没指定天数）：依赖更新引入的**每个新版本**须发布满 7 天才采用。**例外 = 告警驱动的安全修复**：允许不满 7 天，但必须 ① 该版本通过 `npm audit signatures` ② 维护者列表与旧版本一致 ③ 在交接里逐条写明（包名@版本、发布天数、为什么必须）；脚本用 `--allow name@ver` 显式放行，**放行清单本身要出现在输出里**。
2. **pitstop 不是合适的落点（已核实）**：pitstop 是机器级配置巡检（域 1–10：仓库对账/基建/Memory/CC 配置/Stars/上游容器/vault/文件结构/内容编辑），`SKILL.md` 与 `BACKLOG.md` 里搜 `npm audit`/`dependabot`/`依赖`/`lockfile` **无一处相关**；给它加域属「新域设计改动」，按其自身规则需跨端（VPS+MSI）协调。**所以本项目先在项目内落地**（本任务），pitstop 域另写成 Drafts 草稿留给用户专开 session：`/root/workspace/drafts/pitstop-domain-project-deps-proposal-0921.md`。工作者**不要碰 pitstop**。
3. 周期性体检的触发点 = **全局者开新任务前看 `context.md`「跨 Phase 关键约定」里的「依赖体检记录」日期，距今 >30 天就先跑 `--audit`**（见约定条）。不建 cron（没人读的定时输出等于没触发点），不建 GitHub Actions（本轮不做）。

**任务清单(给工作者):**
- [ ] **T1 `scripts/lock-check.mjs` 的 `--diff` 模式**（仓库根新建 `scripts/`；ES module，**只用 node 内置模块 + 调用 `npm view`**，不加任何依赖）：`node scripts/lock-check.mjs --diff <base-ref> [--min-age-days 7] [--allow name@ver,...] [--root <目录>]`。对 `server/` 与 `client/` 两份 `package-lock.json`，比对 `<base-ref>` 处的版本与工作区当前版本，报告变化/新增/移除计数，并断言：① 变化/新增包的 `resolved` 全为 `https://registry.npmjs.org/`；② 有 `resolved` 的包都有 `integrity`；③ 无新增 `hasInstallScript: true`；④ **每个变化/新增版本发布满 N 天**（`npm view <包> time --json`，未满且不在 `--allow` 里 = 违规）。**最后一行输出固定格式**：`查了 <n> 个变动包（server <a> / client <b>），范围 <base>..<工作区>，最年轻 <x> 天，违规 <k> 项，放行 <m> 项：<清单>`。**退出码**：0 = 无违规；1 = 有违规；**2 = 算不出**（base-ref 不存在 / 锁文件读不了 / `npm view` 联网失败 / 某包查不到发布时间）——**必须非零，不许当通过，不许输出「没有新东西」**。
- [ ] **T2 `--audit` 模式**：`node scripts/lock-check.mjs --audit [--root <目录>]`。对两份锁文件各跑 `npm audit --package-lock-only --json`（不依赖 `node_modules`），再 `gh api repos/Haven16262/bili-progress-pwa/dependabot/alerts?state=open`。**输出固定格式**：`查了 server <n> 包 / client <m> 包（npm audit），GitHub open 告警 <k> 个；漏洞 <v> 个`。退出码：0 = 全 0；1 = 有漏洞或 open>0；**2 = 没查成**（`npm audit` 联网失败、输出无法解析、`gh` 不可用/未登录）——**`gh` 不可用不许悄悄跳过再报绿**，必须明说「GitHub 告警未查」并退出 2。⚠️ **`npm audit` 联网失败时输出可能为空，不能当成「0 个漏洞」**。
- [ ] **T3 自测（按用户「写检查脚本」纪律，结果写进交接）**：**(a) 列出脚本里所有会返回退出码 0 的路径，逐条确认该路径上确实执行过对应检查**；**(b) 确认它不会永远报警**：现状（依赖已清零、锁文件已 push）`--audit` 应退出 0；**(c) 确定性回归**（不能依赖「今天有哪些版本刚发布」，那会随时间漂移）：`--diff d6df3c7 --min-age-days 0` → 退出 0；`--diff d6df3c7 --min-age-days 3650` → 退出 1（所有版本都不到 10 年）；`--diff 不存在的ref` → 退出 2；`npm_config_registry=http://127.0.0.1:9 node scripts/lock-check.mjs --diff d6df3c7` → 退出 2（模拟联网失败）；`--audit --root <把 d6df3c7 处两份旧锁文件+package.json 放进去的临时目录>` → 退出 1 且漏洞数 >0（`--package-lock-only` 不需要 `node_modules`）；`--audit` 在 `gh` 不可用时（如 `PATH` 里去掉 gh）→ 退出 2。任一与预期不符 = 脚本有缺陷，先修再交接。
- [ ] **T4 验证 npm 10.9.8 的 `--before` 能否当原生冷却手段**（**全局者未实测**）：在**临时目录**（只拷 `package.json` + `package-lock.json`，不拷 `data.db`/`.env`/`node_modules`）里试 `npm update express --package-lock-only --before=2026-09-10T00:00:00Z`，看 `express` 是否落到 4.22.3 之前的版本；再试不带 `--before` 对照。**如实写结果**：能用 → 写进 `docs/dependency-policy.md` 作为「更新时的操作方式」；不能用/行为不符 → 写清实际行为，冷却期就只靠 `lock-check.mjs --diff` 做事后关卡。
- [ ] **T5 `docs/dependency-policy.md` + 提交**：文档包含 ① 冷却期规则（N=7、例外与放行流程）② 更新依赖时的操作方式（含 T4 结论、`server` 上 `npm audit fix`/多包 `npm update` 会崩的绕法——引用分诊文档而非复制）③ 三个触发点（见下）④ 脚本用法与退出码。**触发点**：(a) **工作者**：任何改动 `package-lock.json` 的任务，交接前跑 `--diff <任务起始 commit>` 并把输出粘进交接；(b) **全局者**：审查的 diff 触及锁文件时必跑；(c) **周期**：见上「已定 3」。提交 `scripts/lock-check.mjs` 与 `docs/dependency-policy.md`（`git add <明确路径>` + `git commit -- <同路径>`），**不 push**。

**未验证的前提:**（2026-09-21 12:09 复审前）
- **未实测**：npm 10.9.8 的 `--before` 是否真能约束 `npm update` 的解析（T4 落实）；全局者只确认了 npm 10.9.8 **没有** `min-release-age` 这类原生开关（`npm help config` 里 0 命中）、有 `before` 配置项。
- **判断**：N=7 天是否合适——本次审查里最年轻的必需版本是 `express@4.22.3`（发布 7 天，且是拿到 `qs` 修复的唯一途径），恰好压在线上；若日后 N 调大，这类「必须」的版本会更频繁地需要走例外流程。
- **判断**：「全局者开新任务前看日期」这个周期触发点依赖全局者会话每次读 `context.md`（`/as-overseer` 与 `CLAUDE.md` 都要求读，但不是脚本强制）——是**弱触发点**，比 cron 可靠是因为有人读，比自动化弱是因为靠会话纪律。
- **本轮不做**：GitHub Actions 定时工作流、Dependabot 自动 PR、改动 pitstop、改动 `/as-overseer` 模板（后者是跨项目共用模板，改动须另开 session）。

**backlog（下次开 Phase 顺手项，非紧急）:**
- 【2026-09-21 新增·既有行为】`server/src/index.js` 第 98–101 行的**全局错误处理器把所有错误一律返回 500**：body-parser 抛的 413（请求体过大）、畸形 JSON 的 400 等本应是 4xx 的错误，客户端看到的都是 500 且日志里报 `[error]`。**不是本轮引入**（本轮 `src` 零改动，全局者用新依赖起临时实例实测：超 1MB 请求体确实被拒，但返回 500）。低优先，安全上无影响（限制仍然有效、不泄露栈信息）；若要修：处理器里尊重 `err.status`/`err.statusCode`（4xx 原样返回，仅 5xx 统一成「服务器内部错误」）
- 【2026-09-21 新增】**首页杯内数字的对比度整体低于 WCAG AA 4.5:1**：杯中部液体色 `rgb(172 97 245)` 上，现有 12px 白字 3.63、庆祝态 16px 淡紫 3.06–3.31；上端液体色更低（白字 2.42）。**既有状态，非本轮引入**；靠描边/黑影提升可辨识度，但数值上没到 AA。若要系统性修：加深液体色下界，或给数字加半透明深色衬底——属视觉语言层面的取舍，需用户拍板，不在小任务里顺手改
- 【2026-09-21 新增】部署后旧资源路径（如 `/assets/index-<旧哈希>.js`）返回 SPA 兜底 HTML（200 + `text/html`）而非 404 —— 工作者观察，**既有行为、非本轮引入**（2026-09-03 轮同一机制）；PWA `autoUpdate` 下次加载即更新，低优先，仅当出现「部署后白屏」的反馈再排查
- 【2026-09-11 新增】`bilibili.test.js` 补断言：降级路径第二请求的凭据头（Cookie/UA/Referer）透传一致性 —— critic LOW（回归检测缺口，非现存漏洞）
- 【2026-09-11 新增】「窗口外视频刷新策略」：B站 历史窗口滑动 → 长期未观看的在追视频自然停更（现语义；本次全量 8 个中 7 个已滑出窗口）。如做定向刷新，须受「B站 请求节制」约定约束
- 真机性能确认：液体玻璃 `backdrop-filter`（headless 4× throttle 已测；详情见上一 Phase 关闭条目）
- `@supports` 玻璃回退块 DRY（约 12 份散在组件 scoped 样式）
- `styleSrc 'unsafe-inline'` 移除需 nonce/hash 方案
- Dependabot 告警已清零（2026-09-21，GitHub open=0）。用户同意「依赖冷却期 + npm audit 进例行体检」→ **本轮落实**（见「当前状态」；pitstop 新增「项目依赖」域的提案已写入 Drafts，待用户另开 session）。仍开放的选项：Dependabot 自动 PR / GitHub Actions 定时审计——本轮不做，需要一个审查流程接住依赖变化 PR
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
- **100% 庆祝动效 = A+C 紫光（用户定版，2026-09-21，规格见 `plans/009-celebrate-100.md`）**：首页 `progress>=100` 的杯子，数字淡紫渐变（**16px，静态无柔光，只留深紫描边**）+ 杯外紫色光环/亮弧；每视频每设备首次播一次（localStorage `celebrated_100_ids`），之后静态，桌面悬停重放；时长 **3.6s** 由 `main.css` 的 `--duration-celebrate` 控制，**改它要同步 `Cylinder3D.vue` 的 `CELEBRATION_MS`**；reduced-motion 下不播只留静态终态；设置页不做。**用户明确否决过彩虹（与紫色玻璃液体违和）和白光（单调）**——后续 UI 轮不得改回。100% 视频首页保留 **7 个日历日**（`sync.js` 的 `ARCHIVE_AFTER_DAYS`）。数字对比度现状（低于 AA 4.5:1，既有状态）见 backlog。
- **依赖更新纪律（2026-09-21 定；脚本与操作方式见 `docs/dependency-policy.md`，任务落地前以本条为准）**：① **冷却期 N=7 天**：更新引入的每个新版本须发布满 7 天；**例外仅限告警驱动的安全修复**（须 `npm audit signatures` 通过 + 维护者列表未变 + 交接里逐条写明，脚本用 `--allow` 放行）。② **只提交锁文件**，`package.json` 的版本范围不动，除非用户批准；服务端依赖变了须用户 `! pm2 restart bili`；client 的构建期依赖不进浏览器产物，不必重建 `client/dist`。③ **触发点**：工作者改锁文件后交接前、全局者审查触及锁文件的 diff 时，都跑 `node scripts/lock-check.mjs --diff <base>`；周期体检 = 全局者**开新任务前**若下面的日期距今 >30 天，先跑 `node scripts/lock-check.mjs --audit`（脚本落地前用 `npm audit` + `gh api .../dependabot/alerts?state=open` 手查）。④ **依赖体检记录（全局者每次体检后更新这一行）：上次 2026-09-21，GitHub open=0，两份锁文件 `npm audit` 均 0。**
- **B站 图片必须 CORS 加载（2026-07-07 M2 教训）**：Chrome ORB 会拦截跨域 no-cors `<img>`（ERR_BLOCKED_BY_ORB，且报错只在网络层，DOM 只见裂图）。任何加载 B站 封面（`*.hdslb.com`/`*.bilibili.com`）的 `<img>` 都必须带 `crossorigin="anonymous"` + `referrerpolicy="no-referrer"`；CSP imgSrc 已含两域。首次误判为 CSP 问题，排查靠 Playwright 监听网络层
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **测试封闭性（2026-07-07 教训）**：测试必须在干净 shell 里可复现，不得依赖会话环境变量——工作者曾报「29 例全绿」实为其 shell 恰好导出了 JWT_SECRET，干净环境下新用例全被跳过。所需变量一律在 `server/vitest.config.js` 的 `test.env` 注入（现有 `TEST_DB=':memory:'` + 测试专用 JWT_SECRET）；**数据库隔离靠 TEST_DB，`NODE_ENV=test` 不隔离任何东西**。交接报测试结果前先在干净环境跑一遍
- **reduced-motion 策略 = 去位移留反馈（2026-07-12 定版）**：`main.css` 的 RM 块对动画压 `duration+delay` 至 0.01ms（**二者必须同压——只压 duration 时 `animation-delay` 残留会让 stagger 类动画在 RM 下逐个弹出甚至长时间不可见**），过渡用 `transition-property` 白名单（opacity/color/background-color/border-color/box-shadow）保留反馈。后续新动画不必单独写 RM 分支，但用 `opacity:0` 起始 + delay 的入场动画必须确认被该块覆盖
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

## [2026-09-21 11:47] 工作者 — Dependabot 依赖清理完成（两锁文件 audit 0，未重启/未 push）

**完成情况：**
- **T1（临时目录验证，`/tmp/bili-dep-scratch/server/`）**：只含 package.json / package-lock.json / src / tests / vitest.config.js（**无 data.db、.env、node_modules**）。`npm ci` 走通（含 better-sqlite3 prebuild 下载）→ 更新 → `env -i` 全量 **46 例全绿** → `npm audit` **0** → `npm ls` 无 ERR/missing/invalid ✓
- **T2（真实目录）**：把验证过的锁文件拷回 `server/` → `npm ci`（169 包，audit 0）→ `node -e` 打开 `:memory:` 库确认 **better-sqlite3 11.10.0 加载正常**（建表/插入/查询通过）→ `env -i` **46 例全绿** → audit 0。**未 `pm2 restart`**（生产 `127.0.0.1:3000/api/ping` 全程 200）→ **需用户 `! pm2 restart bili` 才在运行进程生效**。
- **T3（客户端）**：`npm audit fix`（**不加 `--force`**）→ **0 漏洞**（changed 28 packages）→ `npm ls` 无 ERR/missing/invalid → `npm run build -- --outDir /tmp/bili-dist-check --emptyOutDir` **绿**。产物与现 `client/dist` **同名哈希、同字节数**：JS 120965 B、CSS 45874 B（**+0.00%**）→ 确认这些包不进浏览器产物，**未重建生产 dist**。
- **T4（锁文件 diff 三断言；脚本 `/tmp/bili-dep-scratch/lockdiff.py`，未进仓库）**：
  - **server**：版本变化 **17** / 新增 **0** / 移除 **1**。变化 = `express 4.22.1→4.22.3`、`qs 6.14.2→6.16.0`、`body-parser 1.20.5→1.20.8`、`ip-address 10.2.0→10.7.2`、`vitest` 与 `@vitest/{expect,mocker,pretty-format,runner,snapshot,spy,utils} 4.1.9→4.1.11`、`postcss 8.5.16→8.5.28`、`nanoid 3.3.15→3.3.19`、`side-channel 1.1.0→1.1.1`、`tinyrainbow 3.1.0→3.1.1`、`@jridgewell/sourcemap-codec 1.5.5→1.6.0`；移除 = `body-parser/node_modules/qs`（嵌套旧副本，已 dedupe 到顶层 6.16.0）。
  - **client**：版本变化 **28** / 新增 **0** / 移除 **0**。变化 = `nanoid 3.3.11→3.3.19`、`postcss 8.5.12→8.5.28`、`fast-uri 3.1.2→3.1.8`、`brace-expansion 5.0.6→5.0.12`（另一份嵌套 `2.1.0→2.1.7`）、`browserslist 4.28.2→4.29.0`、`baseline-browser-mapping 2.10.24→2.11.25`、`@babel/core 7.29.0→7.29.7` 及 `@babel/*` 家族、`postcss-selector-parser 6.1.2→6.1.4`、`caniuse-lite`、`electron-to-chromium`、`node-releases`、`update-browserslist-db`。
  - **① resolved 全为 `registry.npmjs.org`：✅** ｜ **② 新增包里 `hasInstallScript`：0 个（两份锁文件都零新增包）：✅** ｜ **③ 涉及包名逐一对照分诊文档 14 包及传递依赖：✅**（server 侧多出的 `express` 即文档指定的承载路径；`nanoid` 是 postcss 的依赖、`side-channel` 是 qs 的依赖、`tinyrainbow`/`@jridgewell/sourcemap-codec`/`@vitest/*` 是 vitest 的依赖，均属传递依赖）。
- **T5**：提交 `05729f6`（server 锁文件，80+/94−）与 `9083ae6`（client 锁文件，128+/125−）；`git diff --stat -- server/package.json client/package.json` **无输出**（逐字节未改）；**未 push**。
- **环境备注（分诊文档未记全，实测补充）**：npm **10.9.8** 上 server 侧 `npm audit fix` **与** `npm update <含 vitest 的多个包>` 都会崩在同一处 arborist `loadPeerSet`（`Cannot read properties of null (reading 'edgesOut')`），崩点由 `vitest@4.1.11` 的 peer 图触发。可行绕法：① `npm update <包名>` **逐个**更新（express / ip-address / body-parser / postcss 都不崩）；② vitest 一步加 **`--legacy-peer-deps`**（只改 peer 解析；本锁文件上结果是纯版本提升，见 T4 断言①③）。
- **回滚材料**：旧锁文件备份 `/tmp/bili-dep-scratch/{server,client}-package-lock.json.orig`（git 历史里同样可取）。

**任务进度：** - [x] T1 - [x] T2 - [x] T3 - [x] T4 - [x] T5

**关键决策点：**
- 架构/接口变动：无（仅两份锁文件；`package.json` 未动）。
- 安全相关：**依赖更新本身** —— 28 个告警涉及包全部升到修复版本（或更高，仍在范围内）；零新增依赖、零 install script、resolved 全为官方 registry。可达性判断见分诊文档（这些告警在本应用代码路径不可达）。认证/密钥/用户输入/SQL/文件路径/外部请求：无变化。
- 偏离原计划：① vitest 一步改用 `--legacy-peer-deps` 绕过 npm 崩溃（分诊只建议「按名字 update」，实测不够）；② `ip-address` 落到 10.7.2（文档预期 10.3.1）、server `postcss` 落到 8.5.28（文档预期 8.5.23）——都在原范围内、都是更新版本，无风险差异。
- 未解决的疑虑：
  1. `--legacy-peer-deps` 只影响这一次 resolution；以后常规 `npm install` 会按正常 peer 规则重算依赖树，届时解析结果可能又变（无实际影响，锁文件为准）——仅备注。
  2. 告警是否真关闭 = **push 后** GitHub 重扫（有几分钟延迟）；本地代理指标（两份 `npm audit` 0）已达标，验收标准以 push 后的 API 读数为准。
  3. better-sqlite3 未动版本（11.10.0），但 `npm ci` 重装过它：已实测 `:memory:` 加载正常 + 测试全绿；生产进程要重启后才会用新装的副本（启动脚本的 ABI 自愈兜底仍在）。

**顺带变动：** 已按工作者写入流程第一步勾选 T1–T5 并加完成状态行；未改动全局者正文。

## [2026-09-21 12:09] 全局者 — 决策：依赖冷却期（N=7）+ 依赖体检脚本（项目内落地）

**背景：** Dependabot 清零后，用户 2026-09-21 同意 backlog 里的两条建议（依赖冷却期；`npm audit` 进例行体检），并问「体检是指 pitstop 吗」。

**回答用户的问题（已核实，读了 `~/.claude/skills/pitstop/SKILL.md` 的结构并 grep）：** 我先前写「如 `/pitstop`」只是候选。读完后结论：**pitstop 现在没有任何域覆盖项目依赖**（域 1–10 全是机器配置/基建/memory/CC 配置/Stars/上游容器/vault/文件结构/内容编辑；`npm audit`/`dependabot`/`lockfile` 搜索无相关命中）；给它加域是「新域设计改动」，按其自身规则需跨端（VPS+MSI）协调、且它自称实验版，**不适合在本项目会话里改**。所以拆成两半：**项目内先落地**（本任务，立刻有效、可执行、有退出码），**pitstop 域另写草稿**（`/root/workspace/drafts/pitstop-domain-project-deps-proposal-0921.md`，含已核实/未验证清单，留给用户专开 session）。

**决策：** 见「当前状态」的「已定」与 T1–T5。要点：冷却期 N=7 + 告警驱动的安全修复例外（须签名验证 + 维护者未变 + 交接逐条写明）；用脚本而不是纯文字规则；脚本遵守用户「写检查脚本」纪律（不许「没有新东西」、算不出必须非零退出、要有确定性回归、不能永远报警）；周期触发点 = 全局者开新任务前看「依赖体检记录」日期。

**如实记录的一处纠正：** 我早先在 Dependabot 复审里说「`npm update` 按名字更新」就够，工作者实测发现 vitest 多包仍会崩、需 `--legacy-peer-deps`——已补进分诊文档。这次的 T4（`--before`）我同样**没有实测**，明确标了未验证，让工作者在临时目录验证后再写进文档，不把它当事实。

**升级判定（判断）：** 纯脚本 + 文档、不动依赖、不涉及认证/密钥/并发/不可逆操作，交工作者；脚本会调用 `npm`/`gh`（外部命令与网络），复审时我会按规则过安全预检。

**移交工作者：** T1 → T2 → T3 → T4 → T5。交接块请附：T3 六项回归的实际退出码、「所有退出 0 路径」清单、T4 的实测结论。
