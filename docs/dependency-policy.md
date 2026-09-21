# 依赖策略：冷却期 + 漏洞体检

> 2026-09-21 起生效。落地脚本 `scripts/lock-check.mjs`；纪律条在 `context.md`「跨 Phase 关键约定」的「依赖更新纪律」（两者冲突时以 context.md 为准）。
> 起因与背景：`docs/dependabot-triage-2026-09-21.md`（28 个 Dependabot 告警的清理过程、可达性判断、npm 崩溃的完整经过）。

## 1. 冷却期（N = 7 天）

**规则**：依赖更新引入的**每个新版本**（含传递依赖）必须**发布满 7 天**才采用。

**为什么**：刚发布的版本是被投毒、被抢注、或很快暴露缺陷的高风险窗口——供应链攻击通常在发布后数小时到数天内被发现。等一周再采用，代价极小，挡掉的是最危险的那一段。N=7 由全局者定（用户只同意了「要冷却期」）。

**例外 = 告警驱动的安全修复**（允许不满 7 天，四条必须同时满足）：

1. 该版本通过 `npm audit signatures`；
2. 维护者列表与旧版本一致（`npm view <包名> maintainers` 对比）；
3. 交接块里逐条写明：包名@版本、发布天数、为什么非它不可；
4. 跑 `--diff` 时用 `--allow name@ver` 显式放行——**放行清单本身会出现在输出末行**，藏不住。

例外要少用：2026-09-21 那次清理里最年轻的必需版本是 `express@4.22.3`（发布 7.2 天，恰好压线，且是拿到 `qs` 修复的唯一途径）。**N 调大 → 例外会变得更频繁**，这是这套规则的内在张力。

## 2. 更新依赖时的操作方式

**首选：先算截止时间戳，再按包名更新**——让 npm 原生挡掉太新的版本：

```bash
CUTOFF=$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)
cd server && npm update <包名> --package-lock-only --before=$CUTOFF
```

**实测结论（2026-09-21，npm 10.9.8，临时目录、只拷 package.json + package-lock.json）**：

| 命令 | express 落到 | 该版本发布日期 |
|---|---|---|
| `npm update express --package-lock-only --before=2026-09-10T00:00:00Z` | **4.22.2** | 2026-05-11 |
| 同上，不带 `--before` | **4.22.3** | 2026-09-14（在截止线之后） |
| `--before=2026-05-10T00:00:00Z`（早于 4.22.2 发布） | 停在 **4.22.1** | 2025-12-01 |

→ **能用**：`--before` 对按包名的 `npm update --package-lock-only` 是有效的原生冷却手段。

**三个边界（别踩）**：

- `--before` 只过滤「可选版本」，**不越过 `package.json` 的版本范围**：同一截止线下 `qs` 停在 `~6.15.1` 范围内最高的 6.15.3（6.16.0 虽也在截止线之前，但不在范围内）。
- **不带包名的整树 `npm update --before=…` 仍会撞 npm 的 arborist bug**（`Cannot read properties of null (reading 'edgesOut')`；实测未改动锁文件、无残留）→ 只能逐包名更新。
- `--before` 是**事前的**手段；事后关卡仍是 `--diff`（见 §3a/§3b）。两者都开。

**本项目已知的 npm 坑**（完整经过见分诊文档，不在这里复制）：

- `server`：`npm audit fix` 与多包/整树 `npm update` 会崩（npm 自身 bug）→ 改为**逐包** `npm update <包名>`；`vitest` 一步要追加 `--legacy-peer-deps`。
- `client`：`npm audit fix`（**不加 `--force`**）可用；这些包不进浏览器产物，**不必重建 `client/dist`**。
- 服务端依赖变了要用户 `! pm2 restart bili` 才在运行进程生效；client 不需要。

## 3. 三个触发点（不建 cron、不建 GitHub Actions）

> 没人读的定时输出等于没有触发点；要接住「依赖变化 PR」需要一套审查流程，本轮不做。

- **(a) 工作者**：任何改动 `package-lock.json` 的任务，**交接前**跑
  `node scripts/lock-check.mjs --diff <任务起始 commit>`，把输出粘进交接块。
- **(b) 全局者**：审查的 diff **触及锁文件时必跑**同一命令（不采信工作者的转述）。
- **(c) 周期体检**：全局者**开新任务前**看 `context.md`「跨 Phase 关键约定」里**「依赖体检记录」那一行的日期**，距今 > 30 天就先跑 `node scripts/lock-check.mjs --audit`；体检后更新那一行。
  （这是弱触发点——靠会话纪律读 context.md，不是脚本强制；但比 cron 可靠，因为有人真的会读。）

## 4. 脚本用法与退出码

```bash
node scripts/lock-check.mjs --diff <base-ref> [--min-age-days 7] [--allow name@ver,...] [--root <目录>]
node scripts/lock-check.mjs --audit [--root <目录>]
```

**`--diff`**：对 `server/` 与 `client/` 两份锁文件，比对 `<base-ref>`（git ref）与工作区当前版本，报告**版本变化 / 新增 / 移除**计数与逐包明细，并断言：

1. 变化/新增包的 `resolved` 全部是 `https://registry.npmjs.org/`；
2. 有 `resolved` 的包都有 `integrity`；
3. 没有新增 `hasInstallScript: true`；
4. 每个变化/新增版本都发布满 `--min-age-days` 天（默认 7），未满且不在 `--allow` 里 = 违规。

**「变动包」** = 版本变化 + 新增（移除只报告、不计入）。**没有变动时**「最年轻」显示 `—`（空集无最年轻），退出码仍是 0。

**`--audit`**：对两份锁文件各跑 `npm audit --package-lock-only --json`（不依赖 `node_modules`），再查 `gh api repos/Haven16262/bili-progress-pwa/dependabot/alerts?state=open`。

**退出码**：`0` = 无违规 / 全 0；`1` = 有违规（`--audit` 时为有漏洞或 open 告警 > 0）；`2` = **算不出**——base-ref 不存在、锁文件读不了或解析不了、`npm view` 联网失败、某包查不到发布时间、`npm audit` 输出不是 JSON（联网失败时常为空，**绝不当作 0 个漏洞**）、`gh` 不可用或未登录（**明说「GitHub 告警未查」，不偷偷跳过报绿**）。

**输出末行是固定格式**（便于粘贴进交接与 grep）：

```
查了 <n> 个变动包（server <a> / client <b>），范围 <base>..<工作区>，最年轻 <x> 天，违规 <k> 项，放行 <m> 项：<清单>
查了 server <n> 包 / client <m> 包（npm audit），GitHub open 告警 <k> 个；漏洞 <v> 个
```

**自测记录（2026-09-21，确定性回归，不依赖「今天有哪些版本刚发布」）**：

| 命令 | 期望 | 实测 |
|---|---|---|
| `--diff d6df3c7 --min-age-days 0` | 0 | 0（45 个变动包，最年轻 2.6 天） |
| `--diff d6df3c7 --min-age-days 3650` | 1 | 1（45 项违规） |
| `--diff no-such-ref-0921` | 2 | 2（git show 失败） |
| `npm_config_registry=http://127.0.0.1:9 --diff d6df3c7` | 2 | 2（ECONNREFUSED） |
| `--audit --root <d6df3c7 旧锁文件临时目录>` | 1，漏洞 >0 | 1（15 个漏洞 = server 7 + client 8） |
| `PATH` 去掉 `gh` 后 `--audit` | 2，明说「GitHub 告警未查」 | 2 |
| `npm_config_registry=http://127.0.0.1:9 --audit` | 2（不许当 0 漏洞） | 2 |
| `--audit`（现状） | 0 | 0 |
| `--diff d6df3c7 --allow electron-to-chromium@1.5.433` | 1，该包进「放行」不进违规 | 1（违规 8、放行 1） |

> 注：对 `d6df3c7`（清理前）做 `--diff` 时，`--min-age-days 7` 下会有 8 个包报「未满 7 天」——那是 2026-09-21 清理**先于本策略**发生的历史结果，不需要回改；策略只约束**此后**的锁文件变动。
