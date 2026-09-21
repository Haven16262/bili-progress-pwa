# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 无进行中 Phase。前序两个插入任务均已闭环：「每日同步 412 冻结」（已发布）与「补全删除功能」（审查通过，`bac5b29` + docs `6824adb`/`3b0dff6` 本地待用户 `! git push origin master`；前端已在线）。本轮新插入任务：「100% 视频庆祝动效 + 归档 3→7 天」（2026-09-21 用户提出，本轮全局者与用户经 /design 画布定稿）。
**当前任务:** 两件事，**先 A 后 B，分两个提交**：**A. 归档天数 3→7**（`sync.js` 两处 `>= 3` 提成命名常量 + 设置页文案 + 测试 + CHANGELOG）；**B. 首页 100% 杯子的庆祝动效**（用户选定「A+C · 蓝紫→兰紫渐变」：数字淡紫色泽 + 紫光扫过 + 杯外紫色光环/亮弧；每视频每设备首次播 ~3 秒，之后静态，悬停重放；含手动「标记为已看完」触发；设置页不做）。
**关键依据文档（先读这份，内含全部规格、数值来源、验证清单）:** `plans/009-celebrate-100.md`。设计稿：画布 https://claude.ai/artifact/PMe8GF4r6JVmM4dmKwMXig 第 ② 块，源已入库 `plans/celebrate-100/reference-A+C-gradient.dc.html`（CSS 数值以它为准；**注意计划里列出的三处需偏离参考稿或需实测的地方**：数字底色渐变必须提亮（已实算 `#ddd6fe`/`#f5d0fe` 对中部液体仅 2.62/2.65 <3:1）、参考稿是 6s 循环需压成 3s 一次、光环 200×300 可能被手机横滚容器裁切）。

**用户已定的产品决策（不要重新讨论，详见 plan 009 顶部）:**
1. 基调 A+C，配色只在蓝紫/紫/兰紫之间；**彩虹与白光均被用户明确否决**（彩虹与紫色玻璃液体违和；白光单调）。
2. 触发 = `progress >= 100`（不四舍五入，与归档判据同一条）且未归档，含手动标记完成；设置页不做。
3. 每视频每设备只播一次（localStorage），之后静态终态，悬停重放；reduced-motion 下不播不重放、只留静态终态。
4. 100% 视频首页保留 **7 个日历日**后归档（原 3 天）。库里当前无正在计数的 100% 视频（2026-09-21 只读查询），无需迁移。

**任务清单(给工作者):**
- [ ] **T1 归档天数 3→7（plan 009 Part A）**：`server/src/services/sync.js` 两处 `newCount >= 3`（自然路径与 5b 手动完成路径）改用同一个命名常量；`SettingsPage.vue` 第 113 行文案改 7；更新 `sync.test.js` 里依赖阈值 3 的旧用例并**新增**「第 6 次不归档、第 7 次归档」边界用例（两条路径各一，且**先确认阈值仍为 3 时新用例会红**）；`CHANGELOG.md` 记一条。（完成标准：`server` 干净 shell（`env -i`）全绿；单独一个提交）
- [ ] **T2 庆祝动效（plan 009 Part B）**：`Cylinder3D.vue` + `HomePage.vue` + 新 `client/src/utils/celebrated.js` + `main.css` token（+ `tailwind.config.js` 同步）。（完成标准：plan 009「验证」一节 8 项全过；数字对比度按计划里的判据**实算**并把数字写进交接；单独一个提交）
- [ ] **T3 端到端验证与截图**：按 plan 009「验证」用**假 bvid**（`BV_TEST_CEL_*`）建测试视频，Playwright 跑 8 项；320/375/768/1440 截图存 `/tmp`，路径写进交接；测完清测试视频与 localStorage，库行数回到测试前。（完成标准：交接块写明每项结果 + 库行数前后一致）
- [ ] **T4 构建上线时机**：**先在 vite dev 验证，复审通过后再 `npm run build`**（`client/dist` 即生产，构建=上线；上一轮是复审前就上线了）。若确需先构建，交接里事先申明。**不 push**（守卫硬拒）。

**未验证的前提:**（2026-09-21 本轮）
- **判断，未实测**：现有 `.progress-text` 的 `font-size: clamp(12px, 16%, 18px)` 中 `16%` 相对父元素字号 → 实算 12px（全局者读 CSS 推得）。设计稿因此按「普通杯 12px / 庆祝态 20px」呈现（我曾误按 18px 画，已在画布上纠正为 12px）。**T2 第一步先量出真实值**；若不是 12px，停下告诉全局者。
- **判断，未渲染**：手机端 `.home-grid-scroll`（`overflow-x:auto`）会把 200×300 的光环裁成硬边或撑出横向滚动。
- **判断**：亮弧依赖 `@property --ang`，旧浏览器只会闪一下不旋转，可接受降级；须确认静态态弧的 `opacity` 为 0。
- **未实测**：设计稿在画布里的渲染我按设计类型规则**没有截图核对**；「看着对不对」最终以用户在真机/浏览器的肉眼为准。
- **已核实**：数字底色对比度表（plan 009 内，全局者 2026-09-21 用 WCAG 相对亮度公式实算）；库里当前无 100% 视频（同日只读查询）。

**backlog（下次开 Phase 顺手项，非紧急）:**
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

## [2026-09-21 08:43] 工作者 — 删除功能：实现 + 测试 + 端到端验证完成

**完成情况：**
- **T1 后端测试**：新增 `server/tests/videos-delete.test.js` —— 真实路由测试（挂生产 `videos` router 含 `requireAuth`，token 由 `signToken()` 用 `vitest.config.js` 注入的测试 JWT_SECRET 签发，用 Node 内置 fetch 打临时监听端口；未引入 supertest 等新依赖）。7 例：删除成功 200 且行从 `listVideos()`/`listCompletedVideos()` 双消失；不存在 id → 404 且不影响其它行；非法 id（0/-1/1.5/abc）→ 400 且不删任何行；无 token → 401 且行仍在。`sync.test.js` 新增 1 例「已删除的 bvid 在 B站 历史窗口里 → runSync 后库里仍无该行」（同时断言 updated=0、fetchVideoPages 未被调用、消息「同步完成：更新 0 个视频」）。**红验证**：临时给 `sync.js` 注入「未知 bvid 就 INSERT 后 continue」缺陷 → 该例变红（失败点正是「库里仍无该行」断言）→ 还原，`git diff -- server/src/services/sync.js` 为空。干净 shell（`env -i PATH=/usr/bin:/bin HOME=/root`）**44 例全绿**（原 36 + 新 8）。
- **T2 首页删除按钮**：`HomePage.vue` 弹窗底部加全宽红底「删除」（在「标记为已看完」下方，`margin-top: 1rem` 拉开间距；实心色无 backdrop-filter，故无 `@supports` 回退）。`window.confirm` 一次 → `api.deleteVideo(id)`；成功或 404 → 本地数组移除 + 关弹窗；其它失败 → `window.alert(e.message || '删除失败，请重试')` 且弹窗保持；请求在途 `:disabled`。保留 focus-visible accent outline 与 hover/active 反馈。
- **T3 设置页删除**：`SettingsPage.vue` 已看完列表每行右侧加紧凑红底胶囊「删除」（与相邻 badge 同高 11px）；名称保持 ellipsis（`.settings-details__name` 补 `flex: 1`）；行为同 T2，在途按行禁用（`deletingIds` Set）。
- **颜色 token**：`main.css` `:root` 新增 `--color-danger-solid: #dc2626`（白字 4.83:1 ≥ AA）与 `--color-danger-solid-hover: #b91c1c`（6.47:1），`tailwind.config.js` 的 `feedback` 同步两键；原 `--color-danger` 注释补「白字压其上仅 3.76:1，不可当实心按钮底」。（对比度按「当前视觉语言」约定的声明色静态模型算。）
- **共用文案**：新增 `client/src/utils/videoDelete.js` 的 `confirmVideoDelete(video)`，文案 = 首行「确定要删除「<custom_name 或 title>」吗？」+ 空行 + 「此操作不可恢复，本地重命名、置顶状态与「已看完」标记也会一并丢失。」；两个入口共用同一份，防文案漂移。
- **T4 端到端验证**：脚本 `/tmp/bili-verify/bili-verify-delete.mjs`（Playwright，**未进仓库**）。前端走 vite dev（`localhost:5173`，其 `/api` 代理指向生产 `127.0.0.1:3000`）→ 真实 Express + requireAuth + JWT + SQLite。**连续 3 轮 34/34 全过**。覆盖：首页取消（视频仍在、弹窗保持）／确认（弹窗关闭、卡片立即消失、刷新后仍不在、服务端行已消失）／失败（拦截 DELETE→500：alert 出现、弹窗保持、视频仍在）／在途禁用（DELETE 延迟 900ms 实测，两入口各 1 例）／设置页 375 与 320 宽无横向溢出（html 与行元素 scrollWidth 实测；截图 `/tmp/bili-verify-shots/02-settings-375.png`、`02-settings-320.png`）／设置页取消·确认·刷新持久·首页对应卡片同步消失／404 路径（另一端先真删 → UI 不再弹 alert、关弹窗、卡片消失）／无未捕获页面错误。测试数据只有假 bvid `BV_TEST_DEL_0921A/B/C`，**未对 11 条真实记录做任何写操作**（前后两列表 bvid 集合逐条一致）。
- **T5 收尾**：`CHANGELOG.md` 加 `## [1.2.0] — 2026-09-21`（Added 三条，沿用版本段风格）；`npm run build` 绿（dist/assets/index-CwKkmMT3.js + index-NzTtxpY7.css）；commit `bac5b29`（8 文件，271+/2−，只带自辖路径，`context.md` 未提交）；**未 push**。
- **库核对（只读）**：总行数 **11**（首页 9 + 已看完 3，重叠 1；已归档 2），`BV_TEST_DEL_0921%` 残留 0。

**任务进度：**
- [x] T1 后端测试补齐
- [x] T2 首页删除按钮
- [x] T3 设置页删除
- [x] T4 端到端验证
- [x] T5 收尾

**关键决策点：**
- 架构/接口变动：**后端零改动**（复用既有 `DELETE /api/videos/:id`）。前端新增模块 `client/src/utils/videoDelete.js`；新增 2 个 CSS token 并同步 `tailwind.config.js`。
- 安全相关：**用户输入** —— 本轮唯一新增输入面是 URL 里的 `:id`，后端校验逐字未改（400/404/200 语义不变），已由 T1 真实路由测试覆盖（含 0/-1/1.5/abc 与无 token）。**外部请求**：无新增（未碰 B站 相关代码）。认证/密钥/SQL/文件路径：无。前端新增内容全部是模板插值与静态样式，无 innerHTML/动态 HTML 注入。
- 偏离原计划：① 抽出 `utils/videoDelete.js` 供两入口共用（原决策只要求「每个入口只弹一次确认」，未指定文案实现是否共用——我判断共用才能保证两处文案逐字一致）；② T5 构建使前端上线（见下疑虑 1）。其余无偏离。
- 未解决的疑虑：
  1. **`npm run build` 等于前端上线**：`client/dist` 正是 PM2 所服务的静态目录，所以 T5 的构建动作已把本轮前端投放到生产（curl 验证：生产 3000 的 index.html 已引用新哈希资源，新 CSS 含 `danger-solid`）。「无需 pm2 restart」的依据 = `server/src/index.js` 的 `express.static(distPath)` 按请求读盘，属**判断**，未重启验证；先例依据 = 2026-09-03 轮（`client/dist` 上次构建时间即该轮 12:08）。若全局者认为未过审不应先构建，请审查时提出。
  2. 失败路径的 500 由 Playwright 路由伪造，未制造真实后端 500；真实 500 走同一段 catch，判断风险低。
  3. `page_cache` 删除后留孤行仍未实测（沿用「未验证的前提」，本轮未清）。
  4. **「本 Phase 历史」现有 3 条**（[09-11 工作者]、[09-21 09:05 全局者]、本条），超出「只留最近 1 对」；[09-11 工作者] 条在 `context_history.md` 已有归档。归档按 WORKFLOW 属全局者职责，我未擅自处理，仅此标注。
  5. 时间戳注记：本机时钟现为 2026-09-21 08:43 UTC，而上一轮全局者条目标注 09:05（晚于本机当前时间；`context.md` mtime 为 08:34）。本块按实际时间记录，若上条时间有误由全局者订正。

**顺带变动：** 按工作者写入流程第一步，已在「当前状态」把 T1–T5 勾为完成并加一行「工作者完成状态」；全局者的决策内容（已定细节、未验证的前提、backlog）一字未动。

## [2026-09-21 10:39] 全局者 — 定稿：100% 视频庆祝动效（A+C 紫光）+ 归档 3→7 天

**背景：** 用户（2026-09-21）要为首页「进度 100% 且未归档」的视频加特殊动效，灵感来自 Claude Code 的 ultracode 模式；并把 100% 视频的首页保留期改为 7 天。全局者先给出「动效放哪 / 怎么贴合 UI / 持续多久」三问的分析，用户逐条拍板后，经 /design 画布出方案，两轮迭代收敛：第一轮彩虹 → 用户指出「ultracode 不是彩虹、且彩虹与紫色玻璃液体违和」→ 改紫色系；用户选 A+C 为基调 → 指出白光单调 → 出「① 单色亮紫」「② 蓝紫→兰紫渐变」两版 → **用户选 ②**。

**决策：** 见「当前状态」与 `plans/009-celebrate-100.md`（规格、数值来源、验证清单全在里面）。要点：只播一次（每视频每设备，localStorage）、reduced-motion 留静态终态、含手动完成触发、设置页不做、7 日历日归档、构建上线放复审后。

**全局者自查并纠正的两处（如实记录）：**
1. 画布里我最初把杯内数字画成 18px，而真实代码 `clamp(12px,16%,18px)` 实算约 12px（判断，未实测）——已在画布上把普通杯纠正为 12px，庆祝态保持用户看过的 20px。这意味着**庆祝态数字比其它杯子明显大**，是设计上的有意强调，已写入计划。
2. 计划初稿里我写「淡紫底色对比度可能贴线」是估算；随后**实算**：`#ddd6fe`/`#f5d0fe` 对中部液体色仅 2.62/2.65，**不达标**，参考稿里的这两个停点必须提亮（写入计划，含完整数值表）。用户看过的「淡紫色泽」数字在实现里会**略偏白**——这是可读性的代价，若用户觉得太白，回来商量的方向是加强扫光带/柔光/光环，不是再压暗数字。

**移交工作者：** T1（归档 7 天，先做）→ T2（动效）→ T3（验证截图）→ T4（构建时机）。交接块请含：真实数字字号、每个底色停点的实算对比度、光环在手机横滚容器里是否被裁、8 项验证结果、截图路径。
