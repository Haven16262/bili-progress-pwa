#!/usr/bin/env node
// 依赖冷却期 + 漏洞体检。规则、触发点与操作方式见 docs/dependency-policy.md。
//
//   node scripts/lock-check.mjs --diff <base-ref> [--min-age-days 7] [--allow name@ver,...] [--root <目录>]
//   node scripts/lock-check.mjs --audit [--root <目录>]
//
// 退出码：0 = 无违规；1 = 有违规（或 --audit 有漏洞/open 告警）；
//         2 = 算不出（ref 不存在、锁文件读不了/条目畸形、联网失败、查不到发布时间、gh 不可用、
//             输出自相矛盾）——任何「没查成」都是 2，绝不当作放行。
// 只依赖 node 内置模块 + `git` / `npm` / `gh` 命令。
//
// 环境变量 LOCK_CHECK_REGISTRY：**仅供测试**，把 npm 的 registry 指到本地假服务器；默认官方源。
// 生效值一律回显在输出里（非官方源时另加一行醒目提示）。其余配置一律不采信：
// npm_config_*、NODE_ENV（会让 npm audit 跳过 devDependencies）、GIT_*、GH_HOST/GH_REPO、任何 .npmrc。
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const EXIT_OK = 0
const EXIT_VIOLATION = 1
const EXIT_UNKNOWN = 2
const TARGETS = ['server', 'client']
const OFFICIAL_REGISTRY = 'https://registry.npmjs.org/'
const EFFECTIVE_REGISTRY = process.env.LOCK_CHECK_REGISTRY || OFFICIAL_REGISTRY
// 包名白名单；不匹配的包名一律拒绝查询。首字符不许是 `.` / `_`（npm 包名本就不允许），
// 否则 `.` / `..` 会被 npm 当成目录 spec 去读本地 package.json（复审 M-4）。
// 已用两份真实锁文件验证 0 个不匹配。
const PACKAGE_NAME_RE = /^(?:@[A-Za-z0-9~-][A-Za-z0-9._~-]*\/)?[A-Za-z0-9~-][A-Za-z0-9._~-]*$/
const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/
const INTEGRITY_RE = /^sha(?:1|256|384|512)-/
const ALERTS_API = 'repos/Haven16262/bili-progress-pwa/dependabot/alerts?state=open&per_page=100'
const MAX_BUFFER = 64 * 1024 * 1024

class CannotCompute extends Error {}

function usage() {
  console.error('用法：')
  console.error('  node scripts/lock-check.mjs --diff <base-ref> [--min-age-days 7] [--allow name@ver,...] [--root <目录>]')
  console.error('  node scripts/lock-check.mjs --audit [--root <目录>]')
}

function parseArgs(argv) {
  const opts = { mode: null, base: null, minAgeDays: 7, allow: new Set(), root: process.cwd(), rootGiven: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--diff') { opts.mode = 'diff'; opts.base = argv[++i] }
    else if (a === '--audit') { opts.mode = 'audit' }
    else if (a === '--min-age-days') {
      const v = argv[++i]
      // 空串 Number('') === 0 会悄悄关掉冷却期，必须按非法处理
      opts.minAgeDays = (typeof v === 'string' && /^\d+(?:\.\d+)?$/.test(v)) ? Number(v) : NaN
    }
    else if (a === '--allow') { for (const s of String(argv[++i] ?? '').split(',')) if (s.trim()) opts.allow.add(s.trim()) }
    else if (a === '--root') {
      const v = argv[++i]
      if (v === undefined) { console.error('--root 缺值'); usage(); process.exit(EXIT_UNKNOWN) }
      opts.root = resolve(v)
      opts.rootGiven = true
    } else { console.error(`未知参数：${a}`); usage(); process.exit(EXIT_UNKNOWN) }
  }
  if (opts.mode === 'diff' && !opts.base) { console.error('--diff 需要 <base-ref>'); usage(); process.exit(EXIT_UNKNOWN) }
  if (!opts.mode) { usage(); process.exit(EXIT_UNKNOWN) }
  if (!Number.isFinite(opts.minAgeDays) || opts.minAgeDays < 0) { console.error('--min-age-days 需要非负数字'); process.exit(EXIT_UNKNOWN) }
  return opts
}

// ── 子进程：受控环境 + 受控 cwd（不采信 cwd 的 .npmrc、不采信 npm_config_* 环境变量）──

let scratch = null
function scratchDir() {
  if (scratch === null) {
    scratch = mkdtempSync(join(tmpdir(), 'lock-check-'))
    // user / global 必须是两个不同路径：npm 拒绝同一文件双重加载（实测报
    // 「double-loading config … as "global", previously loaded as "user"」）
    writeFileSync(join(scratch, 'empty-user-npmrc'), '')
    writeFileSync(join(scratch, 'empty-global-npmrc'), '')
    process.on('exit', () => { try { rmSync(scratch, { recursive: true, force: true }) } catch { /* 清理失败不影响结论 */ } })
  }
  return scratch
}

function cleanEnv() {
  const env = {}
  for (const [k, v] of Object.entries(process.env)) {
    if (/^npm_config_/i.test(k)) continue
    if (/^GIT_/i.test(k)) continue // GIT_DIR 等会让 git 读到别的仓库，把 base 对比放空
    if (k === 'NODE_ENV') continue // production 时 npm audit 默认 omit dev，漏掉 devDependencies 的漏洞
    if (k === 'GH_HOST' || k === 'GH_REPO') continue
    env[k] = v
  }
  return env
}

// cwd：npm 实际工作的目录。显式 --prefix 到它，npm 就不会沿父目录往上找项目 .npmrc（复审 M-5）；
// --include=dev 让 audit 即使环境里有 omit 之类的默认值也覆盖 devDependencies（复审 H-A）
function npmConfigArgs(cwd) {
  return [
    `--registry=${EFFECTIVE_REGISTRY}`,
    `--prefix=${cwd}`,
    '--include=dev',
    `--userconfig=${join(scratchDir(), 'empty-user-npmrc')}`,
    `--globalconfig=${join(scratchDir(), 'empty-global-npmrc')}`
  ]
}

function spawn(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: MAX_BUFFER, env: cleanEnv(), ...opts })
}

function runGit(args, cwd) {
  const r = spawn('git', args, { cwd })
  if (r.status !== 0) {
    throw new CannotCompute(`git ${args.join(' ')} 失败（exit ${r.status}）：${(r.stderr || '').trim().split('\n')[0] || '(无 stderr)'}`)
  }
  return r.stdout
}

// ── --diff ────────────────────────────────────────────────────────────────

function keyName(lockPath) {
  // 锁 key 必须是 node_modules/... 形式；workspace 之类的路径一律拒绝（别让它被当 GitHub shorthand）
  if (!lockPath.includes('node_modules/')) {
    throw new CannotCompute(`锁条目路径不含 node_modules/，拒绝处理：${JSON.stringify(lockPath)}`)
  }
  return lockPath.split('node_modules/').pop()
}

function readLockPackages(root, dir, ref, sha) {
  let text
  if (sha === null) {
    const file = join(root, dir, 'package-lock.json')
    if (!existsSync(file)) throw new CannotCompute(`读不到 ${file}`)
    text = readFileSync(file, 'utf8')
  } else {
    text = runGit(['show', `${sha}:./${dir}/package-lock.json`], root) // ./ = 相对 --root（cwd），不是仓库根
  }
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new CannotCompute(`${dir}/package-lock.json 解析失败（${ref ?? '工作区'}）`)
  }
  if (!json.packages || typeof json.packages !== 'object') {
    throw new CannotCompute(`${dir}/package-lock.json 没有 packages 段（需要 lockfileVersion 3）`)
  }
  return json.packages
}

// 条目的「真名」：别名条目（有 name 字段且与 key 不同）以 entry.name 为准。
// 冷却期、放行名单、resolved 绑定都必须用真名，否则查的是另一个包（复审 M-1）。
function effectiveName(keyNm, entry, dir) {
  if (entry.name === undefined) return keyNm
  if (typeof entry.name !== 'string' || !entry.name) throw new CannotCompute(`[${dir}] ${keyNm} 的 name 不是非空字符串`)
  return entry.name
}

// resolved 与 name/version 的绑定（H2）：registry.npmjs.org/<name>/-/<basename>-<version>.tgz
function checkResolvedBinding(dir, name, entry, violations) {
  if (entry.resolved === undefined) return
  const resolved = entry.resolved
  if (typeof resolved !== 'string') throw new CannotCompute(`[${dir}] ${name} 的 resolved 不是字符串`)
  if (!resolved.startsWith(OFFICIAL_REGISTRY)) return // 断言①已按违规记下，这里不再解析
  const rest = resolved.slice(OFFICIAL_REGISTRY.length)
  const m = rest.match(/^(.*)\/-\/([^/]+)$/)
  if (!m || !m[2].endsWith('.tgz')) {
    throw new CannotCompute(`[${dir}] ${name} 的 resolved 无法解析出包名/版本：${resolved}`)
  }
  const unscoped = name.startsWith('@') ? name.split('/')[1] : name
  if (m[1] !== name || m[2] !== `${unscoped}-${entry.version}.tgz`) {
    violations.push(`[${dir}] ${name}@${entry.version} 的 resolved 指向别的包/版本：${resolved}`)
  }
}

// 条目自身的结构与内容断言（对新锁里每一个条目都跑）
function checkEntry(dir, name, entry, old, violations) {
  const isLink = entry.link === true
  if (!isLink && (typeof entry.version !== 'string' || !entry.version)) {
    throw new CannotCompute(`[${dir}] ${name} 缺 version 或不是字符串`)
  }
  if (entry.hasInstallScript !== undefined && entry.hasInstallScript !== true) {
    throw new CannotCompute(`[${dir}] ${name} 的 hasInstallScript 不是 true（npm 只会写 true）：${JSON.stringify(entry.hasInstallScript)}`)
  }
  if (entry.resolved === undefined) {
    // 只有 inBundle / link 条目合法地没有 resolved；其余缺了 = npm ci 要靠使用者的 registry 配置去解析、且没有 integrity 钉住（复审 M-2）
    if (!isLink && entry.inBundle !== true) violations.push(`[${dir}] ${name}@${entry.version} 缺 resolved（也不是 inBundle/link）`)
  } else {
    if (typeof entry.resolved !== 'string') throw new CannotCompute(`[${dir}] ${name} 的 resolved 不是字符串`)
    if (!entry.resolved.startsWith(OFFICIAL_REGISTRY)) {
      violations.push(`[${dir}] ${name}@${entry.version} 的 resolved 不是官方 registry：${entry.resolved}`)
    }
    if (typeof entry.integrity !== 'string' || !INTEGRITY_RE.test(entry.integrity)) {
      violations.push(`[${dir}] ${name}@${entry.version} 有 resolved 但 integrity 缺失或格式不对`)
    }
  }
  if (entry.hasInstallScript && !(old && old.hasInstallScript)) {
    violations.push(`[${dir}] ${name}@${entry.version} 新增了 install script`)
  }
  if (old && old.version === entry.version) {
    if (old.resolved !== entry.resolved) {
      violations.push(`[${dir}] ${name}@${entry.version} 版本没变但 resolved 变了：${old.resolved} → ${entry.resolved}`)
    }
    if (old.integrity !== entry.integrity) {
      violations.push(`[${dir}] ${name}@${entry.version} 版本没变但 integrity 变了`)
    }
  }
  checkResolvedBinding(dir, name, entry, violations)
}

function diffDir(root, dir, sha) {
  const oldPkgs = readLockPackages(root, dir, null, sha)
  const newPkgs = readLockPackages(root, dir, null, null)
  const bumped = []
  const added = []
  const removed = []
  const violations = []

  // H1：每一个条目都要过内容断言；同版本但内容变化 = 违规
  for (const [lockPath, entry] of Object.entries(newPkgs)) {
    if (!lockPath) continue
    if (entry === null || typeof entry !== 'object') {
      throw new CannotCompute(`[${dir}] 锁条目不是对象：${lockPath}`)
    }
    const old = oldPkgs[lockPath]
    if (old !== undefined && (old === null || typeof old !== 'object')) {
      throw new CannotCompute(`[${dir}] ${sha}: 锁条目不是对象：${lockPath}`)
    }
    const key = keyName(lockPath)
    const name = effectiveName(key, entry, dir)
    const isAdded = old === undefined
    const isBumped = old !== undefined && old.version !== entry.version
    if (isAdded || isBumped) (isAdded ? added : bumped).push({ dir, name, key, from: old ? old.version : null, to: entry.version })
    checkEntry(dir, name, entry, old, violations)
  }
  for (const [lockPath, entry] of Object.entries(oldPkgs)) {
    if (lockPath && !newPkgs[lockPath]) removed.push(`${keyName(lockPath)}@${entry.version}`)
  }
  return { bumped, added, removed, violations }
}

function publishTimes(name) {
  if (!PACKAGE_NAME_RE.test(name)) throw new CannotCompute(`包名不合法，拒绝查询：${JSON.stringify(name)}`)
  const r = spawn('npm', ['view', '--json', ...npmConfigArgs(scratchDir()), '--', name, 'time'], { cwd: scratchDir() })
  if (r.status !== 0) {
    throw new CannotCompute(`npm view ${name} time 失败（联网？exit ${r.status}）：${(r.stderr || '').trim().split('\n')[0] || '(无 stderr)'}`)
  }
  let times
  try {
    times = JSON.parse(r.stdout)
  } catch {
    throw new CannotCompute(`npm view ${name} time 的输出无法解析`)
  }
  if (times === null || typeof times !== 'object') throw new CannotCompute(`npm view ${name} time 不是对象`)
  return times
}

// 别名条目同时写出锁 key，便于人读
const describeItem = i => (i.key === i.name ? i.name : `${i.name}（别名 key ${i.key}）`)

function printRegistry() {
  console.log(`registry: ${EFFECTIVE_REGISTRY}`)
  if (EFFECTIVE_REGISTRY !== OFFICIAL_REGISTRY) {
    console.log('⚠ 非官方 registry（LOCK_CHECK_REGISTRY，仅供测试）——本次结果不能当作对官方源的检查')
  }
}

function runDiff(opts) {
  if (opts.base.startsWith('-')) throw new CannotCompute(`base-ref 以 - 开头，拒绝：${opts.base}`)
  const sha = runGit(['rev-parse', '--verify', '--quiet', '--end-of-options', `${opts.base}^{commit}`], opts.root).trim()
  if (!/^[0-9a-f]{40,64}$/.test(sha)) throw new CannotCompute(`base-ref 解析不出 commit SHA：${opts.base}`)

  const dirs = {}
  const violations = []
  const allowed = []
  let changedCount = 0
  let youngest = null

  for (const dir of TARGETS) {
    const d = diffDir(opts.root, dir, sha)
    dirs[dir] = d
    violations.push(...d.violations)
    changedCount += d.bumped.length + d.added.length
  }

  // 冷却期：每个「变动/新增」版本都要发布满 minAgeDays；未满且未放行 = 违规
  const timesCache = new Map()
  for (const dir of TARGETS) {
    for (const item of [...dirs[dir].bumped, ...dirs[dir].added]) {
      // 版本串必须是 semver：time 对象里还有 created / modified 等非版本键，会被 hasOwn 命中（复审 L-d）
      if (typeof item.to !== 'string' || !SEMVER_RE.test(item.to)) {
        throw new CannotCompute(`[${dir}] ${item.name} 的版本号不是合法 semver，拒绝查冷却期：${JSON.stringify(item.to)}`)
      }
      if (!timesCache.has(item.name)) timesCache.set(item.name, publishTimes(item.name))
      const times = timesCache.get(item.name)
      if (!Object.hasOwn(times, item.to)) throw new CannotCompute(`查不到 ${item.name}@${item.to} 的发布时间`)
      const t = Date.parse(times[item.to])
      const ageDays = (Date.now() - t) / 86400000
      if (!Number.isFinite(t) || !Number.isFinite(ageDays) || ageDays < 0) {
        throw new CannotCompute(`${item.name}@${item.to} 的发布时间不可用：${times[item.to]}`)
      }
      item.ageDays = ageDays
      if (youngest === null || ageDays < youngest) youngest = ageDays
      if (ageDays < opts.minAgeDays) {
        const key = `${item.name}@${item.to}`
        if (opts.allow.has(key)) allowed.push({ key, ageDays })
        else violations.push(`[${dir}] ${item.name}@${item.to} 发布仅 ${ageDays.toFixed(1)} 天（< ${opts.minAgeDays} 天）且未放行`)
      }
    }
  }

  printRegistry()
  console.log(`冷却期阈值：${opts.minAgeDays} 天`)
  for (const dir of TARGETS) {
    const d = dirs[dir]
    console.log(`${dir}: 版本变化 ${d.bumped.length}，新增 ${d.added.length}，移除 ${d.removed.length}`)
    if (d.bumped.length) console.log(`  变化：${d.bumped.map(i => `${describeItem(i)} ${i.from}→${i.to}（${i.ageDays.toFixed(1)} 天）`).join('，')}`)
    if (d.added.length) console.log(`  新增：${d.added.map(i => `${describeItem(i)}@${i.to}（${i.ageDays.toFixed(1)} 天）`).join('，')}`)
    if (d.removed.length) console.log(`  移除：${d.removed.join('，')}`)
  }
  for (const a of opts.allow) {
    if (!allowed.some(x => x.key === a)) console.log(`提示：--allow ${a} 未匹配任何未满 ${opts.minAgeDays} 天的变动包`)
  }
  if (violations.length) {
    console.log('违规：')
    for (const v of violations) console.log(`  ✗ ${v}`)
  }

  const label = opts.rootGiven ? opts.root : '工作区'
  const a = dirs.server.bumped.length + dirs.server.added.length
  const b = dirs.client.bumped.length + dirs.client.added.length
  const youngestStr = youngest === null ? '—' : youngest.toFixed(1)
  const allowStr = allowed.length ? allowed.map(x => `${x.key}（${x.ageDays.toFixed(1)} 天）`).join('，') : '无'
  console.log(`查了 ${changedCount} 个变动包（server ${a} / client ${b}），范围 ${opts.base}..${label}，最年轻 ${youngestStr} 天，违规 ${violations.length} 项，放行 ${allowed.length} 项：${allowStr}`)
  return violations.length ? EXIT_VIOLATION : EXIT_OK
}

// ── --audit ───────────────────────────────────────────────────────────────

function auditDir(root, dir) {
  const src = join(root, dir, 'package-lock.json')
  if (!existsSync(src)) throw new CannotCompute(`读不到 ${src}`)
  // 把锁文件（和 package.json）拷进空临时目录再跑：cwd 里的 .npmrc / package.json 影响不到
  const work = mkdtempSync(join(scratchDir(), 'audit-'))
  copyFileSync(src, join(work, 'package-lock.json'))
  const pkgJson = join(root, dir, 'package.json')
  if (existsSync(pkgJson)) copyFileSync(pkgJson, join(work, 'package.json'))

  // 锁文件自身要像样：空锁/残缺锁不能报「0 漏洞」（复审 M-3）
  let lock
  try {
    lock = JSON.parse(readFileSync(src, 'utf8'))
  } catch {
    throw new CannotCompute(`${dir}/package-lock.json 解析失败`)
  }
  if (!lock || typeof lock.packages !== 'object' || lock.packages === null) {
    throw new CannotCompute(`${dir}/package-lock.json 没有 packages 段（需要 lockfileVersion 3）`)
  }
  const lockCount = Object.keys(lock.packages).filter(k => k).length
  let declared = 0
  if (existsSync(pkgJson)) {
    try {
      const pj = JSON.parse(readFileSync(pkgJson, 'utf8'))
      for (const f of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
        if (pj && pj[f] && typeof pj[f] === 'object') declared += Object.keys(pj[f]).length
      }
    } catch {
      throw new CannotCompute(`${dir}/package.json 解析失败`)
    }
  }
  if (lockCount === 0 && declared > 0) {
    throw new CannotCompute(`${dir}/package-lock.json 没有任何依赖条目，但 package.json 声明了 ${declared} 个依赖：锁文件残缺`)
  }

  const r = spawn('npm', ['audit', '--package-lock-only', '--json', ...npmConfigArgs(work)], { cwd: work })
  let json
  try {
    json = JSON.parse(r.stdout || '')
  } catch {
    // 联网失败时 stdout 常为空——绝不能当成「0 个漏洞」
    throw new CannotCompute(`npm audit（${dir}）输出不是 JSON（联网失败时可能为空；exit ${r.status}）：${(r.stderr || '').trim().split('\n')[0] || '(无 stderr)'}`)
  }
  const vulns = json?.metadata?.vulnerabilities
  const deps = json?.metadata?.dependencies
  if (!vulns || typeof vulns.total !== 'number') throw new CannotCompute(`npm audit（${dir}）输出缺少 metadata.vulnerabilities`)
  if (!deps || typeof deps.total !== 'number') throw new CannotCompute(`npm audit（${dir}）输出缺少 metadata.dependencies.total`)
  if (deps.total === 0 && lockCount > 0) {
    throw new CannotCompute(`npm audit（${dir}）报 0 个依赖，但锁文件有 ${lockCount} 个条目：输出与锁文件矛盾`)
  }
  if (vulns.total === 0 && r.status !== 0) {
    throw new CannotCompute(`npm audit（${dir}）报 0 漏洞但退出码是 ${r.status}，输出与状态矛盾`)
  }
  return { packages: deps.total, vulns: vulns.total, bySeverity: vulns, status: r.status }
}

function openAlerts() {
  // 不用 --paginate：>100 时 gh 会把多页数组拼成 [...][...]，无法解析且永远失败。
  // per_page=100 且长度到顶就按违规处理（不真翻页）。
  const r = spawn('gh', ['api', '--hostname', 'github.com', ALERTS_API]) // 钉死主机：GH_HOST 已在 cleanEnv 里剔除
  if (r.error) throw new CannotCompute(`GitHub 告警未查：gh 无法执行（${r.error.code || r.error.message}）`)
  if (r.status !== 0) {
    throw new CannotCompute(`GitHub 告警未查：gh api 查询失败（exit ${r.status}）：${(r.stderr || '').trim().split('\n')[0] || '(无 stderr)'}`)
  }
  let json
  try {
    json = JSON.parse(r.stdout || '')
  } catch {
    throw new CannotCompute('gh api 输出无法解析')
  }
  if (!Array.isArray(json)) throw new CannotCompute('gh api 输出不是数组')
  return { count: json.length, possiblyMore: json.length >= 100 }
}

function runAudit(opts) {
  const server = auditDir(opts.root, 'server')
  const client = auditDir(opts.root, 'client')
  const alerts = openAlerts()
  const vulnTotal = server.vulns + client.vulns
  printRegistry()
  console.log(`  server 漏洞明细：${JSON.stringify(server.bySeverity)}`)
  console.log(`  client 漏洞明细：${JSON.stringify(client.bySeverity)}`)
  if (alerts.possiblyMore) console.log(`  ⚠ GitHub open 告警 ≥100，未翻页，按违规处理`)
  const alertsStr = `${alerts.count}${alerts.possiblyMore ? '+' : ''}`
  console.log(`查了 server ${server.packages} 包 / client ${client.packages} 包（npm audit），GitHub open 告警 ${alertsStr} 个；漏洞 ${vulnTotal} 个`)
  return (vulnTotal === 0 && alerts.count === 0) ? EXIT_OK : EXIT_VIOLATION
}

// ── main ──────────────────────────────────────────────────────────────────

const opts = parseArgs(process.argv.slice(2))
try {
  process.exit(opts.mode === 'diff' ? runDiff(opts) : runAudit(opts))
} catch (err) {
  if (err instanceof CannotCompute) {
    console.error(`算不出：${err.message}`)
    process.exit(EXIT_UNKNOWN)
  }
  // 退出 1 只留给「查完了，有违规」；任何其它异常都是「没查成」
  console.error(`内部错误：${err && err.stack ? err.stack : String(err)}`)
  process.exit(EXIT_UNKNOWN)
}
