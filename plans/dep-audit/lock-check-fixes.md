# lock-check.mjs 安全审查打回：修复规格（2026-09-21）

- **对象**：`scripts/lock-check.mjs`（commit `d8b6ca2`，253 行）与 `docs/dependency-policy.md`
- **审查**：独立的 `security-reviewer` 子代理（只读，在临时仓库里用真实 npm 10.9.8 / git 2.43 / node 22 实测），结论 **不可放行**：4 个 HIGH（都是「报绿但其实没查」）、2 个 MEDIUM、若干 LOW。
- **全局者已独立复现 H1 与 H3**（临时 git 仓库，2026-09-21）：H1 把 `left-pad` 同版本的 `resolved` 改成 `git+ssh://git@evil.example/x.git#deadbeef`、`integrity` 改掉、加 `hasInstallScript:true` → 脚本输出「查了 0 个变动包 … 违规 0 项」、**退出 0**；H3 版本号取 `constructor` → 输出「最年轻 **NaN** 天 … 违规 0 项」、**退出 0**。其余（H2、H4、M1、M2）为审查者实测、全局者未重复。
- **为什么这很重要**：脚本自称是防线，用户的规则是「永远放行和永远报警一样没有信号」。**在本规格全部落地并通过审查之前，`lock-check.mjs` 的退出 0 不能单独作为放行依据**（全局者复审锁文件变动时仍要自己解析 JSON 比对）。
- **威胁模型（审查者与全局者一致的判断）**：`--diff` 由人在本机手跑、没有 CI，所以「不可信 PR 的锁文件」「cwd 里被人放了 `.npmrc`」是次要场景；主要场景是防 npm 自己的诚实输出出错。但 H1–H4 都是**不依赖网络劫持的结构性缺口**，且修法都很便宜，必须修。

## 要修的清单（每条：现象 → 修法 → 用哪个用例证明修好）

### H1 只按 `version` 判「变动」，同版本换内容完全不查（HIGH，已复现）
- **现象**：`isBumped = old.version !== entry.version`，版本相同就 `continue`，后面的 resolved / integrity / hasInstallScript 断言根本不执行。
- **修法**：对**新锁里每一个条目**都跑 ① `resolved` 官方源断言 ② 有 `resolved` 必有 `integrity`；并且**同版本时**额外比对旧锁：`resolved` 变了、`integrity` 变了、`hasInstallScript` 由假变真，**任一 = 违规**（同版本内容变化是最典型的篡改/重发信号）。冷却期仍只针对「版本变化 / 新增」。
- **用例**：上面 H1 的伪造锁 → 必须退出 1，且违规列出三项。

### H2 `resolved` 与 name / version 未绑定，冷却期查的可能是「另一个包」（HIGH，审查者实测）
- **现象**：key `node_modules/is-odd`、version `3.0.1`、`resolved` 指向 `is-number-7.0.0.tgz`，冷却期按 `is-odd@3.0.1` 查（3034 天，通过），而 `npm ci` 实际装的是 `is-number@7.0.0`。
- **修法**：从 `resolved` 的 URL 解析出 `(name, version)`（形如 `registry.npmjs.org/<name>/-/<basename>-<version>.tgz`），要求与「要查冷却期的名/版本」一致（有别名的条目——有 `name` 字段且与 key 不同——用 `entry.name`）。不一致 = 违规（或「算不出」，二选一，写进文档）。解析失败 = 「算不出」退出 2，**不许放行**。
- **用例**：审查者的 `is-odd`/`is-number` 伪造锁 → 必须退出非 0。

### H3 `time[version]` 用普通对象取值，版本串为 `constructor` / `__proto__` / `toString` 得 NaN，「违规 0」（HIGH，已复现）
- **修法**：先确认 `time` 是**非 null 的对象**；用 `Object.hasOwn(times, item.to)` 取值；`Date.parse` 后 `Number.isFinite(t)` 且 `ageDays >= 0`，否则**「算不出」退出 2**。
- **用例**：版本分别为 `constructor`、`__proto__`、`toString` → 均退出 2（不是 0，不是 NaN）。

### H4 npm 配置来自 cwd 的 `.npmrc` / 环境变量，`--diff` 与 `--audit` 都可被劫持（HIGH，审查者实测）
- **现象**：`npm view` 用 `process.cwd()` 而不是 `--root`；checkout 根目录放 `.npmrc`（`registry=http://…`）后脚本采信假 registry 的伪造发布时间；`--audit` 对真实 critical 漏洞（`minimist@0.0.8`）在有假 `.npmrc` 时得 `total 0`、退出 0。
- **修法**：所有 `npm` 子进程 ① 固定 `--registry=https://registry.npmjs.org/` ② `--userconfig`、`--globalconfig` 指向一个空文件 ③ **从环境里剔除全部 `npm_config_*`**（大小写都要清）④ `--diff` 的 `cwd` 用一个空临时目录（`npm view` 不需要工程目录）；`--audit` 需要锁文件，把两份锁拷进临时目录再跑，或接受 cwd 受控但**必须在输出里回显实际生效的 registry**。
- ⚠️ **审查者没实测 `--userconfig=/dev/null` 会不会让 npm 报错**——用一个真正的空临时文件更稳，并实测。
- ⚠️ **副作用要处理**：`docs` 自测表里现有的「联网失败」用例是用 `npm_config_registry=http://127.0.0.1:9` 模拟的——H4 修完后这个环境变量会被**故意忽略**，那条用例会失效（会变成真联网、退出 0）。需要换一个**显式的、仅供测试的**模拟手段，例如脚本读一个**专门命名的**环境变量（如 `LOCK_CHECK_REGISTRY`，默认官方源，文档标明「仅供测试」，并且**生效值一律回显在输出里**）。不许用「保留 `npm_config_registry`」来偷懒。

### M1 npm 输出 `null` 等异常时抛未捕获 TypeError → 退出 1（MEDIUM，审查者实测）
- **修法**：`main` 的兜底 `catch` 里，**非 `CannotCompute` 的任何异常也一律退出 2**并打印「内部错误：…」（退出 1 只留给「查完了，有违规」）。同时补：`packages` 里某条目为 `null`、`resolved` 不是字符串、`--root` 缺值——都要落到退出 2，不是崩栈。

### M2 `npm view <name>` 的 name 来自锁 key，可注入 npm 选项（MEDIUM，审查者实测）
- **现象**：name 为 `--registry=http://127.0.0.1:9`、`--userconfig=/tmp/x`、`git+https://…`、`-h`、`../../x` 时，npm 收到的都是**单独的 argv 项**（无 shell 注入），但 npm 会把 `--…` 当选项、把 `git+…` 当 spec。**审查者验证过：光加 `--` 不够**（`npm view --json -- --registry=… time` 会把它当本地目录 spec 报 ENOENT，仍不是 registry 查询）。
- **修法**：在 `pkgName` 之后、任何 `npm view` 之前用**包名正则校验**，不匹配 = 「算不出」退出 2：`/^(?:@[A-Za-z0-9._~-]+\/)?[A-Za-z0-9._~][A-Za-z0-9._~-]*$/`（审查者已用它跑过两份真实锁文件，0 个不匹配）；`npm view` 参数写成 `['view','--json','--',name,'time']`（`--json` 必须在 `--` 之前，已验证）。**正则不要用 `\w` 或 `.`；不要先 `encodeURIComponent` 再传 argv**（会和 `@scope/name` 冲突）。锁 key 里不含 `node_modules/`（如 workspace 的 `packages/a`）的条目，**同样按不合法处理**，别让它被当成 GitHub shorthand。
- **用例**：上面列的每一种畸形名 → 退出 2。

### L1 `git show ${ref}:…` 中 `ref` 以 `-` 开头会被 git 当选项（LOW，审查者实测，fail-closed 但属选项注入面）
- **修法**：`ref.startsWith('-')` 直接退出 2；并用 `git rev-parse --verify --quiet --end-of-options "<ref>^{commit}"` 先解析成 SHA，再 `git show "<SHA>:路径"`（审查者已验证可用）。
- **用例**：`--diff -h`、`--diff --output=x` → 退出 2 且无文件被写。

### L2 `gh api --paginate` 在告警 >100 时输出 `[...][...]` 导致永远解析失败（LOW，推断未验证）
- **修法**：去掉 `--paginate`；`per_page=100`，若返回 `length >= 100` 就**按违规处理**并在输出里写「≥100，未翻页」（不需要真的翻页）。

### L5 `--audit` 不看 `npm audit` 的退出码（LOW，推断）
- **修法**：`total` 为 0 但退出码不是 0，按「算不出」退出 2（`npm audit` 有漏洞时是 1；`total==0 && status!=0` 说明输出与状态自相矛盾）。

### L3 / L4（记录，不改脚本）
- **L3**：`hasInstallScript` 只是锁条目字段，由 npm 写入，手写的恶意锁可以省掉——**只对诚实 npm 产出的锁文件有意义**。写进 `docs/dependency-policy.md` 的「限制」一节。
- **L4**：别名条目（有 `name` 字段与 key 不同）——H2 的修法顺带解决，不用单独处理。

## 自测要求（这是本轮的重点，不是可选项）

之前的自测只是把命令贴进文档表格里，**没有可重复运行的东西**，脚本一改就没人知道有没有退化。本轮要求：

1. **先证明会红**：把 H1、H3 的伪造锁作为夹具，先对**未修复的 `d8b6ca2` 版**跑一次，确认它们确实退出 0（即缺陷成立），再对修复版跑，确认退出码变成预期。**H2、H4、M1、M2 同理**（能在旧版上复现的都要先复现）。
2. **提交一个可重复运行的自测**：`scripts/lock-check.selftest.mjs`（只用 node 内置模块）。它在**临时目录**里用 `git init` 造小仓库和伪造锁文件，逐项调用 `lock-check.mjs` 并比对退出码，最后输出固定格式一行：`跑了 <N> 项，通过 <p>，失败 <f>，需联网但联网失败 <n>`，**有任何失败或联网失败就非零退出**（联网失败不许算通过）。必须包含：原来 9 项确定性回归 + 本文件里 H1–H4、M1、M2、L1、L2、L5 的每个用例（需要 npm/gh 联网的用例，联网不通时报「需联网但联网失败」并计入非零退出，不许默默跳过）。
3. 自测跑完必须**清理自己造的临时目录**，且**不得写真实仓库的任何文件**。

## 边界

- 只改 `scripts/lock-check.mjs`、新增 `scripts/lock-check.selftest.mjs`、修改 `docs/dependency-policy.md`（补「限制」「威胁模型」，更新自测表，替换 `npm_config_registry` 的用法）。
- 不改任何依赖、`package.json`、锁文件；不 push；仍然**不引入任何第三方依赖**。
- 分两个提交：① 修复 + 文档 ② 自测（便于审查时对照「先红后绿」）。
