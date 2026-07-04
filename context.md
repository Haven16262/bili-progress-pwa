# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** Phase — 同步引擎正确性 + 效率
**当前任务:** 修复归档倒计时语义 bug、全量翻爬风控风险、单P负缓存、并发锁；核心算法先补测试（TDD）
**关键依据文档:** `docs/architecture-review-2026-07-04.md`（问题编号 H1/H2/M1/M5/M6 对应本轮）

**任务清单(给工作者):**

- [ ] 1. 测试打底（M6 核心部分）：server 引入 vitest；为 `computeGlobalProgress` / `computeEpisodeProgress` 写单测（多P正常、cid 不在 pages、totalDuration=0、单P回退）；为归档计数逻辑写测试（用内存 SQLite，构造同日两次 / 跨日两次场景）——任务 2 的新行为测试必须先写并先 FAIL（完成标准：`npm test` 全绿，且任务 2 实现前相关测试确实先失败过）
- [ ] 2. H1 归档按日历日计数：同一天内多次 `runSync` 对同一视频只递增一次 `progress_100_count`（含 4b 手动完成分支）。方案：`videos` 表加 `progress_100_date TEXT` 列记录最近递增日期，递增前比对当天日期，旧库迁移仿照 `manually_completed` 的 ALTER TABLE 模式（完成标准：同日连跑两次 runSync count 只 +1；跨日再跑 +1；测试覆盖）
- [ ] 3. H2 `fetchAllHistory` 改造三件套：① 本地追踪的 bvid 全部命中后提前终止翻页（需把 localBvids 传入或改为回调判断）② 页数硬上限 50 页 ③ 页间 250ms 延时（完成标准：追踪视频全部命中时不再继续翻页；上限与延时有常量命名）
- [ ] 4. M5 同步并发锁：`sync.js` 模块级布尔锁，`runSync` 进行中时再次调用直接返回；`POST /api/sync` 对此返回 409 `{ error: '同步进行中，请稍候' }`（完成标准：并发第二次调用不执行任何 DB 写入）
- [ ] 5. M1 单P负缓存：`page_cache` 允许记录 `page_count<=1` 的条目，`getPagesInfo` 命中即返回 null 语义，7 天内不再对单P视频请求 view API（完成标准：连续两次 runSync，第二次对单P视频零 view 请求——可用日志或测试桩验证）
- [ ] 6. 回归验证：client 无改动不用 build；PM2 重启、手动触发同步一轮成功、首页数据无回退。**遵守测试纪律：不拿真实业务记录当靶子，测试库用内存/临时文件**

**Scope 边界：** 本轮不动前端（H3/M2/M3 留下一轮）；不做 M4 密钥解耦；不改归档「软隐藏」机制。

**待办（非工作者任务）：**
- [ ] 架构评审文档 + context 归档变更未 commit（建议 `chore: 架构评审 + Phase 开启归档`，可由工作者随本轮一起提）
- [ ] 用户真机确认 M2：手机打开「添加视频」弹窗，看 B站 封面图是否正常显示（决定 M2 是否进下一轮）

**Backlog（下轮「前端体验轮」候选，详见评审文档）：**
- H3 设置页 SESSDATA「已设置」徽章永远显示未设置（服务端加 `sessdata_set` 布尔）
- M2 CSP `imgSrc` 缺 `https://*.hdslb.com`，疑似封面图被阻断（待用户真机确认）
- M3 api.js 统一错误/401 处理 + App.vue 裸 fetch 收编
- L1 `videos.js` 三处 `:id` 校验改 `Number.isInteger(id) && id > 0`（critic MEDIUM）
- L2 AddVideoModal `z-50`/手机贴边 → `z-[51]` + 居中
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

## [2026-07-04 20:10] 全局者 — Phase 启动：同步引擎正确性 + 效率

**背景：** 用户发起项目架构分析。全局者通读全部源码（~2100 行）后产出 `docs/architecture-review-2026-07-04.md`：架构分层健康、安全基线扎实，但发现 3 HIGH / 6 MEDIUM。其中 H1（归档倒计时按同步次数而非天数计，一天点 3 次「立即同步」即当天归档）为用户可感知的正确性 bug；H2（每日全量翻爬整个 B站历史，无上限无延时）为最大外部风险面（风控）。两者同在 `sync.js`，打包为一轮最省。

**决策：**
1. 本轮做 H1/H2/M1/M5 + 核心算法测试打底（M6 部分），任务清单见「当前状态」
2. 前端项（H3/M2/M3 + L1/L2/L3）留下一轮「前端体验轮」
3. 新增两条跨 Phase 约定：归档按日历日计、B站 请求节制（见上方约定区块）
4. 方向经用户确认（AskUserQuestion 选定「同步引擎轮」）

**移交工作者：** 按任务 1→6 顺序执行，任务 2 的行为变更测试先行（先 FAIL 再实现）。涉及外部请求与 DB 迁移，完成后切回全局者，将按规矩 invoke critic 审查 `sync.js` / `bilibili.js` / `init.js`。
