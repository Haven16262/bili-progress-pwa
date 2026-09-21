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

**`--diff`**：对 `server/` 与 `client/` 两份锁文件，比对 `<base-ref>`（git ref，先解析成 SHA）与工作区当前版本，报告**版本变化 / 新增 / 移除**计数与逐包明细，并断言：

1. **每一个**条目的 `resolved`（若有）都是 `https://registry.npmjs.org/`；**没有 `resolved` 的条目只允许是 `inBundle` / `link`**，否则违规（否则 `npm ci` 要靠使用者的 registry 配置去解析、且没有 integrity 钉住）；
2. **每一个**有 `resolved` 的条目都有格式合法的 `integrity`（`sha1|256|384|512-…`）；条目的 `version` 必须是字符串、`hasInstallScript` 只能缺省或 `true`，畸形 = 算不出（退出 2）；
3. **每一个**条目都没有「新增 install script」（相对 base 由假变真）；
4. **同版本但内容变了**（`resolved` 变了、`integrity` 变了）= 违规——版本号相同不代表同内容，这是最典型的篡改/重发信号（H1）；
5. `resolved` 必须与条目自身的 name/version **绑定**（`registry.npmjs.org/<name>/-/<basename>-<version>.tgz`）：指向别的包/版本 = **违规**（H2 选「违规」而非「算不出」；只有**解析不了**才按「算不出」退出 2）；
6. 每个「版本变化 / 新增」的版本都要发布满 `--min-age-days` 天（默认 7），未满且不在 `--allow` 里 = 违规。**别名条目**（有 `name` 字段且与锁 key 不同）一律用 `entry.name`（真名）做绑定、冷却期查询与 `--allow` 匹配，输出里同时标出锁 key；
7. 进入冷却期查询的版本串必须是 semver（`time` 里还有 `created` / `modified` 等非版本键，不能被当成版本），包名必须匹配白名单正则（首字符不许 `.` / `_`，防 `..` 被 npm 当目录）。

**「变动包」** = 版本变化 + 新增（移除只报告、不计入）。**没有变动时**「最年轻」显示 `—`，退出码仍是 0。

**`--audit`**：先检查锁文件像样（有 `packages` 段；`package.json` 声明了依赖却没有任何条目、或 npm 报 0 个依赖但锁里有条目 = 算不出，**空锁/残缺锁不能报「0 漏洞」**），再把两份锁文件（含 `package.json`）拷进空临时目录，各跑 `npm audit --package-lock-only --json`（不依赖 `node_modules`），再查 `gh api repos/Haven16262/bili-progress-pwa/dependabot/alerts?state=open&per_page=100`。
- 告警数**到 100（per_page 上限）**时按违规处理并标注「≥100，未翻页」——不用 `--paginate`（>100 时 gh 会把多页数组拼成 `[...][...]`，永远解析失败）（L2）。

**退出码**：`0` = 无违规 / 全 0；`1` = 有违规（`--audit` 时为有漏洞或 open 告警 > 0）；`2` = **算不出**——base-ref 不存在、锁文件读不了/条目畸形（非对象、`resolved` 非字符串）、`npm view` 联网失败、查不到发布时间或发布时间不可用、`npm audit` 输出不是 JSON（联网失败时常为空，**绝不当作 0 个漏洞**）、`npm audit` 报 0 漏洞但退出码非 0（自相矛盾）、`gh` 不可用或未登录（**明说「GitHub 告警未查」，不偷偷跳过报绿**）、以及**任何未预期的内部异常**（也一律 2，不会是 1）。

**子进程的配置隔离（H4，第二轮加固）**：所有 `npm` 调用都 ① 固定 `--registry=<生效 registry>` ② `--userconfig` / `--globalconfig` 指向空的临时文件（必须是两个**不同**文件——npm 拒绝同一文件双重加载） ③ 环境里**剔除全部 `npm_config_*`**，以及 **`NODE_ENV`**（`production` 时 npm audit 默认 omit devDependencies，会漏掉 dev 依赖的漏洞，且退出 0）、**`GIT_*`**（`GIT_DIR` 会让 git 读到别的仓库）、**`GH_HOST` / `GH_REPO`**，`gh` 另外显式 `--hostname github.com` ④ `--diff` 的 cwd 与 `--audit` 的锁文件目录都是空临时目录，并**显式 `--prefix=<该目录>`**（npm 否则会沿父目录往上找含 `package.json`/`node_modules` 的目录并读它的 `.npmrc`，`TMPDIR` 被劫持时作用域 registry 会生效）⑤ `--include=dev` 显式覆盖 omit 默认值。`git show` 用 `<sha>:./<dir>/package-lock.json`（相对 `--root`，不是仓库根）。**生效的 registry 与冷却期阈值一律回显在输出里**；`LOCK_CHECK_REGISTRY` 非官方源时另加一行「⚠ 非官方 registry」。`--min-age-days` 空串/非数字 = 算不出（不能悄悄变成 0）。

**`LOCK_CHECK_REGISTRY`（仅供测试）**：默认官方源；把它指向别的 registry 只用于测试「registry 真被钉住」。**不认 `npm_config_registry`**——不要再用它模拟断网（那个环境变量会被故意忽略）。

**输出末行是固定格式**（便于粘贴进交接与 grep）：

```
查了 <n> 个变动包（server <a> / client <b>），范围 <base>..<工作区>，最年轻 <x> 天，违规 <k> 项，放行 <m> 项：<清单>
查了 server <n> 包 / client <m> 包（npm audit），GitHub open 告警 <k> 个；漏洞 <v> 个
```

## 5. 自测与威胁模型

### 5.1 可重复自测

```bash
node scripts/lock-check.selftest.mjs          # 末行：跑了 <N> 项，通过 <p>，失败 <f>，需联网但联网失败 <n>
```

- 只在**临时目录**里造夹具（`git init` 的小仓库 + 伪造锁文件 + PATH 里的 npm/gh 桩），不写真实仓库任何文件，跑完清理。
- 覆盖：原有 9 项确定性回归（R1–R9）+ 第一轮审查的每个缺陷用例（H1、H2a/H2b、H3×3、H4a/H4b、M1、M2×3、L1a/L1b、L2、L5，共 25 项）+ **第二轮审查**新增的每个缺口（H-A、M-1、M-2、M-3×2、M-4×3、M-5×2、L-a、L-b、L-c×2、L-d×2、H3b、L-e×3、L-f、L-g），共 **47 项**。
- **有失败或联网失败即非零退出**；需要真实 npm/gh 的用例先探测联网，探测失败记为「需联网但联网失败」，**不算通过**。
- `LOCK_CHECK_BIN=<路径>` 可拿别的脚本跑同一套用例——用于「先红后绿」证据（见下）。
- 确定性：不依赖「今天有哪些新版本」，断言用末行解析而非写死包数。

**证据（2026-09-21，修复这一轮的留档）**：

| 被测版本 | 结果 |
|---|---|
| 第一轮：旧版 `d8b6ca2` 跑当时的 25 项 | **10/25**（退出 1）：H1 报「查了 0 个变动包…违规 0 项」退出 0、H2a/H2b 退出 0、H3 三种版本串都报「最年轻 NaN 天」退出 0、H4a/H4b 退出 0、M1 崩栈退出 1、L1b 让 git 去写文件、L2 不标「≥100」、L5 报 0 漏洞退出 0 |
| 第一轮：修复版 `74096ac` | **25/25**（退出 0） |
| 第一轮：修复版**故意去掉 H1 同版本比对** | **24/25**（退出 1，H1 变红）→ 已还原为逐字节一致的修复版 |
| 第二轮：`74096ac` 跑 47 项 | **26/47**（退出 1）：新增的 21 项**全部变红**（NODE_ENV 漏 dev 依赖 / 别名查错包 / 缺 resolved 放行 / 空锁报绿 / `..` 包名 / 无 `--prefix` / GIT_DIR / `--root` 子目录 / `--min-age-days ""` / `created` 版本串 / 字段格式 / GH_HOST / 无非官方源提示） |
| 第二轮：修复版 | **47/47**（退出 0） |

### 5.2 威胁模型

- 主要场景是**防 npm 自己的诚实输出出错 / 防锁文件被静默改内容**：`--diff` 由人在本机手跑、没有 CI，所以「不可信 PR 的锁文件」「cwd 里被放 `.npmrc`」是次要场景（H4 仍按不采信处理），但 H1–H3 这类**结构性缺口不依赖网络劫持**，属于必防。
- 第二轮审查（独立 `security-reviewer`）又找到 1 个 HIGH（`NODE_ENV=production` 时 `--audit` 对有 critical 漏洞的锁报 0）与 5 个 MEDIUM，均已修并各有自测；其中 `NODE_ENV`、`TMPDIR` 劫持（`--prefix`）、`..` 包名三条另用真实 npm 在旧版/新版上各复现过一次（旧版退出 0 报绿，新版退出 1/2）。**第二轮的修复由全局者直接实现（触发式升级），未再经独立复审**——所以下一次真实使用时要并行手工比对一次做校准（见 context.md 约定）。
- 新版本冷静期防的是「刚发布就被投毒 / 很快暴露缺陷」那一小段窗口；它不是审计工具，不判断包本身是否可信。

### 5.3 限制（知道就好，别当它保平安）

- **`hasInstallScript` 只对诚实 npm 产出的锁有意义**：它只是锁条目的字段，由 npm 写入；手写的恶意锁可以整条省掉。本脚本无法从锁文件本身证明「安装时不会跑脚本」。
- **`integrity` 同理**：字段在不在、和 `resolved` 对不对得上，脚本可以查；但脚本不下载 tarball 去核对哈希内容，也不验证签名。
- **不覆盖**：包名相似度/抢注（typosquatting）、维护者变更、依赖深度爆炸、许可证变更——这些要么需要人的判断，要么需要别的工具。
- `--audit` 的 GitHub 告警口径 = **默认分支上的 `package-lock.json`**：本地装了新依赖但没 push 新锁文件，告警不会关（本地代理指标是两份锁文件的 `npm audit` 为 0）。
