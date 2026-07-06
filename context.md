# 项目上下文

> 本文件分三块。工作者只读这里；历史回溯查 `context_history.md`；规则查 `WORKFLOW.md`。
> 目标长度 ~200 行，超 300 行触发清理（详见 WORKFLOW.md「长度规则」）。

---

## 当前状态

<!-- 全局者每次写入决策时覆盖此区块；工作者启动时优先读这里 -->

**阶段:** Phase — UI 视觉美化（第二轮：杯子活化 — 已完成并放行）
**当前任务:** 全部完成。任务 6 终版（方案 C：wave-spin 回归 + 删气泡 + 桌面网格去 max-width）已审查放行并 commit（`1af2bdc`，预检零命中）。工作者当前无待办任务；Phase 待用户表态后由全局者关闭归档
**关键依据文档:** 参考收藏见项目记忆 `ref-ui-inspiration.md`；杯子特写截图 `docs/screenshots/cup-{normal,hover}.png`（light-sweep 为被否决方案 B 遗留，已删）

**设计方向（全局者定调，2026-07-06 用户授权全局者组合选择）：**
- **只借细节，不换语言**：从 Liquid Glass 潮流只借「杯子本体」的玻璃质感；从喝水类 App 借「液面波动 + 杯内气泡」微细节；卡通/吉祥物风格、整体玻璃化一概不采用
- **效果标准是 subtle**：静止时一眼看仍是原来的杯子，动起来才注意到差别。宁可不够炫，不可过度
- **实现红线**：动画只允许 transform/opacity；禁用 `backdrop-filter`、`feDisplacementMap`、gooey blur+contrast 滤镜（手机端开销大）；不新增任何依赖

**任务清单(给工作者):**

- [x] 1. 分级色收进 token：`Cylinder3D.vue` 里 `liquidColor` 四级八个硬编码 hex 挪到 `main.css` token（完成标准：组件内无硬编码色值；四级分级逻辑与视觉不变）
- [x] 2. 液面波动：~~translateX 双层波浪~~ → **用户选方案 C：回退到原始 wave-spin (rotate)**，周期 4s/6s，比 translateX 更有「杯壁光影循环」的动感。meniscus 亮线保留
- [x] 3. ~~杯内气泡~~ → **用户决定删除**：气泡过小、观感冗余，已从模板/script/CSS 完全移除
- [x] 4. 玻璃质感微升级：杯口 rim 高光 + 液面顶部 meniscus 亮线，纯 CSS 渐变实现（完成标准：不使用任何 filter/backdrop-filter；静态截图对比第一轮有可感知但不突兀的质感提升）
- [x] 5. 自查交付：reduced-motion 开关两种状态验证 + 构建体积对比（完成标准：JS+CSS gzip 增幅 < 5KB）+ 杯子特写截图（一张常态、一张 hover）存 `docs/screenshots/`
- [x] 6. 【补充】杯壁光影回归：~~独立玻璃光影层~~ → 经 A/B/C 三方案对比后**用户选方案 C：直接回退 wave 动画到原始 rotate**。方案 A（散点光斑旋转）观感怪、方案 B（对角亮线旋转）未选中。最终方案：wave-spin (rotate) 回归 + 气泡删除 + meniscus/rim 高光保留

**Scope 边界（本轮红线）：**
- **只允许改两个文件**：`Cylinder3D.vue` + `main.css`（token 段）。其他任何组件/页面/配置一律不碰
- 不改 Cylinder3D 的 props/emit 接口、分级色阈值(30/60/90)、液面高度计算
- 不新增依赖；不用 SVG/CSS 滤镜
- 遵守「跨 Phase 关键约定」全部条目

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
- **杯子动感 = wave rotate 光影（用户定版，2026-07-07）**：Cylinder3D 波浪动画用 `rotate` 旋转 blob（4s/6s 双层），用户经 A/B/C 实物对比明确选定——「杯壁光影循环」的观感优先于物理正确的 translateX 晃动。杯内气泡已否决（过小冗余），主页桌面网格**不加** max-width 约束（自然铺满视口）。后续任何 UI 轮不得以「更真实/更物理」为由改回，除非用户主动提出
- **测试纪律（教训）**：冒烟测试写接口不要拿真实业务记录当靶子；不得不用时，测试后必须完整恢复所有被改字段，不只是标志位
- **原生模块 ABI 迁移雷区（教训）**：`server/node_modules` 是 2026-05-22 在旧 DO 服务器（旧 Node 版本）装的，随项目一起搬到 Hetzner（06-24），但没人针对新机器的 Node 22 重新编译过。进程只有在重启那一刻才会因 `better-sqlite3` 原生插件 ABI 不匹配而崩溃（`ERR_DLOPEN_FAILED`），所以中间十天服务没重启，一直正常，直到 07-04 一次普通重启才暴露、连崩 7 次后 PM2 daemon 一并挂掉，导致 502。现已加 `server/scripts/start.sh` 自愈：启动前探测 ABI 不匹配则自动 `npm rebuild better-sqlite3` 再起服务；PM2 已切换为跑该脚本（`pm2 start scripts/start.sh --interpreter bash` + `pm2 save`），`npm start` 同步指向该脚本。以后任何原生模块迁移/Node 升级场景都有兜底。

---

## 本 Phase 历史

<!-- 工作者和全局者 append。保守规则:只留最近 1 对(latest overseer + latest worker)。新 phase 启动时整体归档到 context_history.md -->

> 第一轮（全站 polish）交付/审查记录、第二轮开启决策(00:20)均已归档至 `context_history.md`「Phase：UI 视觉美化」段。


## [2026-07-07 02:00] 工作者 — 补充任务 6 最终落地（方案 C）+ 气泡删除 + 桌面间距修复

**用户决策链：**
1. 方案 A（散点光斑）→ 透明度问题修复后面世，但观感「怪怪的」，否决
2. 方案 B（对角亮线）→ 用户未选中
3. **方案 C（wave-spin 回归）→ 用户选中**：直接回退波浪动画到原始 `rotate`（周期 4s/6s），靠旋转 blob 自带的光影效果恢复杯壁动感
4. 气泡删除：用户反馈气泡过小、观感冗余 → 模板/script/CSS 全量移除
5. 桌面端杯子间距过近：根因是 Round 1 加入的 `max-width: 960px` 在宽屏上挤压杯子 → 移除约束，回归旧方案网格自然填满视口

**最终 Cylinder3D.vue 结构：**
- 模板：`top-rim-back` → `liquid-area`（`liquid-fill` 含双层 wave(rotate) + meniscus）→ `glass-shine` → `progress-text` → `top-rim` → `hover-glow`
- Script：`liquidColor` 引用 CSS token、`liquidStyle`（height + background）
- 样式：wave-spin(rotate) + meniscus + rim 高光(offset-left radial) + glass-shine + hover-glow

**最终文件变更：**
| 文件 | 变更 |
|------|------|
| `main.css` | +11 行液体色 token（未变，同 Round 2） |
| `Cylinder3D.vue` | 模板去 bubbles/light-sweep；script 去 bubbles computed；样式 wave 回 rotate，去 bubble/light-sweep CSS |
| `HomePage.vue` | 去 `max-width: 960px` 约束 + 关联 CSS 规则（用户反馈桌面间距过近） |
| `context.md` | 交接写入手 |

**构建体积（最终）：**
CSS gzip 6.24 KB + JS gzip 45.20 KB = **51.44 KB**（比 Round 2 基线 51.76 KB 还小 0.32 KB）

**关键决策点：**

1. **架构方向分歧** — 任务 6 最初要求「新增独立玻璃光影层」（不允许回退 wave），经 A/B/C 三方案对比后用户选择方案 C（wave-spin 回归）。这不是工作者擅自改方向，是用户实物对比后的明确选择。原 translateX 波浪的「液体晃动」语义虽更准确，但 rotate blob 的「杯壁光影循环」视觉反馈更好——用户优先选了观感。

2. **安全相关** — 无。

3. **接口/约定偏离** — 任务 6 原要求「不得通过改回 wave rotate 实现」→ 用户选择推翻此约束。HomePage.vue 的 max-width 移除属本轮范围外的小修复（用户明确要求）。其余红线全部遵守。

4. **已知问题** — 无阻断项。wave-spin 的 rotate blob 严格来说仍是「旋转的不规则形状」而非物理波浪，但视觉效果已满足用户。如需未来进一步优化，方向应是「保留 rotate 动感 + 让 blob 形状更接近真实液面波动」。

## [2026-07-07 02:20] 全局者 — 任务 6 终版审查通过，第二轮全部关闭

**审查：** 预检零命中（无需 critic）；diff 核对——Cylinder3D 无 bubble/light-sweep 死代码残留、wave-spin 回归就位；HomePage diff 仅 max-width 包裹层移除，零逻辑改动；构建通过，体积 51.43KB gz（比第二轮基线更小）。代码 commit `1af2bdc`。被否决方案 B 的遗留截图 cup-light-sweep.png 已删。

**对偏离的裁定：** 任务 6「不得改回 wave rotate」约束被用户 A/B/C 实物对比推翻——用户拥有最终决定权，工作者如实申报，合规。HomePage.vue 超出两文件红线，属用户当场明确指令，合规。

**固化：** 用户三项实物决策（rotate 光影定版 / 气泡否决 / 网格不加 max-width）已写入「跨 Phase 关键约定」，防后续轮次以「更物理正确」为由回改。

**决策：** 第二轮（杯子活化）正式关闭。Phase「UI 视觉美化」整体待用户表态：满意即由全局者做 Phase 关闭归档。
