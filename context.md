# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** Phase — 功能修复轮（backlog 清理）
**当前任务:** 清理架构评审遗留的 H3/M3/L1/L3 + 顺手项 M4/L4/L5/L6。服务端行为改动全部测试打底
**关键依据文档:** `docs/architecture-review-2026-07-04.md`（各项编号的完整定义与修法）；既有测试见 `server/tests/`

**任务清单(给工作者):**

- [ ] 1. 测试打底（先红后绿）：L1 非法 id 用例（`0`/`-1`/`1.5`/`abc` → 400）+ H3 settings 响应用例（含 `sessdata_set` 布尔、**绝不含 SESSDATA 值**）（完成标准：新用例先失败，实现后全绿）
- [ ] 2. L1 校验收紧：`videos.js` 三处 `:id` 改 `Number.isInteger(id) && id > 0`，不合法返回 400（完成标准：任务 1 用例通过）
- [ ] 3. H3 徽章修复：`GET /api/settings` 返回 `sessdata_set: bool`（服务端判非空，**只回布尔不回值**）；`SettingsPage` 据此初始化徽章（完成标准：已配置时刷新页面显示「已设置」；响应体无 SESSDATA 明文）
- [ ] 4. M3 统一错误层：`api.js` 包 `request()`——非 2xx 抛结构化错误、401 清 token 并回 PasswordGate；App.vue 两处裸 fetch 收编进 api.js（完成标准：组件内无裸 fetch；token 失效后用户被引导重新登录，而非静默空列表）
- [ ] 5. L3 错误语义修正：AddVideoModal `addOne` 的 `res.ok || res.error` 与 HomePage `markCompleted` 的同类判断——失败不再当成功，且给用户可见反馈（完成标准：后端返回错误时列表不移除候选/不误标完成，界面有错误提示）
- [ ] 6. 顺手项（每项独立小改）：
  - M4【仅文档级】：`.env.example` + `crypto.js` 注释写明「轮换 JWT_SECRET 会静默毁掉 SESSDATA 解密」的耦合风险。**不改任何密钥/加密逻辑**
  - L4：`queries.updateVideo` 白名单收紧到实际使用的 `custom_name`/`pinned`
  - L5：删 `PUT /api/settings` 空存根 + 前端 `updateSettings`（删前全仓 grep 确认无调用方）
  - L6：停止 seed `columns_per_row`（保留数据库旧行）
- [ ] 7. 回归自查：`npm test` 全绿 + 手动冒烟四步（登录 → 首页加载 → 设置页徽章 → 添加视频弹窗），结果写入交接

**Scope 边界（本轮红线）：**
- **UI 视觉零改动**：遵守「跨 Phase 关键约定」全部条目（杯子动感定版、网格无 max-width、B站图片 CORS 属性等）
- **不碰同步引擎逻辑**（H1/H2/M1/M5 上上轮已定型）
- **M4 升级闸门**：若发现文档级不够、需要改 `crypto.js` 任何逻辑 → 立即停下切回全局者（密钥管理属强制升级域），不得自行实现独立 ENC_KEY
- M3 的 401 处理只清 token 相关存储，不得误清列数三键（`columns_*`）
- 错误提示遵守既有教训：面向用户的错误信息不透传后端细节
- 服务端改动合并后需 PM2 重启生效（记入交接，由全局者/用户执行）

**待办（非工作者任务）：**
- [ ] 本轮合并后：PM2 重启 + 冒烟复核（全局者可代执行，需用户确认）

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
- **杯子动感 = wave rotate 光影（用户定版，2026-07-07）**：Cylinder3D 波浪动画用 `rotate` 旋转 blob（4s/6s 双层），用户经 A/B/C 实物对比明确选定——「杯壁光影循环」的观感优先于物理正确的 translateX 晃动。杯内气泡已否决（过小冗余），主页桌面网格**不加** max-width 约束（自然铺满视口）。后续任何 UI 轮不得以「更真实/更物理」为由改回，除非用户主动提出
- **B站 图片必须 CORS 加载（2026-07-07 M2 教训）**：Chrome ORB 会拦截跨域 no-cors `<img>`（ERR_BLOCKED_BY_ORB，且报错只在网络层，DOM 只见裂图）。任何加载 B站 封面（`*.hdslb.com`/`*.bilibili.com`）的 `<img>` 都必须带 `crossorigin="anonymous"` + `referrerpolicy="no-referrer"`；CSP imgSrc 已含两域。首次误判为 CSP 问题，排查靠 Playwright 监听网络层
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

## [2026-07-07 04:50] 全局者 — Phase「功能修复轮」开启

**背景：** UI 视觉美化 Phase 已关闭归档，6b 生产回归通过，用户指示开启功能轮清 backlog。

**决策：**
1. 范围 = H3（徽章）/ M3（统一错误层）/ L1（id 校验）/ L3（错误语义）+ 顺手项 M4/L4/L5/L6，共 7 项任务，服务端行为改动测试打底先行
2. H3 接口契约由全局者定死：`GET /api/settings` 只加 `sessdata_set` 布尔，服务端判非空，任何情况不回传 SESSDATA 值
3. M4 分流裁定：密钥管理属强制升级域 → 本轮只做文档级注释；独立 `SESSDATA_ENC_KEY` 与明文自动迁移不做，将来需要时由全局者直接实现
4. L5 删存根前必须全仓 grep 确认无调用方（删除类改动的通用闸门）

**移交工作者：** 按任务 1→7 顺序执行（测试先行）。涉及认证/错误处理，完成后必过 critic。
