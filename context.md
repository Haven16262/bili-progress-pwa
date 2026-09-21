# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 无进行中 Phase。前序全部任务（412 冻结、删除功能、庆祝动效 + 归档 7 天、16px、放慢 1.2×）均已闭环并已 push（`origin/master` = `87d082c`，其后仅本地 docs 提交）；用户已删除预览视频，生产库回到 10 行真实数据。**本轮新插入任务「Dependabot 依赖安全清理」**（用户 2026-09-21 提出，本轮全局者已按 backlog 要求**拉全量重新分诊**）。
**当前任务:** 把 GitHub 上 **28 个 open 的 Dependabot 告警（14 个包）清到 0**：修法全在现有版本范围内（**无大版本升级、不加 `--force`、不加新依赖**）。**先在临时目录验证，再动真实目录**；**不重启服务、不 push、不重建 `client/dist`**（服务端依赖变了需用户 `! pm2 restart bili`；push 由用户）。
**关键依据文档（先读，含 14 包×告警号表、可达性核实、已知雷区）:** `docs/dependabot-triage-2026-09-21.md`。

**全局者分诊结论（要点，细节与依据见上文档）:**
- **已核实**：告警来源 = GitHub 扫**默认分支上的 `package-lock.json`**，所以必须提交并 push 新锁文件才会关闭；client 的漏洞包（nanoid/postcss/browserslist/fast-uri/brace-expansion）**没有一个进入浏览器产物**（`client/dist/assets/*.js` 搜索命中 0）；**全部有修复版本**；**`qs` 必须经 `express` → 4.22.3 才能到 6.16**（4.22.1 把 qs 写死 `~6.14.0`），不要用 `overrides` 硬压；`server` 上 **`npm audit fix --dry-run` 会崩**（npm 内部错误 `edgesOut`），要用 `npm update <包名>`；`client` 上 `npm audit fix` 不加 `--force` 即可。
- **已核实（读了本项目代码）**：服务端代码不调 `qs.stringify`、不开 `comma`、`express.json` 的 limit 合法（`1mb`）、只向写死的 `api.bilibili.com` 发请求 → 这些告警在本应用**不可达**。**判断**：实际被利用的可能性低，但值得清（告警一直在涨会淹没将来真正相关的）。

**任务清单(给工作者):**
- [ ] **T1 服务端：临时目录验证**。在 `/tmp/bili-dep-scratch/server/` 建一份**只含** `package.json`、`package-lock.json`、`src/`、`tests/`、`vitest.config.js`（及 `scripts/` 若测试需要）的拷贝——**不要复制 `data.db`、`.env`、`node_modules`**（含生产数据与密钥）。在其中：`npm ci`（先证明干净安装在本机能走通，含 `better-sqlite3` 的 prebuild 下载/编译）→ `npm update express ip-address vitest`（`postcss` 若仍旧再显式 `npm update postcss`）→ 干净 shell（`env -i`）跑测试 → `npm audit`（完成标准：**0 个漏洞**，或逐条列出残余并说明原因）→ `npm ls` 无 ERR/missing/invalid。**`package.json` 里的版本范围一个都不许改**（都在现有范围内）；若某个包必须改范围才能修 → 停下，回全局者。**`better-sqlite3` 版本不许变**（现为 11.10.0）。
- [ ] **T2 服务端：应用到真实目录**。把 T1 验证过的 `package-lock.json` 拷回 `server/`，在真实目录 `npm ci`，然后：`node -e` 打开 `:memory:` 库确认 `better-sqlite3` 能加载；干净 shell 跑 `server` 全部测试；`npm audit` 0。**不要 `pm2 restart`**（守卫会拦；重启由用户 `!`）。（完成标准：上述全过；交接里写明「服务端依赖已更新，需用户 `! pm2 restart bili` 才生效」）
- [ ] **T3 客户端**。`cd client && npm audit fix`（**不加 `--force`**）→ `npm audit` 0 → `npm ls` 无 ERR → `npm run build -- --outDir /tmp/bili-dist-check --emptyOutDir`（**构建到临时目录，不动 `client/dist`**：这些包不进浏览器产物，重建生产 dist 没有安全收益）。（完成标准：构建绿；比较临时产物与现 `client/dist` 的 JS/CSS 体积，差异大于 ±5% 则在交接里说明）
- [ ] **T4 交接前自查（锁文件 diff）**。对两份 `package-lock.json` 的 diff 各出一份清单：**版本变化的包（名 旧→新）**、**新增的包**、**移除的包**；并断言：① 新增/变更的 `resolved` 全部是 `registry.npmjs.org`；② 没有新增 `hasInstallScript: true` 的包；③ 只出现分诊文档里 14 个包及它们的传递依赖的变动。任一不成立 → 停下问全局者，别自行判断为无害。（完成标准：清单 + 三条断言结果写进交接）
- [ ] **T5 提交**。服务端与客户端**分两个提交**，`git add <明确路径>` + `git commit -- <同路径>`（只有锁文件；`package.json` 若一个字节都没变就不要加）。**不 push。**

**未验证的前提:**（2026-09-21）
- **判断**：`npm update express` 一步会把 `qs` 带到 6.16.x、`body-parser` 到 1.20.8——依据是 registry 上 `express@4.22.3` 的依赖声明（全局者用 `npm view` 读到 `qs ~6.16.0`），**本机未实际装过验证**，T1 落实。
- **判断**：server 开发依赖里的 `postcss` 能随 `vitest` 一并升；依据是它在 vite 依赖链上，**未实测**。
- **未知**：`npm` 具体版本（未记录）；`server` 上 `npm audit fix` 崩溃的根因（推测是 npm 内部 bug，未深究——绕开即可，不要花时间在它上面）。
- **本轮不做**：不改 `package.json` 版本范围、不引入 Dependabot 自动更新配置（见 backlog）、不重建生产 dist。

**backlog（下次开 Phase 顺手项，非紧急）:**
- 【2026-09-21 新增】**首页杯内数字的对比度整体低于 WCAG AA 4.5:1**：杯中部液体色 `rgb(172 97 245)` 上，现有 12px 白字 3.63、庆祝态 16px 淡紫 3.06–3.31；上端液体色更低（白字 2.42）。**既有状态，非本轮引入**；靠描边/黑影提升可辨识度，但数值上没到 AA。若要系统性修：加深液体色下界，或给数字加半透明深色衬底——属视觉语言层面的取舍，需用户拍板，不在小任务里顺手改
- 【2026-09-21 新增】部署后旧资源路径（如 `/assets/index-<旧哈希>.js`）返回 SPA 兜底 HTML（200 + `text/html`）而非 404 —— 工作者观察，**既有行为、非本轮引入**（2026-09-03 轮同一机制）；PWA `autoUpdate` 下次加载即更新，低优先，仅当出现「部署后白屏」的反馈再排查
- 【2026-09-11 新增】`bilibili.test.js` 补断言：降级路径第二请求的凭据头（Cookie/UA/Referer）透传一致性 —— critic LOW（回归检测缺口，非现存漏洞）
- 【2026-09-11 新增】「窗口外视频刷新策略」：B站 历史窗口滑动 → 长期未观看的在追视频自然停更（现语义；本次全量 8 个中 7 个已滑出窗口）。如做定向刷新，须受「B站 请求节制」约定约束
- 真机性能确认：液体玻璃 `backdrop-filter`（headless 4× throttle 已测；详情见上一 Phase 关闭条目）
- `@supports` 玻璃回退块 DRY（约 12 份散在组件 scoped 样式）
- `styleSrc 'unsafe-inline'` 移除需 nonce/hash 方案
- Dependabot 告警 28 个 → **本轮正在处理**（见「当前状态」与 `docs/dependabot-triage-2026-09-21.md`）。清完之后的建议（未决，用户定）：告警历史是 7/12 仅 2 → 9/3 是 20 → 9/11 是 28，**会再涨**；可考虑把「`npm audit` 两份锁文件」放进例行体检（如 `/pitstop`），或开 Dependabot security updates 自动提 PR——后者会让 PR 里混入依赖变化，需要一个审查流程，先不做
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
- **B站 图片必须 CORS 加载（2026-07-07 M2 教训）**：Chrome ORB 会拦截跨域 no-cors `<img>`（ERR_BLOCKED_BY_ORB，且报错只在网络层，DOM 只见裂图）。任何加载 B站 封面（`*.hdslb.com`/`*.bilibili.com`）的 `<img>` 都必须带 `crossorigin="anonymous"` + `referrerpolicy="no-referrer"`；CSP imgSrc 已含两域。首次误判为 CSP 问题，排查靠 Playwright 监听网络层
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **测试封闭性（2026-07-07 教训）**：测试必须在干净 shell 里可复现，不得依赖会话环境变量——工作者曾报「29 例全绿」实为其 shell 恰好导出了 JWT_SECRET，干净环境下新用例全被跳过。所需变量一律在 `server/vitest.config.js` 的 `test.env` 注入（现有 `TEST_DB=':memory:'` + 测试专用 JWT_SECRET）；**数据库隔离靠 TEST_DB，`NODE_ENV=test` 不隔离任何东西**。交接报测试结果前先在干净环境跑一遍
- **reduced-motion 策略 = 去位移留反馈（2026-07-12 定版）**：`main.css` 的 RM 块对动画压 `duration+delay` 至 0.01ms（**二者必须同压——只压 duration 时 `animation-delay` 残留会让 stagger 类动画在 RM 下逐个弹出甚至长时间不可见**），过渡用 `transition-property` 白名单（opacity/color/background-color/border-color/box-shadow）保留反馈。后续新动画不必单独写 RM 分支，但用 `opacity:0` 起始 + delay 的入场动画必须确认被该块覆盖
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

## [2026-09-21 11:35] 工作者 — T9 构建上线完成（3.6s 版）+ 预览行 v3

**完成情况：** `cd client && npm run build`（不带 `--outDir`）**绿** → `dist/assets/index-Czx-wwLI.css`（45.87 kB）+ `index-B1iCjU_8.js`（120.97 kB）；curl 生产 `127.0.0.1:3000` 的 index.html 引用哈希与 `client/dist/assets` **逐字一致**、两资源均 HTTP 200；线上 CSS 搜到 `--duration-celebrate: 3.6s`（压缩后冒号后留了一个空格，值与 T9 要求一致），且六处 `animation`（3 组庆祝 burst + 3 组悬停重放 once）都写成 `var(--duration-celebrate)` → **慢 1.2× 版已上线**。**未 push**。
**预览行（构建之后创建，按 T9 规则）**：**`BV_TEST_CEL_PREVIEW3`**，标题「庆祝动效预览 v3（慢 1.2×）· 看完可用红按钮删除」，`progress 100`。假 bvid，永不出现在 B站 历史里，同步不会碰它；用户看完可用首页红色「删除」清掉。（注：上一轮的 `BV_TEST_CEL_PREVIEW2` 已随 11:33 那轮验证清理删除，全局者审查条已接受。）
**任务进度：** - [x] T9 构建上线
**关键决策点：** 架构/接口变动：无（仅重新构建静态资源）；安全相关：无（无新增输入面/请求/凭据面）；偏离原计划：无；未解决的疑虑：无（1.2× 是否合适由用户肉眼定；若要再调，改 `--duration-celebrate` + `CELEBRATION_MS` 两处即可，token 注释已写明联动）。

**顺带变动：** 已按工作者写入流程第一步勾选 T9 并加完成状态行（「当前状态」里的预览行段落此前已被全局者重写，故预览 bvid 记在本条与状态行里）；未改动全局者正文。

## [2026-09-21 11:42] 全局者 — 决策：Dependabot 依赖安全清理（28 告警 / 14 包，全在现有范围内）

**背景：** 用户 2026-09-21 要求处理 Dependabot。backlog 早就写明「下次开 Phase 前拉全量重新分诊，勿沿用旧判断」，所以本轮先 `gh api` 拉全量、再读 advisory、再在本机验证可行路径，最后才定方向。

**分诊结果（细节与依据见 `docs/dependabot-triage-2026-09-21.md`）：**
- 28 个 open / 14 个包 / 两份锁文件；全部有修复版本；全部在现有 semver 范围内，**无大版本升级**。
- **已核实**：client 漏洞包不进浏览器产物（搜索命中 0）；服务端代码不触达 `qs.stringify`/`comma`、`body-parser` limit 合法、无用户可控外发 URL → 告警在本应用**不可达**（**判断**：实际被利用可能性低，但值得清——告警持续上涨会淹没将来真正相关的）。
- **本机发现的两个坑（避免工作者踩）：** ① `server` 上 `npm audit fix --dry-run` 直接崩（npm 内部错误），要按名字 `npm update`；② `qs` 被 `express@4.22.1` 写死 `~6.14.0`，只有 `express@4.22.3` 才放宽到 `~6.16.0`，所以必须经 `express` 升，不能 `overrides`。

**决策：** 只提交锁文件、不改 `package.json` 范围；先临时目录验证再动真实目录；不重启服务、不 push、不重建生产 dist（client 漏洞包不进产物，重建无安全收益只有风险）；复审时我会跑锁文件 diff 检查，并按规则 invoke `critic` 看供应链变动（新增包 / install script / 非官方 registry）。

**升级判定（判断，非事实）：** 依赖版本更新不在 `WORKFLOW.md` 强制升级清单内；改动局限于锁文件、可被测试与 `npm audit` 客观验证 → 交工作者。若出现须改 `package.json` 范围、须动 `better-sqlite3`、或锁文件 diff 自查任一断言不成立 → 停下回全局者。

**移交工作者：** T1 → T2 → T3 → T4 → T5。完成后：我复审 → 用户 `! pm2 restart bili`（服务端依赖生效）+ `! git push origin master` → 我再拉一次 GitHub 告警确认归零。
