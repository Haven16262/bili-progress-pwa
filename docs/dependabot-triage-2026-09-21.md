# Dependabot 分诊（2026-09-21）

> 2026-09-21 全局者用 `gh api repos/Haven16262/bili-progress-pwa/dependabot/alerts?state=open` 拉全量后写成。
> 目的：让做依赖清理的工作者零上下文可执行；日后再有告警堆积时可对照本次方法。
> 告警来源是 GitHub 扫描**默认分支上的 `package-lock.json`**——所以「push 了新的锁文件」才会让告警关闭，本地装了新包不算。

## 快照（已核实：GitHub API 直接读数）

- **28 个 open 告警，涉及 14 个不同的包**，分布在两份锁文件：`server/package-lock.json` 11 个、`client/package-lock.json` 17 个。
- 严重度：15 high / 10 moderate / 3 low（与 push 时 GitHub 报的一致，未变）。
- **全部有已修复版本，没有「无补丁」的。**
- 按 GitHub 的 `scope` 标记：client 开发 12 / client「runtime」5 / server 开发 4 / server 运行时 7。**注意 client 的「runtime」标记不可信**（见下）。

## 关键事实（均已实证，2026-09-21）

1. **client 的漏洞包没有一个进入浏览器打包产物。** 在 `client/dist/assets/*.js` 里搜 `nanoid`、`postcss`、`browserslist`、`fast-uri`、`brace-expansion`，命中文件数全为 0。它们只在构建/开发阶段运行（vite/tailwind/PostCSS 链），GitHub 把 `nanoid`/`postcss` 标成 runtime 是因为它们在锁文件里不在 `devDependencies` 分支上，不代表用户浏览器会执行。
2. **所有修复都在现有版本范围内，不需要大版本升级。** 已装版本 vs 修复版本：
   - `server`：`express` 4.22.1（`package.json` 写 `^4.21.0`）→ **4.22.3**（registry 上 4.x 最新）；`qs` 6.14.2 → 6.16.x；`body-parser` 1.20.5 → 1.20.8；`ip-address` 10.2.0 → 10.3.1（`express-rate-limit` 依赖 `^10.2.0`，范围内）；`vitest` 4.1.9 → 4.1.11（`^4.1.9` 范围内）；`@vitest/mocker` 与 `postcss`（server 开发依赖链）随之。
   - `client`：`npm audit fix --dry-run` **不加 `--force` 即可**，覆盖 `nanoid`/`postcss`/`postcss-selector-parser` 等。
3. **`qs` 不能靠单独更新拿到修复，必须经 `express` 升级。** `express@4.22.1` 把 `qs` 写死为 `~6.14.0`；而三条 `qs` 告警要 `6.16.0`（#47、#39）/ `6.15.2`（#10）。**`express@4.22.2` 起放宽到 `~6.15.1`，`express@4.22.3` 起是 `~6.16.0`，同时带 `body-parser@~1.20.5`**（`body-parser@1.20.8` 要 `qs ~6.16.0`）。所以 `npm update express` 一步到位；不要用 `overrides` 硬压 `qs`。
4. **`server` 的 `npm audit fix --dry-run` 会直接崩**：`npm error Cannot read properties of null (reading 'edgesOut')`（npm 自身内部错误；`npm ls` 只有正常的 UNMET OPTIONAL，没有 missing/invalid，所以依赖树本身不像坏了）。不要指望 `npm audit fix` 在 server 上能用——改用按名字的 `npm update <包名>`。（Node v22.23.2；npm 版本未记录。）
5. `server/node_modules` 不入库（git 忽略），`server/package-lock.json`、`client/package-lock.json` 入库，`lockfileVersion` 都是 3。

## 「这些告警在本应用里是否可达」（全局者判断 + 部分已核实）

**已核实（读了本项目代码）**
- `server/src` 里**没有** `qs`、`stringify`（除 `JSON.stringify`）、自定义 query parser、`comma`/`arrayLimit` 相关用法 → `qs.stringify` 类告警（#47、#10）与 `comma: true` 解析类告警（#39）**从本应用代码不可达**。
- `express.json({ limit: '1mb' })`（`server/src/index.js` 第 55 行）是合法的 limit → `body-parser` #18（「limit 值非法时静默不限制」）**不适用**。
- 唯一对外发请求的是 `server/src/services/bilibili.js`，host 写死 `https://api.bilibili.com`，没有用户可控 URL → `ip-address` 的 SSRF 类告警（#27、#25、#24）在本应用**没有攻击面**。

**判断（依据是告警文字 + 上面的核实，未逐行审计 express 内部）**
- Express 默认 query parser 用 `qs.parse` 且不开 `comma`；`ip-address` 在本项目里只经 `express-rate-limit` 用于限流 key 的生成，不用它的「特殊用途地址分类」。因此**实际被利用的可能性低**。
- 结论：**风险是低，但值得清**——28 个告警一直挂着会淹没将来真正相关的告警（本项目 9/3 是 20 个、7/12 评估仅 2 个、9/11 28 个，一直在涨），且修复代价小（全在现有范围内）。

## 14 个包 × 告警号

| 锁文件 | 包 | 告警号 | 修复到 | 怎么到 |
|---|---|---|---|---|
| server | `qs` | #47 #39 #10 | 6.16.0 | 经 `express` → 4.22.3 |
| server | `body-parser` | #18 | 1.20.6+（随 express 4.22.3 为 1.20.8） | 经 `express` |
| server | `ip-address` | #27 #25 #24 | 10.3.1 | `npm update ip-address`（`express-rate-limit` 范围内） |
| server（开发） | `vitest`、`@vitest/mocker` | #50 #48 | 4.1.11 | `npm update vitest` |
| server（开发） | `postcss` | #34 #22 | 8.5.23 | 经 vite 链；若 `npm update vitest` 后仍是旧版，再显式 `npm update postcss`（此行为推断，未实测） |
| client | `nanoid` | #44 #35 #30 | 3.3.18 | `npm audit fix` |
| client | `postcss` | #31 #21 | 8.5.23 | `npm audit fix` |
| client（开发） | `fast-uri` | #43 #42 #40 #28 #17 #16 | 3.1.6 | `npm audit fix` |
| client（开发） | `brace-expansion` | #37 #15 | 2.1.2 / 5.0.7 | `npm audit fix` |
| client（开发） | `browserslist`、`baseline-browser-mapping`、`@babel/core`、`postcss-selector-parser` | #46 #49 #12 #41 | 4.28.7 / 2.11.0 / 7.29.6 / 6.1.3 | `npm audit fix` |

## 做这件事时的已知雷区

- **`better-sqlite3` 原生模块 ABI**（见 `context.md`「跨 Phase 关键约定」的 ABI 迁移雷区）：本次**不该**动它的版本；但 `npm ci` 会重装它（走 prebuild 下载或本机编译）。先在**临时目录**用干净 `npm ci` 验证这条路径在本机能走通，再动真实目录。
- **服务端依赖变了必须重启服务才生效**，重启由用户 `! pm2 restart bili`（守卫会拦 PM2）。`server/scripts/start.sh` 会在 ABI 不匹配时自愈重编译。
- **client 依赖变化不需要重启**，且这些包不进浏览器产物，所以**不必为此重新构建 `client/dist`**（构建即上线，没有安全收益，只有风险）。只需证明「换了依赖后仍能构建」——构建到临时目录即可。
- **验证告警是否真关闭**：push 后再拉一次 `gh api .../dependabot/alerts?state=open`；GitHub 重新扫描可能有几分钟延迟。本地代理指标是两份锁文件各自 `npm audit` 输出 0 个漏洞。
