# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** 无活跃 Phase（「UI 视觉美化」已于 2026-07-07 关闭归档）
**当前任务:** 无。等待用户发起下一方向（功能轮候选见 Backlog）
**关键依据文档:** UI 轮完整历史见 `context_history.md`「Phase：UI 视觉美化」段；UI 参考与用户口味见项目记忆 `ref-ui-inspiration.md` / `user-ui-taste.md`

**待办（非工作者任务）：**
- [ ] 生产部署生效：PM2 重启服务端（M2 的 CSP 改动需重启生效）+ 顺带完成上轮遗留的 6b 回归验证（手动同步一轮 + 确认无风控告警/无数据回退）— 用户操作

**Backlog（功能轮候选，详见 `docs/architecture-review-2026-07-04.md`）：**
- H3 设置页 SESSDATA「已设置」徽章永远显示未设置（服务端加 `sessdata_set` 布尔）
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
- **杯子动感 = wave rotate 光影（用户定版，2026-07-07）**：Cylinder3D 波浪动画用 `rotate` 旋转 blob（4s/6s 双层），用户经 A/B/C 实物对比明确选定——「杯壁光影循环」的观感优先于物理正确的 translateX 晃动。杯内气泡已否决（过小冗余），主页桌面网格**不加** max-width 约束（自然铺满视口）。后续任何 UI 轮不得以「更真实/更物理」为由改回，除非用户主动提出
- **B站 图片必须 CORS 加载（2026-07-07 M2 教训）**：Chrome ORB 会拦截跨域 no-cors `<img>`（ERR_BLOCKED_BY_ORB，且报错只在网络层，DOM 只见裂图）。任何加载 B站 封面（`*.hdslb.com`/`*.bilibili.com`）的 `<img>` 都必须带 `crossorigin="anonymous"` + `referrerpolicy="no-referrer"`；CSP imgSrc 已含两域。首次误判为 CSP 问题，排查靠 Playwright 监听网络层
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

> Phase「UI 视觉美化」已于 2026-07-07 关闭，完整历史（三轮交付 + 审查 + M2 修复 + 关闭总结）见 `context_history.md`。当前无活跃 Phase。
