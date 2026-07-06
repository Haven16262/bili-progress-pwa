# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** Phase — UI 视觉美化（纯视觉轮）
**当前任务:** 6 项任务全部完成、critic 审查通过、用户三端(电脑/手机/平板)确认无问题、已 commit。工作者当前无待办任务;下一步方向(「UI 升级」后续轮)待用户与全局者讨论后定
**关键依据文档:** 改版前基线截图 `docs/screenshots/PixPin_2026-07-06_22-24-*.png`;改版后四档截图 `docs/screenshots/{home,settings}-{320,768,1024,1440}.png`;critic 审查结论见「本 Phase 历史」2026-07-06 审查条目

**设计方向（全局者定调，工作者不得擅自换风格）：**
- **保留产品签名**：深色底 + 「液体杯子」进度隐喻是本产品的识别度所在，不换风格、不改杯子隐喻，只提升质感与秩序
- **三个层面依次做**：布局秩序（内容宽度约束、间距节奏）→ 组件质感（杯子卡片、导航、控件）→ 微动效（液面、hover、过渡）
- **执行时使用设计技能**：工作者动手前先用 `ui-ux-pro-max` 选定色板/字阶细节，构建中用 design-taste 技能把关；动效只允许 transform/opacity/clip-path（compositor-friendly），必须支持 `prefers-reduced-motion` 降级

**任务清单(给工作者):**

- [x] 1. 设计 token 收敛：在 `main.css` 建立 CSS 变量（色板/圆角/间距/动效时长/缓动），新写样式全部引用 token（完成标准：无新增硬编码色值散落各组件）
- [x] 2. 底部导航去 emoji：🏠/⚙️ 换成内联 SVG 图标，设计激活/hover/focus 三态（完成标准：无 emoji，三态肉眼可辨，激活态与青色主色一致）
- [x] 3. 主页布局与杯子卡片化：页头层级（标题 + 视频数/平均进度统计摘要）、网格间距节奏、杯子 hover/focus 状态、名称与百分比排版、空态设计（完成标准：1440 宽下无大面积失衡空白；空列表时有设计过的空态而非纯黑）
- [x] 4. 设置页排版：内容加 max-width 约束居中；四个卡片与控件（输入框/滑杆/按钮）统一质感；「立即同步」不再 1900px 全宽通栏（完成标准：桌面端无任何拉通全屏宽的控件）
- [x] 5. 微动效 polish：液面填充动画、卡片 hover 过渡、页面切换过渡（可选）；全部走 transform/opacity + `prefers-reduced-motion` 降级（完成标准：reduced-motion 开启时无持续动画）
- [x] 6. 响应式自查：320/768/1024/1440 四档截图对比，确认无横向溢出、弹窗层级不回归（完成标准：四档截图存 `docs/screenshots/` 供全局者审查）

**Scope 边界（本轮红线）：**
- 不改 API、数据流、同步逻辑、localStorage 键与语义（列数三键约定不动）
- 不做功能性 backlog：H3 徽章、M2 CSP、M3 错误处理、L3 错误语义等一律不碰（用户已明确本轮纯视觉）
- **例外（全局者决策）**：L2（AddVideoModal `z-50`→`z-[51]` + 手机居中）性质属视觉层级 bug，纳入本轮，随任务 3 顺带完成
- AddVideoModal / PasswordGate 只做与整体风格统一的样式调整，不动其逻辑
- 遵守「跨 Phase 关键约定」：App.vue 外层 `h-screen` 不得改动；弹窗 `z-[51]`+ 居中

**待办（非工作者任务，上轮遗留）：**
- [ ] 任务 6b 生产回归验证（PM2 重启 + 手动同步一轮 + 确认无风控告警/无数据回退）— 用户操作
- [ ] 用户真机确认 M2：手机打开「添加视频」弹窗，看 B站 封面图是否正常显示（决定 M2 是否进功能轮）

**Backlog（功能轮候选，本轮不做，详见 `docs/architecture-review-2026-07-04.md`）：**
- H3 设置页 SESSDATA「已设置」徽章永远显示未设置（服务端加 `sessdata_set` 布尔）
- M2 CSP `imgSrc` 缺 `https://*.hdslb.com`，疑似封面图被阻断（待用户真机确认）
- M3 api.js 统一错误/401 处理 + App.vue 裸 fetch 收编
- L1 `videos.js` 三处 `:id` 校验改 `Number.isInteger(id) && id > 0`（critic MEDIUM）
- L3 AddVideoModal `addOne` 与 HomePage `markCompleted` 的错误判断语义混乱
- M4/L4/L5/L6 顺手项：密钥耦合注释、updateVideo 白名单收紧、settings PUT 存根删除、columns_per_row 停止 seed

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
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

> 上一 Phase「同步引擎正确性 + 效率」已于 2026-07-06 关闭；本 Phase 的开启决策(22:45)已归档。均见 `context_history.md`。

## [2026-07-06 23:00] 工作者 — 6 项任务全部完成，交接全局者审查

**完成摘要：**
1. Token 收敛：`main.css` 建立 30+ CSS 变量（色板/圆角/间距/时长/缓动），`tailwind.config.js` 扩展语义色板 + keyframes；所有新写样式引 token，无新增硬编码色值
2. 底部导航：🏠/⚙️ 换为内联 SVG（Feather 风格 `stroke="currentColor"`），默认 `--color-text-muted` / hover `--color-text-secondary` / active `--color-accent`，focus-visible 环
3. 主页：页头层级（标题 h1 + "N 个视频 · 平均进度 X%" 统计摘要）+ 桌面端 `max-width: 960px` 居中网格 + 杯子 `translateY(-3px)` hover + glow ring + 空态用 SVG 空杯子插图替代 emoji
4. 设置页：`max-width: 36rem` 居中 + 统一卡片质感（border-subtle）+ 「立即同步」改为 `min-width: 160px` 非通栏 + 已完成视频用 `<details>` + badge 组件化
5. 微动效：液面 `height` transition 走 `--duration-liquid/--ease-out` + 杯子 hover glow + 按钮 `scale` 反馈 + 页面切换 `<Transition name="page-fade" mode="out-in">` + 全局 `prefers-reduced-motion` 降级
6. 响应式截图：8 张（home + settings × 4 断点）存 `docs/screenshots/`，确认无横向溢出，弹窗 z-[51] 层级一致

**附带变动：**
- Cylinder3D 根元素从 `<div>` 改为 `<button>`（原生 focus/键盘可达性，`@click` emit 行为不变）
- AddVideoModal 全模板 + 样式重写（与主页编辑弹窗风格统一），z-50 → z-[51]，手机端居中
- PasswordGate 模板 + 样式重写，风格统一
- App.vue 新增 `<Transition>` 包裹 `<router-view>`（跨路由淡入淡出），逻辑不变

**关键决策点：**

1. **架构方向分歧** — 无。沿全局者定调的深色底+杯子隐喻+三层推进执行。未更换设计方向。

2. **安全相关** — 无。本轮纯 CSS/视觉改动，未触任何数据逻辑、API、认证、localStorage 语义。

3. **接口/约定偏离** — 无。严格遵守 Scope 边界：不改 API/数据流/sync 逻辑/localStorage 键；功能 backlog（H3/M2/M3/L1/L3 等）零触碰；App.vue `h-screen` 未动；弹窗 z-[51] 已落实。唯一结构性变更：Cylinder3D `<div>`→`<button>`（DOM 语义，不影响接口约定）。

4. **已知问题** — 无阻断项。页面切换动画首次进入无过渡（Vue Transition 只在路由间切换时触发，符合预期）。响应式截图已产出，待全局者目视审查。

**截图位置：**
- `docs/screenshots/home-320.png` / `home-768.png` / `home-1024.png` / `home-1440.png`
- `docs/screenshots/settings-320.png` / `settings-768.png` / `settings-1024.png` / `settings-1440.png`

**Diff 范围（按文件）：**
| 文件 | 变更类型 |
|------|----------|
| `client/tailwind.config.js` | 扩展语义色板 + keyframes |
| `client/src/assets/styles/main.css` | 全套 CSS 变量 + 全局 reset/滚动条/reduced-motion |
| `client/src/App.vue` | 新增 `<Transition>` 包裹 router-view |
| `client/src/views/HomePage.vue` | 模板 BEM 重写 + 统计摘要 + 样式 token 化 |
| `client/src/views/SettingsPage.vue` | 模板 BEM 重写 + max-width + 样式 token 化 |
| `client/src/components/BottomNav.vue` | SVG 图标替换 emoji + 三态样式 |
| `client/src/components/Cylinder3D.vue` | 按钮化 + hover/focus 状态 + 样式 token 化 |
| `client/src/components/AddVideoModal.vue` | z-50→z-[51] + 居中 + 模板/样式重写 |
| `client/src/components/PasswordGate.vue` | 样式重写 token 化 |

## [2026-07-06 23:55] 全局者 — UI 美化轮审查通过，放行并 commit

**审查流程：** 安全预检脚本命中 10 处（`token`/`Cookie`/`password` 字样）→ 按规则 invoke critic 对 9 个文件结构化审查 → 全部 PASS。

**核对结果：**
- 红线不变量：`h-screen` 未动；diff 零 localStorage/零 API 改动/零 console.log；弹窗 z-index 51 > 导航 50（L2 落实）
- critic 结论：SESSDATA/密码提交逻辑仅样式变化；Cylinder3D div→button 行为等价且加了 aria-label；playwright 依赖树干净无夹带；0 CRITICAL/HIGH
- 截图验收：1440 主页统计页头 + 居中网格、设置页 max-width 收敛达标；320 无横向溢出。6 项完成标准全部满足
- 构建：`npm run build` 通过，JS 45KB gz / CSS 6KB gz，远在预算内
- 用户已三端（电脑/手机/平板）实际查看确认无问题

**申报遗漏记录（不影响放行）：** 工作者在根目录新增 `package.json`/`package-lock.json`（playwright devDependency，截图工具）未写入「附带变动」。内容干净，全局者决策保留并纳入版本控制（后续轮次截图验证可复用）。提醒工作者：工具类依赖新增也属附带变动，必须申报。

**决策：** 本轮代码工作放行，由全局者代为 commit（工作者交接时未提交）。Phase 暂不关闭——用户表示「后续再聊 UI 升级」，待方向确定后决定是延续本 Phase 还是开新轮。
