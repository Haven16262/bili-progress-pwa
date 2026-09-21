# 009 — 首页 100% 视频的「庆祝」动效（A+C · 蓝紫→兰紫渐变）+ 归档天数 3→7

- **Status**: DONE（实现 + 审查通过；commit `c78c2a6` Part A / `a3a462e` Part B；上线以 T5 构建完成为准）
- **Decided**: 2026-09-21（用户在 /design 画布上从两版紫光里选定第 ② 版）
- **Owner**: 工作者实现，全局者复审（非强制升级项：纯前端动效 + 一个常量改动）
- **设计稿（视觉真相）**: 画布 https://claude.ai/artifact/PMe8GF4r6JVmM4dmKwMXig 的第 ② 块；源已存仓库 `plans/celebrate-100/reference-A+C-gradient.dc.html`（**以这份文件里的 CSS 数值为准**，下面只列意图与规则）
- **约束来源**: `context.md`「跨 Phase 关键约定」——wave rotate 不动 / 杯子不加 `backdrop-filter` / blur ≤20px / reduced-motion 策略 / 液体玻璃 token 惯例

## 用户已定的产品决策（不要重新讨论）

1. **基调 = A+C**：杯内 `100%` 数字带「淡紫色泽 + 一道紫光扫过」+ 杯外一圈紫色光环（庆祝时一段亮弧绕杯一圈）。**不用彩虹、不用白光**（用户明确否决：彩虹与紫色玻璃液体违和；白光单调）。配色只在蓝紫 `rgb(129 140 248)` / 紫 `rgb(168 85 247)` / 兰紫 `rgb(232 121 249)` 之间。
2. **触发**：首页杯子 `progress >= 100`（与归档规则同一判据，**不用四舍五入**：99.6 显示 100% 但不算）且未归档（归档的本来就不在首页）。**含手动点「标记为已看完」**——弹窗关闭、杯子注满后立即庆祝。设置页「已观看完视频」列表**不需要**。
3. **播放时机**：**每个视频、每台设备只播一次**（首次看到 100% 时播 ~3 秒庆祝）；之后是**静态终态**（淡紫数字 + 淡紫光环，无常驻动画）；**鼠标悬停重放一次**（仅 `hover:hover` 精确指针设备，触屏无重放）。
4. **归档天数 3 → 7**：进度 100% 的视频在首页保留 7 个日历日后归档（用户原话「将 100% 视频持续时间改到 7 天」）。

## Part A — 归档天数 3 → 7（先做，独立、小、可单独提交）

现状（全局者 2026-09-21 读代码所得）：
- `server/src/services/sync.js` 第 193 行、第 221 行各有一处 `newCount >= 3` → `archiveVideo(...)`（前者是自然 100% 路径，后者是 5b「手动完成」路径）。**两处都要改**，只改一处会造成两类视频保留天数不一致。
- `client/src/views/SettingsPage.vue` 第 113 行文案「视频进度达 100% 持续 3 天后自动归档」。
- `server/tests/sync.test.js` 里有依赖阈值 3 的用例（约第 286 行注释「Pre-set count to 2, this 3rd tick should trigger archive」、约第 356 行「count 2」）。
- 库里当前**没有**在计数中的 100% 视频（2026-09-21 全局者只读查询：`progress>=100` 行数 0），所以**无需迁移**；已归档的（2 条）不受影响。

要求：
- 把魔数提为**一个命名常量**（如 `ARCHIVE_AFTER_DAYS = 7`），两处共用；不许再各自写字面量。
- 文案改 7（若能从常量取值则取，客户端拿不到服务端常量就写字面量 7，两处对齐即可）。
- 测试：更新旧用例，并**新增**「第 6 次不归档、第 7 次归档」的边界用例（自然路径与手动完成路径各一）。**先确认新用例在阈值仍为 3 时会红**，再改常量转绿。
- `CHANGELOG.md` 记一条；`context.md` 里的约定条我（全局者）已改，不用碰。

## Part B — 庆祝动效

### 状态与类（`client/src/components/Cylinder3D.vue`）

- 新增 prop `videoId`（HomePage 传 `video.id`）。`isComplete = props.progress >= 100`。
- `.cylinder-wrapper` 上：`is-complete`（静态终态，常驻）与 `is-celebrating`（庆祝中，约 3s 后移除；用 `animationend` 或超时，自选，但必须保证移除，不留残留类）。
- 新增两个装饰元素（`aria-hidden="true"`，仅 `isComplete` 时渲染）：`.cup-halo`（光环）、`.cup-arc`（亮弧）。**在 DOM 里紧跟 `.cup-bloom` 之后、位于 `.cylinder-glass` 之前**，视觉上在杯子后面。
- 杯内数字 `.progress-text` 在 `is-complete` 下换成参考稿的「淡紫渐变 + 高光层」样式。

### 起播时机

- 首次加载：等**注水 + 数字 count-up 完成**后（≈800ms，再加该卡片入场 stagger 的延迟）才起播，肉眼上是「先注满、再庆祝」。
- 手动标记：`HomePage.markCompleted` 把 `progress` 改成 100 → 监听 `props.progress` 从 `<100` 变为 `>=100`，同样在液面过渡（800ms）结束后起播。
- 起播即在本机记「已庆祝」，见下。

### 「只播一次」的持久化

- 新增 `client/src/utils/celebrated.js`：`hasCelebrated(id)` / `markCelebrated(id)` / `pruneCelebrated(activeIds)`。存 `localStorage`，key 如 `celebrated_100_ids`，值为 id 数组的 JSON。
- 全部读写包 `try/catch`。**存储不可用（隐私模式等）时的默认 = 视为已庆祝**（只显示静态终态）——宁可不播，不要每次刷新都播（用户说过「每次都出现会烦」）。
- `HomePage` 在 `loadVideos()` 之后调用 `pruneCelebrated(当前 videos 的 id)`，防止数组无限增长（视频归档/删除后其 id 自然清掉）。
- 已知取舍（判断，非缺陷）：同一视频进度掉出 100 又回到 100 不会重播——每视频只庆祝一次。

### reduced-motion

- 沿用项目策略「去位移留反馈」：`prefers-reduced-motion: reduce` 下**不起庆祝、不做悬停重放**，只显示**静态终态**（淡紫数字 + 淡紫光环仍在——这就是「留反馈」）。Cylinder3D 已有 `REDUCED_MOTION` 常量可复用；悬停重放的 CSS 用 `@media (prefers-reduced-motion: no-preference)` 包住。

### 视觉规格（数值以参考稿为准，这里只写移植时会踩的点）

- **参考稿是 6 秒预览循环**（前 50% = 3 秒有效动画，后 50% 静止）。移植成「一次 3 秒」时，`sheen` / `halo-burst` / `arc-burst` 三组关键帧的百分比要**整体 ×2 压成 0–100%**，`animation-iteration-count: 1`。参考稿里的 `*-once` 版本已经是 3 秒一次，可直接用于**悬停重放**；但**首次庆祝**用的是 `*-burst` 版（光环从杯后扩出、亮弧转一圈），二者起点不同，别混。
- 亮弧旋转依赖 `@property --ang`（`<angle>`）。不支持的浏览器（较旧 Safari/Firefox）亮弧不会旋转，只会闪现一下——**可接受的降级**，不需要 polyfill；但要确认它**不会**留下一段常驻的静止亮弧（弧的 `opacity` 在静态态必须为 0）。
- **数字尺寸**：参考稿庆祝态数字 `20px`。**现有 `.progress-text` 的 `font-size: clamp(12px, 16%, 18px)` 里 `16%` 是相对父元素字号，实算大概率是 12px**（全局者的判断，未实测——第一步先在浏览器里量出真实值并写进交接）。设计稿已按 12px（普通）/ 20px（庆祝）呈现，用户看到的就是这个对比：**庆祝态数字明显比其它杯子大**，这是有意的强调。若量出来现状不是 12px，停下来告诉全局者，不要自行取舍。
- 数字的**深紫描边**（参考稿里 `drop-shadow(0 0 1.2px rgb(59 7 100/.85))`）**不许删**：紫色高光和紫色液体颜色接近，光扫过时靠它保住可读性。
- **光环尺寸风险**：参考稿光环 `200×300px`，比杯子（约 120px 宽）和手机端固定列宽（140px）都大。首页手机端网格外层 `.home-grid-scroll` 是 `overflow-x: auto`（CSS 规则下 `overflow-y` 随之变为 auto），**光环可能被滚动容器裁成硬边**，或撑出横向滚动。这是全局者读代码后的**推断，未渲染验证**。要求：手机 320/375 宽与桌面都实测；若被裁，优先**缩小光环 / 给容器加 padding**，不要去掉容器的 `overflow`。
- 新增颜色**用 token**：在 `client/src/assets/styles/main.css` 的 `:root` 加（命名自定，如 `--celebrate-blue`/`--celebrate-purple`/`--celebrate-orchid` 及淡紫底色），按项目既有惯例同步 `client/tailwind.config.js`。
- **不改**：wave rotate 光影、`.cup-bloom`、液体颜色分级（<30/30-59/60-89/90+）、`Cylinder3D` 其它状态。杯子仍不加 `backdrop-filter`。
- 性能：光环/亮弧只存在于 `isComplete` 的杯子上（通常 0–3 个）；`blur` 值沿用参考稿（7px / 4px，≤20px 预算内）；动画只动 `transform`/`opacity`/`--ang`/`background-position`/`filter`（小面积）。

### 对比度（必须实算，不许凭观感）

判据（全局者定）：**庆祝态数字的每个底色渐变停点，对「100% 杯中部液体色」的对比度 ≥ 3:1**（数字 20px/700 属 WCAG 大字，AA 阈值 3:1；判定沿用「当前视觉语言」约定的声明色静态模型）。杯中部液体色取 `--liquid-purple-start`（`rgb(196 142 255)`）与 `-end`（`rgb(147 51 234)`）之间的中间色，约 `rgb(171 96 244)`；也请同时算两端，报告最差值。
- **全局者 2026-09-21 已实算（WCAG 相对亮度，声明色静态模型；对 `--liquid-purple` 上端 `rgb(196 142 255)` / 中间 `rgb(172 97 245)` / 下端 `rgb(147 51 234)`）**：

  | 数字底色 | 上 | 中 | 下 |
  |---|---|---|---|
  | `#f5f3ff` | 2.21 | **3.31** | 4.91 |
  | `#ede9fe` | 2.04 | **3.06** | 4.53 |
  | `#ddd6fe` | 1.75 | **2.62 ✗** | 3.88 |
  | `#f5d0fe` | 1.77 | **2.65 ✗** | 3.93 |
  | 白 `#fff`（现有数字） | 2.42 | 3.63 | 5.38 |

  数字位于杯高 50% 处，所以**以「中」列为判据**（「上/下」仅供参考）。**参考稿里的 `#ddd6fe`、`#f5d0fe` 两个停点不达标（<3:1），必须改**：整条静态底色渐变的所有停点提亮到 ≥ `#ede9fe`（3.06，压线）——建议以 `#f5f3ff`（3.31）为主、`#ede9fe` 为辅，紫色的存在感交给「扫光带 + 柔光 + 光环」，而不是靠数字本身发暗。**不许靠减弱深紫描边来凑数。**
- **已知且接受的瞬时例外**：庆祝那 3 秒里，紫色扫光带经过数字的一瞬，该处颜色会接近液体色（对比度趋近 1），靠深紫描边维持可辨识；静态终态（扫光带在画面外）不受此例外约束，必须达标。
- 可参考 `plans/ui-refresh/check-contrast.mjs` 的算法自行复算；把**你改完后每个停点 × 上/中/下**的数字写进交接块。

## Boundaries（超出即停下问全局者）

- 只改：`Cylinder3D.vue`、`HomePage.vue`（传 `videoId` + `pruneCelebrated` 调用）、新增 `client/src/utils/celebrated.js`、`main.css` token、`tailwind.config.js`、`server/src/services/sync.js`（仅阈值常量）、`SettingsPage.vue`（仅第 113 行文案）、测试、`CHANGELOG.md`。
- **不做**：设置页庆祝、服务端存「已庆祝」状态（用户已选 localStorage / 每设备一次）、声音/震动、常驻动画、任何后端接口改动。
- 计划与实际代码不符（commit 漂移）时：停下报告，不要即兴改。

## 验证

**Part A**：`server` 干净 shell（`env -i`，见「测试封闭性」）全绿，新增边界用例先红后绿。

**Part B**（浏览器级，Playwright；**测试数据必须用假 bvid**，如 `BV_TEST_CEL_0921A/B`，经 `POST /api/videos` 建，`progress: 100`；**不得对库里真实视频做任何写操作**；测完清掉测试视频**并清掉浏览器 localStorage 里的 `celebrated_100_ids`**，最后确认库回到测试前的行数）：
1. 首次加载：`.is-celebrating` 出现，约 3s 后消失，`.is-complete` 常驻；`.cup-arc` 静态态 `opacity` 为 0（不留常驻亮弧）。
2. **刷新页面**：不再出现 `.is-celebrating`（只有静态终态）。
3. 悬停：`(hover:hover)` 下重放一次；触屏模拟无重放。
4. `prefers-reduced-motion: reduce` 模拟：从不出现 `.is-celebrating`，静态终态仍在。
5. 手动标记：建一个 62% 的假视频 → 点「标记为已看完」→ 确认 → 弹窗关闭、注满后出现 `.is-celebrating`。
6. localStorage 不可用（模拟 `setItem` 抛错）：页面不报错、不庆祝、只显示静态终态。
7. 320 / 375 / 768 / 1440 宽截图（存 `/tmp`，不入库）：静态终态与庆祝中各一张，光环无硬边裁切、无横向溢出、数字清晰。**把截图路径写进交接**，全局者会逐张看。
8. `npm run build` 绿。注意：`client/dist` 即生产静态目录，**构建 = 上线**（见 memory `proj-frontend-build-deploy`）。**请在交接块里写明：构建是在提交前还是等我复审后**——上一轮是复审前就上线了，这次先想好；建议**先在 vite dev（`localhost:5173`）验证、复审通过后再 `npm run build`**。

## 交接时

按 `WORKFLOW.md` 写交接块（四项「关键决策点」如实填；「安全相关」：本计划无新增输入面，只有 `localStorage` 读写，无外部请求）。两个 Part 建议**分两个提交**（Part A 一个、Part B 一个）。
