# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 无进行中 Phase。任务「依赖冷却期 + 依赖体检脚本」**已完成待用户 push**：`scripts/lock-check.mjs` 经两轮独立安全审查（第 1 轮打回 4 HIGH；第 2 轮又发现 1 HIGH + 5 MEDIUM），**第 2 轮的修复按「触发式升级」由全局者直接实现**（同一模块第 2 次被打回），自测 **47/47**，同一套用例拿第 1 轮修复版 `74096ac` 跑是 26/47（新增 21 项全红）。详见「本 Phase 历史」[2026-09-21 15:09] 全局者条。
**当前任务:** 无待办给工作者。用户 `! git push origin master` 后本轮收尾。
**校准要求（判断）：** 第 2 轮修复**只经全局者自验，未再经独立复审**（每个缺口都在旧版上真实复现、在新版上确认修好，但没有第三次对抗式审查）。所以**下一次真实使用**（有人改锁文件、需要跑 `--diff` 时）全局者要**并行手工解析锁文件比对一次**；两者一致才撤销此要求，不一致按缺陷处理。
**未提交的工作者改动：** 无（本次提交把工作者交接块、我的修复与文档一并入库）。

**本轮未做 / 留待：** GitHub Actions / Dependabot 自动 PR；pitstop「项目依赖」域与工作流 `docs/` 模块（草稿在 `/root/workspace/drafts/`，用户另开 session）；`--allow` 只跳过冷却期、不校验放行名单是否在允许集合内（工作者交接提到的未解决疑虑，未收紧）；`lock-check.mjs` 不下载 tarball 验哈希、不验签名（文档「限制」已写明）；下次依赖体检约 2026-10-21。

**已核实 / 判断 / 未验证（本轮收尾）:**
- **已核实**：第 2 轮 21 个缺口的自测在 `74096ac` 上全红、在修复版上全绿（47/47）；`NODE_ENV=production` 下 `--audit` 旧版对含 critical 漏洞的锁报「漏洞 0 个」退出 0、新版报 2 个退出 1；`TMPDIR` 祖先放 `package.json`+`.npmrc` 时旧版 `--diff` 命中假 registry（1 次）并退出 0、新版 0 次命中并退出 2；包名 `..` 旧版退出 0、新版退出 2；真实仓库 `--diff HEAD` 对全部 659 个条目 0 违规（新规则没有对真实锁误报）。
- **判断**：威胁模型仍是「人在本机手跑、无 CI」；别名缺口当前两份真实锁里 0 个条目，但会挡住下一次动 `@isaacs/cliui` 一类依赖的更新，所以本轮修。
- **未验证**：`GH_HOST`/`GH_REPO`、`GIT_DIR` 的旧版危害只按审查者复现 + 自测（旧版红）确认，未对真实 gh 另做实机验证；第 2 轮修复的独立复审（见上）。

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
- **依赖更新纪律（2026-09-21 定；脚本与操作方式见 `docs/dependency-policy.md`，任务落地前以本条为准）**：① **冷却期 N=7 天**：更新引入的每个新版本须发布满 7 天；**例外仅限告警驱动的安全修复**（须 `npm audit signatures` 通过 + 维护者列表未变 + 交接里逐条写明，脚本用 `--allow` 放行）。② **只提交锁文件**，`package.json` 的版本范围不动，除非用户批准；服务端依赖变了须用户 `! pm2 restart bili`；client 的构建期依赖不进浏览器产物，不必重建 `client/dist`。③ **触发点**：工作者改锁文件后交接前、全局者审查触及锁文件的 diff 时，都跑 `node scripts/lock-check.mjs --diff <base>`；周期体检 = 全局者**开新任务前**若下面的日期距今 >30 天，先跑 `node scripts/lock-check.mjs --audit`（脚本落地前用 `npm audit` + `gh api .../dependabot/alerts?state=open` 手查）。④ **依赖体检记录（全局者每次体检后更新这一行）：上次 2026-09-21，GitHub open=0，两份锁文件 `npm audit` 均 0。** ⑤ **校准期（2026-09-21）**：`lock-check.mjs` 已修完两轮审查缺口，但第 2 轮修复未经独立复审；**下一次真实使用它时，全局者并行手工解析锁文件 JSON 比对一次**，两者一致再撤销本条；不一致按缺陷处理。
- **B站 图片必须 CORS 加载（2026-07-07 M2 教训）**：Chrome ORB 会拦截跨域 no-cors `<img>`（ERR_BLOCKED_BY_ORB，且报错只在网络层，DOM 只见裂图）。任何加载 B站 封面（`*.hdslb.com`/`*.bilibili.com`）的 `<img>` 都必须带 `crossorigin="anonymous"` + `referrerpolicy="no-referrer"`；CSP imgSrc 已含两域。首次误判为 CSP 问题，排查靠 Playwright 监听网络层
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **测试封闭性（2026-07-07 教训）**：测试必须在干净 shell 里可复现，不得依赖会话环境变量——工作者曾报「29 例全绿」实为其 shell 恰好导出了 JWT_SECRET，干净环境下新用例全被跳过。所需变量一律在 `server/vitest.config.js` 的 `test.env` 注入（现有 `TEST_DB=':memory:'` + 测试专用 JWT_SECRET）；**数据库隔离靠 TEST_DB，`NODE_ENV=test` 不隔离任何东西**。交接报测试结果前先在干净环境跑一遍
- **reduced-motion 策略 = 去位移留反馈（2026-07-12 定版）**：`main.css` 的 RM 块对动画压 `duration+delay` 至 0.01ms（**二者必须同压——只压 duration 时 `animation-delay` 残留会让 stagger 类动画在 RM 下逐个弹出甚至长时间不可见**），过渡用 `transition-property` 白名单（opacity/color/background-color/border-color/box-shadow）保留反馈。后续新动画不必单独写 RM 分支，但用 `opacity:0` 起始 + delay 的入场动画必须确认被该块覆盖
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

## [2026-09-21 13:01] 工作者 — lock-check.mjs 修复完成（4 HIGH + 2 MEDIUM + LOW）+ 可重复自测

**完成情况（commit `74096ac` 修复+文档、`3ae10ef` 自测；均**未 push**；未改依赖/package.json/锁文件）**

- **自测末行（修复版）**：`跑了 25 项，通过 25，失败 0，需联网但联网失败 0`（退出 0）
- **「先红」证据（同一套 25 项，拿旧版 `d8b6ca2` 跑）**：`跑了 25 项，通过 10，失败 15，需联网但联网失败 0`（退出 1）。逐条原始输出（节选，均为旧版）：
  | 缺陷 | 旧版输出（红） | 修复版（绿） |
  |---|---|---|
  | H1 同版本改 resolved/integrity/加 install script | `exit=0`「查了 **0 个变动包**（server 0 / client 0）…违规 **0 项**」 | `exit=1`，三条违规逐项列出（版本没变但 resolved 变了 / integrity 变了 / 新增 install script） |
  | H2a 同版本 resolved 指别的包 | `exit=0`「查了 0 个变动包…违规 0 项」 | `exit=1`「的 resolved 指向别的包/版本」 |
  | H2b 升版本但 resolved 指旧版本 | `exit=0`「查了 1 个变动包…违规 0 项」 | `exit=1` 同上 |
  | H3 版本 `constructor` / `__proto__` / `toString` | `exit=0`「最年轻 **NaN** 天…违规 **0 项**」（三种都一样） | `exit=2`「算不出：查不到 good-dep@constructor 的发布时间」 |
  | H4a/H4b（npm_config_registry / 仓库 `.npmrc`） | `exit=0`（且无 registry 回显；记录型桩显示 config 未隔离） | `exit=0` 且**记录型桩断言**通过：argv 含 `--registry=<LOCK_CHECK_REGISTRY>`、`--userconfig=`/`--globalconfig=` 指向空文件、环境里 `npm_config_*` 计数 **0**、npm 的 cwd 不在仓库内 |
  | M1 锁条目为 null | `exit=1`，Node 栈（`at async asyncRunEntryPointWithESMLoader …`） | `exit=2`「算不出：锁条目不是对象」 |
  | L1a/L1b `--diff -h` / `--diff --output=x` | `exit=2` 但不是拒绝选项，而是 `git show -h:… 失败(129)`；**L1b 时 git 把 `--output=x:server/package-lock.json` 当成输出文件去写**（因父目录不存在才失败） | `exit=2`「算不出：base-ref 以 - 开头，拒绝：…」 |
  | L2 gh 恰好 100 条 | `exit=1` 报「GitHub open 告警 100 个」（**不标已截断**） | `exit=1` 且标注「⚠ GitHub open 告警 ≥100，未翻页，按违规处理」 |
  | L5 audit 报 0 漏洞但退出码 1 | **`exit=0`**（报「漏洞 0 个」） | `exit=2`「npm audit（server）报 0 漏洞但退出码是 1，输出与状态互相矛盾」 |
- **「故意改坏自测会红」证据**：把修复版里 H1 的同版本比对整段删掉 → `跑了 25 项，通过 24，失败 1，需联网但联网失败 0`（退出 1，`❌ H1 …违规 2 项`——只剩 install script 与通用断言命中）→ 已用备份还原，`diff -q` 与 25/25 那版**逐字节一致**，`TEMP-BREAK` 标记 0 处。
- **覆盖范围**：R1–R9（原 9 项确定性回归，改用末行解析断言、不写死包数）+ H1、H2a/H2b、H3×3、H4a/H4b、M1、M2×3、L1a/L1b、L2、L5。
- **实现要点（本轮修复的落点）**：全部四个 HIGH 都按规格落地——H1 对**每个**条目做内容断言（同版本比 resolved/integrity）；H2 `resolved` 与 name/version 绑定（不匹配 = 违规，解析不了 = 2）；H3 `Object.hasOwn` + `Number.isFinite`；H4 所有 npm 调用固定 registry + 空的 user/global config + 剔除 `npm_config_*` + 受控 cwd，registry 回显。M1 catch-all 退 2、M2 包名正则白名单 + `view --json … -- <name> time`、L1 `rev-parse` 成 SHA、L2 去 `--paginate` 且 ≥100 按违规、L5 矛盾即 2。
- **文档（`docs/dependency-policy.md`）**：新增 §5「自测与威胁模型」（自测用法 + 上表的先红后绿证据 + 威胁模型 + 限制：`hasInstallScript`/`integrity` 只对诚实 npm 产出的锁有意义、不查 tarball 哈希、不覆盖 typosquatting 等）；§4 更新退出码语义（含「任何未预期异常一律 2」「audit 0 漏洞但退出码非 0 = 2」「≥100 未翻页」），写明 **H2 取「违规」**，并把 `npm_config_registry` 的旧用法替换为 `LOCK_CHECK_REGISTRY`（脚本已不认前者）。

**任务进度：** - [x] T1 修复 - [x] T2 自测 - [x] T3 文档 - [x] T4 提交（两个提交：`74096ac` 修复+文档、`3ae10ef` 自测）

**关键决策点：**
- 架构/接口变动：`scripts/lock-check.mjs` 的行为变化（退出码语义更严：更多情形落到 2）；新增 `scripts/lock-check.selftest.mjs`；无依赖/接口变化。
- 安全相关：**检查脚本自身** —— 修复的正是「报绿其实没查」四类结构性缺口 + 两个注入面（包名进 npm argv、ref 进 git argv）+ 一条配置劫持面（npm 子进程的 registry/config/cwd 隔离）。无新增网络面；`LOCK_CHECK_REGISTRY` 只被测试使用，生效值回显。认证/密钥/用户输入/SQL/文件路径：无。
- 偏离原计划：无（逐条照规格实现）。补充两条实测发现，写进文档与本次交接：① **npm 拒绝同一文件同时作 user/global config**（`double-loading config … as "global", previously loaded as "user"`）→ 用两个空文件；② 本机 `npm view` **打不到自建的极简假 registry**（在发请求前就挂起，`--loglevel=silly` 显示停在 config 之后、无 fetch）→ 自测改用**记录型 npm 桩**（既回答 `view` 又记录 argv/env/cwd），H4 的断言因此比原方案更强。
- 未解决的疑虑：
  1. `--allow` 的语义仍是「跳过冷却期」；本轮没有额外校验「放行名单里那个版本是否真的在允许集合内」——按规格未要求，如需收紧可后续加。
  2. 自测的 R1–R9 依赖真实仓库的历史提交 `d6df3c7`（需要一个「确实有变动」的 base）与真实 npm/gh 联网；若将来仓库历史被重写或长期离线，这几项会记「需联网但联网失败」或断言失败（非静默通过）。
  3. `lock-check.mjs` 仍**不下载 tarball 校验哈希**、不做签名验证（已在文档「限制」里写明）——这是刻意的范围边界。

**顺带变动：** 已按工作者写入流程第一步勾选 T1–T4 并加完成状态行；未改动全局者正文。

## [2026-09-21 15:09] 全局者 — 复审：第 2 轮安全审查发现新缺口，触发式升级由全局者直接修复；lock-check 收尾

**背景：** 工作者 [13:01] 交接（`74096ac` 修复 + `3ae10ef` 自测，25/25）。旧条 [12:26]（第 1 次打回）已归档 `context_history.md`。

**审查动作：** 安全预检 `security-scan.sh d8b6ca2` 命中（`spawn` 等）→ 必审。全局者先亲手复核：H1/H3 反例已修好（H1 报 4 项违规退出 1；`resolved` 域名伪装 `registry.npmjs.org.evil.example` 退出 1；删掉 resolved+integrity 退出 1）；自测 25/25 自己跑了一遍；同时发现**别名条目冷却期按锁 key 查**（规格 H2 要求用 `entry.name`）。随后 `security-reviewer` 对修复做对抗式复审。
**审查结论（security-reviewer）：不可放行。** 新的 1 HIGH：`NODE_ENV=production` 时 `--audit` 漏掉 devDependencies 的漏洞仍退出 0；5 MEDIUM：M-1 别名查错包、M-2 无 resolved/integrity 的条目所有断言被跳过、M-3 空锁 `--audit` 报 0、M-4 包名正则放行 `.`/`..`、M-5 npm 沿父目录找 `.npmrc`（`TMPDIR` 被劫持时作用域 registry 生效）；LOW：L-a `GIT_*` 未剔除、L-b `--root` 子目录 base 读错、L-c `--min-age-days ""` 变 0、L-d 版本串 `created`、L-e 字段类型/格式、L-f `GH_HOST`、L-g 非官方源无提示。审查者自己也承认：第 1 轮已修的 H1–H3、M1、M2、L1、L2、L5 均**复现确认落地**。

**决策（触发式升级）：** 这是该模块**第 2 次被打回**，按 WORKFLOW 由全局者**直接实现**，未再回工作者。理由：缺口都是「小而具体」（每条 1–10 行），来回一轮的沟通成本高于直接改。

**已改（脚本 `scripts/lock-check.mjs`、自测、文档 `docs/dependency-policy.md`）：**
- 环境隔离：`cleanEnv` 剔除 `NODE_ENV`、`GIT_*`、`GH_HOST`/`GH_REPO`；npm 调用加 `--prefix=<自己的空目录>` 与 `--include=dev`；`gh` 加 `--hostname github.com`；`git show` 用 `<sha>:./<dir>/…`（相对 `--root`）。
- 条目断言：别名条目用 `entry.name`（绑定、冷却期、`--allow` 一致，输出标注锁 key）；无 `resolved` 的条目只允许 `inBundle`/`link`；`integrity` 需 `sha…-` 前缀；`version` 必须为字符串、`hasInstallScript` 只能缺省或 `true`；冷却期查询的版本串必须是 semver；包名正则首字符不许 `.`/`_`。
- `--audit`：空锁/残缺锁（无 `packages`、声明了依赖却无条目、npm 报 0 依赖但锁有条目）= 算不出。
- 其它：`--min-age-days ""`/非数字 = 算不出；输出回显冷却期阈值；非官方 registry 加醒目提示。
- 自测：25 → **47 项**（新增 22 例：H-A、M-1、M-2、M-3×2、M-4×3、M-5×2、L-a、L-b、L-c×2、L-d×2、H3b、L-e×3、L-f、L-g）；H3 三个用例的期望改为「退出 2 且无 NaN/违规 0」（现在 semver 校验先拦下）。

**验证（已核实）：** ① 47/47 全绿；② 同一套用例拿 `74096ac` 版跑：**26/47，新增的 21 项全红**，各缺口在旧版上的真实表现（报绿退出 0 或错误语义）逐条保存在自测输出里；③ 用真实 npm 单独复现三条最要紧的：`NODE_ENV=production`（旧 0 漏洞退出 0 → 新 2 个 critical 退出 1）、`TMPDIR` 劫持（旧命中假 registry 退出 0 → 新 0 次命中退出 2）、`..` 包名（旧退出 0 → 新退出 2）；④ 真实仓库 `--diff HEAD`（659 个条目）0 违规、退出 0，说明新规则对真实锁不误报。
**过程中的错误（如实）：** 我第一次改完自测跑出 9 项红——是我新加的辅助函数 `label` 与 `runDiff` 里已有的局部变量重名（暂时性死区），自测抓到了，改名 `describeItem` 后 47/47。

**未验证：** 第 2 轮修复**没有再经独立复审**（见「当前状态」的校准要求）；`--userconfig` 空文件 / `--prefix` 在别的 npm 版本上的行为只在本机 npm 10.9.8 上验证过。
**关键决策点：** 安全相关——检查脚本自身；升级判定：已按触发式升级由全局者实现。
