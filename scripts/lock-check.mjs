#!/usr/bin/env node
// 依赖冷却期 + 漏洞体检。规则、触发点与操作方式见 docs/dependency-policy.md。
//
//   node scripts/lock-check.mjs --diff <base-ref> [--min-age-days 7] [--allow name@ver,...] [--root <目录>]
//   node scripts/lock-check.mjs --audit [--root <目录>]
//
// 退出码：0 = 无违规；1 = 有违规（或 --audit 有漏洞/open 告警）；
//         2 = 算不出（base-ref 不存在、锁文件读不了、联网失败、某包查不到发布时间、gh 不可用）。
// 只依赖 node 内置模块 + `git` / `npm view` / `npm audit` / `gh` 命令。
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const EXIT_OK = 0
const EXIT_VIOLATION = 1
const EXIT_UNKNOWN = 2
const TARGETS = ['server', 'client']
const REGISTRY_PREFIX = 'https://registry.npmjs.org/'
const ALERTS_API = 'repos/Haven16262/bili-progress-pwa/dependabot/alerts?state=open&per_page=100'

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
    else if (a === '--min-age-days') { opts.minAgeDays = Number(argv[++i]) }
    else if (a === '--allow') { for (const s of String(argv[++i] || '').split(',')) if (s.trim()) opts.allow.add(s.trim()) }
    else if (a === '--root') { opts.root = resolve(argv[++i]); opts.rootGiven = true }
    else { console.error(`未知参数：${a}`); usage(); process.exit(EXIT_UNKNOWN) }
  }
  if (opts.mode === 'diff' && !opts.base) { console.error('--diff 需要 <base-ref>'); usage(); process.exit(EXIT_UNKNOWN) }
  if (!opts.mode) { usage(); process.exit(EXIT_UNKNOWN) }
  if (!Number.isFinite(opts.minAgeDays) || opts.minAgeDays < 0) { console.error('--min-age-days 需要非负数字'); process.exit(EXIT_UNKNOWN) }
  return opts
}

function spawn(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts })
  if (r.error) throw new CannotCompute(`${cmd} 无法执行：${r.error.message}`)
  return r
}

function run(cmd, args, cwd) {
  const r = spawn(cmd, args, { cwd })
  if (r.status !== 0) {
    throw new CannotCompute(`${cmd} ${args.join(' ')} 失败（exit ${r.status}）：${(r.stderr || '').trim().split('\n')[0] || '(无 stderr)'}`)
  }
  return r.stdout
}

// ── --diff ────────────────────────────────────────────────────────────────

function readLockPackages(root, dir, ref) {
  let text
  if (ref === null) {
    const file = join(root, dir, 'package-lock.json')
    if (!existsSync(file)) throw new CannotCompute(`读不到 ${file}`)
    text = readFileSync(file, 'utf8')
  } else {
    text = run('git', ['show', `${ref}:${dir}/package-lock.json`], root)
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

function pkgName(lockPath) {
  return lockPath.split('node_modules/').pop()
}

function diffDir(root, dir, ref) {
  const oldPkgs = readLockPackages(root, dir, ref)
  const newPkgs = readLockPackages(root, dir, null)
  const bumped = []   // 版本变化的包
  const added = []    // 新增的包
  const removed = []
  const violations = []

  for (const [lockPath, entry] of Object.entries(newPkgs)) {
    if (!lockPath) continue
    const old = oldPkgs[lockPath]
    const isAdded = !old
    const isBumped = old && old.version !== entry.version
    if (!isAdded && !isBumped) continue
    const name = pkgName(lockPath)
    const item = { dir, name, from: old ? old.version : null, to: entry.version, lockPath }
    ;(isAdded ? added : bumped).push(item)

    if (entry.resolved && !entry.resolved.startsWith(REGISTRY_PREFIX)) {
      violations.push(`[${dir}] ${name}@${entry.version} 的 resolved 不是官方 registry：${entry.resolved}`)
    }
    if (entry.resolved && !entry.integrity) {
      violations.push(`[${dir}] ${name}@${entry.version} 有 resolved 却缺 integrity`)
    }
    if (entry.hasInstallScript && !(old && old.hasInstallScript)) {
      violations.push(`[${dir}] ${name}@${entry.version} 新增了 install script`)
    }
  }
  for (const [lockPath, entry] of Object.entries(oldPkgs)) {
    if (lockPath && !newPkgs[lockPath]) removed.push(`${pkgName(lockPath)}@${entry.version}`)
  }
  return { bumped, added, removed, violations }
}

function publishTimes(name) {
  const out = spawn('npm', ['view', name, 'time', '--json'])
  if (out.status !== 0) {
    throw new CannotCompute(`npm view ${name} time 失败（联网？exit ${out.status}）：${(out.stderr || '').trim().split('\n')[0] || '(无 stderr)'}`)
  }
  let json
  try {
    json = JSON.parse(out.stdout)
  } catch {
    throw new CannotCompute(`npm view ${name} time 的输出无法解析`)
  }
  return json
}

function runDiff(opts) {
  const dirs = {}
  const violations = []
  const allowed = []
  let changedCount = 0
  let youngest = null

  for (const dir of TARGETS) {
    const d = diffDir(opts.root, dir, opts.base)
    dirs[dir] = d
    violations.push(...d.violations)
    changedCount += d.bumped.length + d.added.length
  }

  // 冷却期：每个「变动/新增」版本都要发布满 minAgeDays；未满且未放行 = 违规
  const timesCache = new Map()
  for (const dir of TARGETS) {
    for (const item of [...dirs[dir].bumped, ...dirs[dir].added]) {
      if (!timesCache.has(item.name)) timesCache.set(item.name, publishTimes(item.name))
      const iso = timesCache.get(item.name)[item.to]
      if (!iso) throw new CannotCompute(`查不到 ${item.name}@${item.to} 的发布时间`)
      const ageDays = (Date.now() - Date.parse(iso)) / 86400000
      item.ageDays = ageDays
      if (youngest === null || ageDays < youngest) youngest = ageDays
      if (ageDays < opts.minAgeDays) {
        const key = `${item.name}@${item.to}`
        if (opts.allow.has(key)) allowed.push({ key, ageDays })
        else violations.push(`[${dir}] ${item.name}@${item.to} 发布仅 ${ageDays.toFixed(1)} 天（< ${opts.minAgeDays} 天）且未放行`)
      }
    }
  }

  // 逐包明细与违规清单
  for (const dir of TARGETS) {
    const d = dirs[dir]
    const bumpedStr = d.bumped.map(i => `${i.name} ${i.from}→${i.to}（${i.ageDays.toFixed(1)} 天）`).join('，')
    console.log(`${dir}: 版本变化 ${d.bumped.length}，新增 ${d.added.length}，移除 ${d.removed.length}`)
    if (d.bumped.length) console.log(`  变化：${bumpedStr}`)
    if (d.added.length) console.log(`  新增：${d.added.map(i => `${i.name}@${i.to}（${i.ageDays.toFixed(1)} 天）`).join('，')}`)
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
  const cwd = join(root, dir)
  if (!existsSync(join(cwd, 'package-lock.json'))) throw new CannotCompute(`读不到 ${cwd}/package-lock.json`)
  const r = spawn('npm', ['audit', '--package-lock-only', '--json'], { cwd })
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
  return { packages: deps.total, vulns: vulns.total, bySeverity: vulns }
}

function openAlertCount() {
  const r = spawnSync('gh', ['api', '--paginate', ALERTS_API], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (r.error) {
    throw new CannotCompute(`GitHub 告警未查：gh 无法执行（${r.error.code || r.error.message}）`)
  }
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
  return json.length
}

function runAudit(opts) {
  const server = auditDir(opts.root, 'server')
  const client = auditDir(opts.root, 'client')
  const alerts = openAlertCount()
  const vulnTotal = server.vulns + client.vulns
  console.log(`  server 漏洞明细：${JSON.stringify(server.bySeverity)}`)
  console.log(`  client 漏洞明细：${JSON.stringify(client.bySeverity)}`)
  console.log(`查了 server ${server.packages} 包 / client ${client.packages} 包（npm audit），GitHub open 告警 ${alerts} 个；漏洞 ${vulnTotal} 个`)
  return (vulnTotal === 0 && alerts === 0) ? EXIT_OK : EXIT_VIOLATION
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
  throw err
}
