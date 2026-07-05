# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** Phase — 同步引擎正确性 + 效率
**当前任务:** 代码任务 2-5 已通过 critic 安全审查（无 CRITICAL/HIGH），工作者补两处收尾建议后即可 commit；任务 6 等用户做生产回归
**关键依据文档:** `docs/architecture-review-2026-07-04.md`（问题编号 H1/H2/M1/M5/M6 对应本轮）；critic 审查结论见 `context_history.md` 2026-07-05 04:05 条目

**任务清单(给工作者):**

- [x] 1. 测试打底（M6 核心部分，21 条用例全绿）
- [x] 2. H1 归档按日历日计数
- [x] 3. H2 `fetchAllHistory` 三件套（早停 + 50页上限 + 250ms延时）
- [x] 4. M5 同步并发锁 + POST 409
- [x] 5. M1 单P负缓存
- [x] 6a. **critic 收尾（本轮最后代码任务）：** ① `init.js` DB_PATH 解析处，若 `TEST_DB` 被设置且 `NODE_ENV !== 'test'`，打印一行警告日志（不阻断启动）；② `queries.js` `updateVideo()` 顶部加一行注释，说明列名拼接为何安全（白名单保护，非用户输入拼接，非注入风险）。完成标准：两处改完后 `npm test` 仍 21/21 全绿，然后可直接 commit（提交信息建议 `fix: harden TEST_DB guard + document updateVideo column allowlist`）
- [ ] 6b. 回归验证（待生产环境操作，非工作者任务）：client 无改动不用 build；PM2 重启、手动触发同步一轮成功、首页数据无回退。**遵守测试纪律：不拿真实业务记录当靶子，测试库用内存/临时文件**

**Scope 边界：** 本轮不动前端（H3/M2/M3 留下一轮）；不做 M4 密钥解耦；不改归档「软隐藏」机制。

**待办（非工作者任务）：**
- [ ] 架构评审文档 + context 归档变更未 commit（建议 `chore: 架构评审 + Phase 开启归档`，可由工作者随本轮一起提）
- [ ] 用户真机确认 M2：手机打开「添加视频」弹窗，看 B站 封面图是否正常显示（决定 M2 是否进下一轮）
- [ ] 任务 6b 生产回归验证（PM2 重启 + 手动同步一轮 + 确认无风控告警/无数据回退）

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

> 2026-07-04 20:10 ～ 2026-07-05 03:59 的 4 条记录（Phase 启动 + 任务1/2/2-5 交付）已归档至 `context_history.md`「Phase：同步引擎正确性 + 效率」段。

## [2026-07-05 04:05] 全局者 — critic 审查通过，放行 + 两处收尾

**背景：** 工作者交付任务 2-5，「安全相关」非空（SQL 迁移 + 外部请求）。安全预检脚本命中 121 处但核实全部来自 `server/package-lock.json`（新增 vitest 依赖锁文件的 `https://` URL 行），源码本身零命中。按规则仍 invoke critic 子代理，对 `sync.js`/`bilibili.js`/`init.js`/`queries.js`/`routes/sync.js` 做结构化审查。

**critic 审查结论：可放行，无 CRITICAL/HIGH。**
- SQL 参数化 ✓：新增查询全部走 `?` 占位符；`updateVideo()` 列名拼接受白名单保护（非注入风险，[LOW] 建议加注释）
- ALTER TABLE 迁移 ✓：列存在性检查保证幂等
- 并发锁 ✓：`syncing` 布尔在首个 `await` 之前完成检查+设置，无竞态窗口；`finally` 确保异常路径也释放锁
- 单P负缓存 ✓：`null`/`pageCount<=1` 语义链路验证无误判风险
- 风控三件套 ✓：50 页上限、250ms 延时、localBvids 全命中提前终止，均无法被绕过
- 日历日守卫 ✓：ISO 日期字符串比较，主循环与 4b 分支均正确
- [MEDIUM] `init.js`：`TEST_DB` 若在生产环境被意外设置会误连错误数据库，建议加警告日志

**决策：**
1. 任务 2-5 代码批准，`npm test` 复核 21/21 全绿
2. 工作者顺手补 critic 两处收尾建议（详见「当前状态」任务 6a），完成后可直接 commit
3. 任务 6b（生产回归）非工作者任务，等用户操作

**移交工作者：** 按任务 6a 执行两处收尾 → 测试确认 → commit。之后回全局者确认收尾完成即可关闭本轮代码工作。

## [2026-07-05 04:07] 工作者 — critic 收尾完成 + commit

**完成情况：** `init.js` 加 TEST_DB 非测试环境警告日志；`queries.js` `updateVideo()` 加列名白名单安全注释。`npm test` 21/21 全绿。已 commit `f5c18bf`。

**任务进度：**
- [x] 任务 1-5（代码实现）
- [x] 任务 6a（critic 收尾）
- [ ] 任务 6b（生产回归，非工作者任务）

**关键决策点：**
- 架构/接口变动：无
- 安全相关：无（仅注释 + 日志）
- 偏离原计划：无
- 未解决的疑虑：无

**移交全局者：** 本轮代码工作已闭环，待全局者确认后关闭 Phase。任务 6b 回归验证由用户在生产环境操作。
