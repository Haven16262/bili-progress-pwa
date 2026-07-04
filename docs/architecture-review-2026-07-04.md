# 架构评审 — 2026-07-04（全局者）

> 范围：server + client 全量源码（~2100 行）、DB schema、backup.sh、依赖清单。
> 上一 Phase「多P进度卡死修复」已关闭（commit `cf4cf1e`），本文为下一阶段选题依据。

## 一、总体评价

架构是健康的，不需要推倒任何东西：

- **分层清晰**：`routes → services → db/queries`，前端 `views / components / services`，文件全部 <250 行，符合小文件高内聚原则。
- **安全基线扎实**：常时密码比较、JWT tv 版本吊销、AES-256-GCM 加密 SESSDATA、helmet CSP、限流、错误信息不泄露、DB 600 权限——历史上修过的坑（见记忆 bili-pwa-pitfalls）都没有回潮。
- **运维兜底完整**：WAL-safe 备份 + 校验、每小时 checkpoint、ABI 自愈启动脚本。

主要短板集中在三类：**同步引擎的正确性/效率**、**前端错误处理**、**零测试**。

## 二、发现的问题（按严重度）

### HIGH

**H1. 归档倒计时按「同步次数」而非「天数」计**
`sync.js` 步骤 4/4b：每次 `runSync` 都对 progress≥100 的视频 `progress_100_count + 1`，满 3 归档。产品语义是「持续 3 天后归档」，但手动同步也会 +1 —— 一天内点 3 次「立即同步」，视频当天就被归档；手动标记完成的视频同理（4b 分支）。
**修法**：改为按日历日计数——`last_100_date` 与今天相同则跳过递增（加一列或复用 updated_at 判断），或存「首次达到 100 的日期」直接比差值 ≥3 天。

**H2. 每次同步全量翻爬 B站历史，无上限、无间隔、无提前终止**
`fetchAllHistory` 用 cursor 一直翻到 `is_end`。重度使用的账号历史可达数千条 → 每天上百次 API 请求连发，既慢又有触发 B站 风控的风险（参考阿里云 NapCat 的教训，B站 对异常请求模式同样敏感）。
**修法**（三件套）：
1. 提前终止：历史按 view_at 倒序，第一次出现即最新进度；本地追踪的 bvid 全部命中后立即停止翻页；
2. 页数硬上限（如 50 页）兜底；
3. 页间加 200–400ms 延时。

**H3. 设置页「SESSDATA 已设置」徽章永远显示「未设置」**
`SettingsPage.loadSettings()` 只读 localStorage 列数，`sessdataSet` 从不初始化——刷新后即使已配置也显示黄色「未设置」，误导用户重复粘贴。
**修法**：`GET /api/settings` 返回 `sessdata_set: bool`（服务端判断 setting 非空即可，不回传值本身），前端据此初始化。

### MEDIUM

**M1. 单P视频没有负缓存，每天每视频白打一次 view API**
`getPagesInfo`：`fetchVideoPages` 对单P视频返回 `null`，且 null 不写入 SQLite `page_cache` → 每次同步都对每个单P追踪视频重新请求 `/x/web-interface/view`。
**修法**：单P也写入 page_cache（`page_count=1, pages_json='[]'`），读取时 page_count≤1 直接返回 null 语义。

**M2. 疑似 CSP 阻断封面图（需真机验证）**
B站 封面 URL 通常在 `i0/i1/i2.hdslb.com` 域，而 CSP `imgSrc` 只放行 `*.bilibili.com`。若 AddVideoModal 封面实际显示为灰块，即此原因。
**修法**：imgSrc 增加 `https://*.hdslb.com`。

**M3. 前端 api.js 无统一错误/401 处理**
所有调用 `.then(r => r.json())`，不看 `res.ok`。Token 30 天过期或被 revoke 后，各页面静默拿到 `{error}` → 显示空列表，用户不知道要重新登录。
**修法**：api.js 包一层 `request()`：非 2xx 抛结构化错误；401 时清 token 并回到 PasswordGate。顺带把 App.vue 里两处裸 fetch 收编进 api.js（消重复）。

**M4. SESSDATA 加密密钥与 JWT_SECRET 耦合**
`crypto.js` 密钥从 JWT_SECRET 派生。将来轮换 JWT_SECRET（比如怀疑泄露）会静默毁掉 SESSDATA 解密（返回 null → 同步报「未配置」），排查成本高。
**修法**：至少在 `.env.example` 写明该耦合；更好是支持独立 `SESSDATA_ENC_KEY`（缺省回落 JWT_SECRET 派生，保持兼容）。同时可加「启动时发现 legacy 明文 → 自动重加密回写」的一次性迁移。

**M5. 同步无并发锁**
手动同步与 cron（或连点按钮）可并发执行 `runSync`，计数被双倍递增（放大 H1）、日志交错。
**修法**：模块级 `let syncRunning` 布尔锁，占用时直接返回「同步进行中」。

**M6. 零测试**
纯函数都是现成靶子：`computeGlobalProgress` / `computeEpisodeProgress`（多P进度是本项目核心算法）、crypto 加解密回环、queries 用内存 SQLite、auth 中间件。建议 vitest + supertest，优先覆盖同步引擎与认证路径，而非机械追 80%。

### LOW（多数已在 backlog 或顺手可修）

- L1. `videos.js` 三处 `:id` 校验改 `Number.isInteger(id) && id > 0`（backlog，critic MEDIUM）
- L2. AddVideoModal `z-50` + 手机底部贴边被 BottomNav 遮挡，改 `z-[51]` + 居中（backlog）
- L3. AddVideoModal `addOne`：`res.ok || res.error` 把任何错误都当成功移除候选并 emit added，语义混乱；HomePage `markCompleted` 的 `res.ok || res.error === undefined` 同类
- L4. `queries.updateVideo` 白名单含 `archived`/`progress_100_count`，但路由从不传——收紧到实际使用的 `custom_name`/`pinned`
- L5. `PUT /api/settings` 已是空操作存根，连同前端 `updateSettings` 可删
- L6. `settings` 表 `columns_per_row` 种子仍在写入但已废弃（跨 Phase 约定），可停止 seed（保留旧行无妨）

## 三、建议的下一 Phase 打包

**Phase：同步引擎正确性 + 效率（H1/H2/M1/M5 + 测试打底 M6 核心部分）**

理由：H1 是用户可感知的正确性 bug（归档时机错误），H2 是最大的外部风险面（风控），两者都在 `sync.js` 同一战场，一起动最省；动核心算法前先给 `computeGlobalProgress`/归档计数逻辑补测试，正好践行 TDD。

第二轮再做「前端体验小轮」：H3/M2/M3 + backlog L1/L2/L3。
M4 独立小改动，可塞进任一轮结尾。

## 四、明确不建议做的

- 不引入 TypeScript / 重写：项目规模（2k 行）与单用户场景下收益不抵扰动
- 不给 videos 加分页/索引：单用户几十条记录，SQLite 全表扫无感
- 不把 page_cache 换 Redis 之类：现有三级缓存结构合理，只缺负缓存
- 归档机制维持「软隐藏、永不删除」现状（用户已确认）
