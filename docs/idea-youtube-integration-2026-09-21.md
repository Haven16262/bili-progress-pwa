# 后续方向：接入 YouTube（2026-09-21 调研，未开工）

> 状态：**仅调研，用户 2026-09-21 决定先不做**，记录为后续优化方向。
> 写给「下次开这个 Phase 的全局者」：读完即可决定怎么开，不必重新调研。
> 决策入口见文末「开工前要问用户的两件事」。

## 结论（先看这个）

YouTube 有官方 API（YouTube Data API v3），**但它不提供观看历史，也不提供播放进度**，所以不存在
「换个平台、用 API 就简单了」的路。B站 现在的模式是「用 SESSDATA 读历史接口拿到进度」，
YouTube 上没有对等的官方接口。

## 已核实 / 未核实

**已核实（2026-09-21，查官方文档与检索结果）：**
- Data API v3 修订记录：`channels.contentDetails.relatedPlaylists.watchHistory` 于 2016-08-11 废弃，
  相关 `playlistItems` 用法随之废弃。来源：https://developers.google.com/youtube/v3/revision_history
- 官方 issue tracker 上「API v3 - Watch History」为长期未实现的功能请求：https://issuetracker.google.com/issues/35172816
- 第三方文章称该播放列表此后一直返回空、且没有任何 OAuth scope 能读历史：
  https://bhanueso.dev/blips/youtube-watch-history-extension（**第三方说法**；官方 channels 文档页现已不列出
  `watchHistory` 字段，间接一致，但我没有亲自调用验证「返回空」）
- API 能做的：按视频 ID 取标题、时长、封面（`videos.list`，API key 即可，无需用户登录）。**此条按 API 常识写，
  本次未实际调用验证**——开工时先用一个真 key 调一次确认配额与字段。

**未核实（判断或记忆，开工前需验证）：**
- 「YouTube 历史页（`youtube.com/feed/history`）的页面数据里带有续播进度百分比」——来自记忆，未验证。
  仅在考虑方案 C 时才需要。
- 「Google 登录 Cookie 比 SESSDATA 敏感得多」「用 Cookie 抓历史页易失效、有被风控风险」——**这是判断**，
  依据是 Google Cookie 通常绑定整个账号会话、且前端结构常变；未实测。

## 可选方案

| 方案 | 做法 | 判断 |
|---|---|---|
| **A. 手动进度** | 粘贴 YouTube 链接添加视频，元数据走官方 API，进度用户自己调 | 最简单、合规。缺点：进度不自动 |
| **B. 浏览器端上报** | 油猴脚本/扩展读 `video.currentTime / duration`，POST 到本服务（用本服务自己的 token） | 进度准确，不存 Google 凭据。前提：在桌面浏览器看；手机 YouTube App 覆盖不到 |
| **C. 存 Google Cookie 抓历史页** | 类似 SESSDATA | **不建议**：非官方、易失效、凭据风险高 |
| **D. Google Takeout 导出** | 手动导出观看历史 | 导出里没有进度，不可行 |

**建议：先 A，觉得手动太烦再叠加 B。**

## 要改的地方（现状事实，2026-09-21 读代码所得）

- **数据模型（强制升级项）**：`server/src/db/init.js` 里 `videos.bvid TEXT NOT NULL UNIQUE`、
  `page_cache.bvid` 为主键，均以 B站 的 bvid 为唯一标识。接入多平台需改成「平台 + 视频 ID」，
  这是**数据库迁移**，命中 `WORKFLOW.md`「任务分流」强制升级第 4 项 → **迁移由全局者实现**，工作者做界面与集成。
  迁移要点：已有行补 `platform='bilibili'`；旧库启动时幂等加列（沿用 `init.js` 里 `ALTER TABLE ... ADD COLUMN`
  的既有迁移写法）；改唯一约束在 SQLite 里需要重建表，须先备份 `data.db`。
- **同步层**：`server/src/services/sync.js` 的 `runSync` 只认 B站。做「平台适配」时 B站 逻辑原样保留，
  YouTube 作为新增适配器，**不得改动 B站 的 412 降级链与 请求节制 约定**（见 `context.md`「跨 Phase 关键约定」）。
- **不适用的概念**：B站 的分P进度计算、`manually_completed` 与归档倒计时对 YouTube 视频需重新定义语义
  （YouTube 无分P；方案 A 下进度是手填的，「同步重算」不应覆盖它）。
- **前端**：添加视频入口（`AddVideoModal.vue`）目前是从 B站 最近播放里选，需增加「粘贴 YouTube 链接」路径；
  YouTube 封面域名（`i.ytimg.com`）如要显示，需放行 `server/src/index.js` helmet CSP 的 `imgSrc`；
  并沿用「B站 图片必须 CORS 加载」那条的思路（`crossorigin` + `referrerpolicy`）核对是否同样适用。

## 开工前要问用户的两件事

1. 平时主要在哪看 YouTube：**手机 App 还是桌面浏览器**？（决定方案 B 能不能用）
2. **手动调进度**能接受吗？还是必须自动？（决定只做 A，还是 A+B）

## 相关

- 项目 `context.md` backlog 有一行指向本文件。
- 用户对本项目 UI 有既定口味，新增入口需遵守「当前视觉语言 = 液体玻璃」约定（`context.md`「跨 Phase 关键约定」）。
