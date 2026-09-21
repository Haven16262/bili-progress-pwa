#!/usr/bin/env node
// lock-check.mjs 的可重复自测。用法：node scripts/lock-check.selftest.mjs
//
// - 只在临时目录里造夹具（git init 的小仓库 + 伪造锁文件 + PATH 里的 npm/gh 桩），
//   不写真实仓库的任何文件，跑完清理。
// - LOCK_CHECK_BIN=<路径> 可指定被测脚本（默认同目录的 lock-check.mjs）——用于「先红后绿」证据：
//   拿旧版脚本跑本自测，H1–H4/M1/M2/L1/L5 各用例应当变红。
// - 需要真实 npm/gh 的用例（R1–R9）先探测联网；探测失败时记为「需联网但联网失败」，不算通过。
// - 末行固定格式：`跑了 <N> 项，通过 <p>，失败 <f>，需联网但联网失败 <n>`；
//   有失败或联网失败即非零退出。
import { execFileSync, spawnSync } from 'node:child_process'
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..')
const BIN = process.env.LOCK_CHECK_BIN ? resolve(process.env.LOCK_CHECK_BIN) : join(HERE, 'lock-check.mjs')
const OLD_BASE = 'd6df3c7' // 依赖清理前的提交：回归用例需要一个「确实有变动」的 base

const tmpRoot = mkdtempSync(join(tmpdir(), 'lock-check-selftest-'))
process.on('exit', () => { try { rmSync(tmpRoot, { recursive: true, force: true }) } catch { /* ignore */ } })

// ── 基础设施 ──────────────────────────────────────────────────────────────

function runBin(args, { cwd = REPO, env = {}, timeout = 120000 } = {}) {
  const r = spawnSync('node', [BIN, ...args], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...env }, timeout })
  const extra = r.error ? `[子进程错误：${r.error.code || r.error.message}]` : ''
  return { code: r.status, out: `${r.stdout || ''}${r.stderr || ''}${extra}` }
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8' })

const tarball = (name, version) => `https://registry.npmjs.org/${name}/-/${name}-${version}.tgz`
const goodEntry = (name, version) => ({ version, resolved: tarball(name, version), integrity: `sha512-${name}-${version}` })

// 夹具用到的包名 → 发布时间表（npm 桩直接回答，不走网络）
const FIXTURE_TIMES = {
  'left-pad': { '1.3.0': '2020-01-01T00:00:00.000Z' },
  'is-odd': { '3.0.1': '2019-01-01T00:00:00.000Z' },
  'is-number': { '7.0.0': '2019-01-01T00:00:00.000Z' },
  'good-dep': { '1.0.0': '2020-01-01T00:00:00.000Z', '1.0.1': '2020-02-01T00:00:00.000Z' }
}

function lockJson(packages, name) {
  return JSON.stringify({
    name, version: '0.0.0', lockfileVersion: 3, requires: true,
    packages: { '': { name, version: '0.0.0' }, ...packages }
  }, null, 2)
}

function makeRepo({ serverPackages, clientPackages = {}, extraFiles = {} }) {
  const dir = mkdtempSync(join(tmpRoot, 'repo-'))
  git(['init', '-q'], dir)
  const files = {
    'server/package.json': JSON.stringify({ name: 'fixture-server', version: '0.0.0' }),
    'server/package-lock.json': lockJson(serverPackages, 'fixture-server'),
    'client/package.json': JSON.stringify({ name: 'fixture-client', version: '0.0.0' }),
    'client/package-lock.json': lockJson(clientPackages, 'fixture-client'),
    ...extraFiles
  }
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel)
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, content)
  }
  git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '-A'], dir)
  git(['-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'base'], dir)
  return dir
}

const writeServerLock = (dir, packages) => writeFileSync(join(dir, 'server/package-lock.json'), lockJson(packages, 'fixture-server'))

// npm / gh 桩：回答固定输出；可选把 argv / cwd / 环境里的 npm_config_* 记进日志文件
function makeStub({ npm, gh }) {
  const dir = mkdtempSync(join(tmpRoot, 'bin-'))
  const stub = (name, spec) => {
    const record = spec.record
      ? `appendFileSync(${JSON.stringify(spec.record)}, JSON.stringify({ args, cwd: process.cwd(), npmConfigKeys: Object.keys(process.env).filter(k => /^npm_config_/i.test(k)) }) + '\\n')\n`
      : ''
    writeFileSync(join(dir, name), `#!/usr/bin/env node\nimport { appendFileSync } from 'node:fs'\nconst args = process.argv.slice(2)\n${record}process.stdout.write(${JSON.stringify(JSON.stringify(spec.output))})\nprocess.exit(${spec.exit ?? 0})\n`, { mode: 0o755 })
  }
  if (npm) stub('npm', npm)
  if (gh) stub('gh', gh)
  return dir
}

// 解析 --diff 末行（断言用；不写死包数，避免锁文件一变用例就漂）
function parseDiffSummary(out) {
  const line = out.trim().split('\n').pop()
  const m = line.match(/^查了 (\d+) 个变动包（server (\d+) \/ client (\d+)），范围 .+，最年轻 (\S+) 天，违规 (\d+) 项，放行 (\d+) 项：/)
  return m ? { total: +m[1], server: +m[2], client: +m[3], youngest: m[4], violations: +m[5], allowed: +m[6] } : null
}

// 只放 node + npm 的 bin 目录（模拟「gh 不可用」）
function makeNoGhBin() {
  const dir = mkdtempSync(join(tmpRoot, 'nogh-'))
  symlinkSync(process.execPath, join(dir, 'node'))
  symlinkSync(execFileSync('which', ['npm'], { encoding: 'utf8' }).trim(), join(dir, 'npm'))
  return dir
}

function oldLocksRoot() {
  const dir = mkdtempSync(join(tmpRoot, 'oldlocks-'))
  for (const d of ['server', 'client']) {
    for (const f of ['package.json', 'package-lock.json']) {
      mkdirSync(join(dir, d), { recursive: true })
      writeFileSync(join(dir, d, f), git(['show', `${OLD_BASE}:${d}/${f}`], REPO))
    }
  }
  return dir
}

const readRecords = f => readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l))

// ── 用例 ──────────────────────────────────────────────────────────────────

const results = []
let networkSkipped = 0

function record(name, ok, note) {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${note ? ' — ' + note : ''}`)
}

function main() {
  const npmOnline = spawnSync('npm', ['view', 'express', 'version', '--json'], { encoding: 'utf8', timeout: 30000 }).status === 0
  const ghOnline = spawnSync('gh', ['api', 'rate_limit'], { encoding: 'utf8', timeout: 30000 }).status === 0
  console.log(`预案：npm 联网 ${npmOnline ? 'OK' : '不可用'}；gh 联网 ${ghOnline ? 'OK' : '不可用'}；被测脚本 ${BIN}`)

  const cases = []

  // ── R1–R9：原有确定性回归（真实仓库 / 真实 npm+gh）──
  cases.push({
    name: 'R1 --diff 旧base --min-age-days 0 → 0', needs: 'npm',
    run: () => runBin(['--diff', OLD_BASE, '--min-age-days', '0']),
    expect: (c, o) => c === 0 && (parseDiffSummary(o)?.total ?? 0) > 0 && parseDiffSummary(o).violations === 0
  })
  cases.push({
    name: 'R2 --diff 旧base --min-age-days 3650 → 1（全部违规）', needs: 'npm',
    run: () => runBin(['--diff', OLD_BASE, '--min-age-days', '3650']),
    expect: (c, o) => {
      const s = parseDiffSummary(o)
      return c === 1 && s !== null && s.total > 0 && s.violations === s.total
    }
  })
  cases.push({
    name: 'R3 --diff 不存在的 ref → 2', needs: null,
    run: () => runBin(['--diff', 'no-such-ref-selftest']),
    expect: c => c === 2
  })
  cases.push({
    name: 'R4 LOCK_CHECK_REGISTRY 死端口 --diff → 2（证明 registry 真被钉住）', needs: null,
    run: () => runBin(['--diff', OLD_BASE], { env: { LOCK_CHECK_REGISTRY: 'http://127.0.0.1:9/' } }),
    expect: c => c === 2
  })
  cases.push({
    name: 'R5 --audit 旧锁文件目录 → 1 且漏洞 >0', needs: 'gh',
    run: () => runBin(['--audit', '--root', oldLocksRoot()]),
    expect: (c, o) => c === 1 && /漏洞 (1[0-9]|[2-9][0-9]) 个/.test(o)
  })
  cases.push({
    name: 'R6 --audit 缺 gh → 2 且明说「GitHub 告警未查」', needs: 'npm',
    run: () => runBin(['--audit'], { env: { PATH: makeNoGhBin() } }),
    expect: (c, o) => c === 2 && o.includes('GitHub 告警未查')
  })
  cases.push({
    name: 'R7 LOCK_CHECK_REGISTRY 死端口 --audit → 2', needs: null,
    run: () => runBin(['--audit'], { env: { LOCK_CHECK_REGISTRY: 'http://127.0.0.1:9/' } }),
    expect: c => c === 2
  })
  cases.push({
    name: 'R8 --audit 现状 → 0', needs: 'gh',
    run: () => runBin(['--audit']),
    expect: (c, o) => c === 0 && o.includes('GitHub open 告警 0 个；漏洞 0 个')
  })
  cases.push({
    name: 'R9 --allow 放行：该包进放行清单且不再算违规（与不带 --allow 对比）', needs: 'npm',
    run: () => {
      const before = runBin(['--diff', OLD_BASE])
      const after = runBin(['--diff', OLD_BASE, '--allow', 'electron-to-chromium@1.5.433'])
      return { code: after.code, out: `${after.out}\n@@BEFORE@@\n${before.out}` }
    },
    expect: (c, o) => {
      const [afterOut, beforeOut] = o.split('\n@@BEFORE@@\n')
      const a = parseDiffSummary(afterOut)
      const b = parseDiffSummary(beforeOut)
      return c === 1 && a !== null && b !== null &&
        a.allowed === 1 && b.allowed === 0 && a.violations === b.violations - 1 &&
        afterOut.includes('放行 1 项：electron-to-chromium@1.5.433') &&
        !afterOut.includes('electron-to-chromium@1.5.433 发布仅')
    }
  })

  // ── H1：同版本换内容（离线：无版本变动 → 不查发布时间）──
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    writeServerLock(dir, {
      'node_modules/left-pad': {
        version: '1.3.0',
        resolved: 'git+ssh://git@evil.example/x.git#deadbeef',
        integrity: 'sha512-tampered',
        hasInstallScript: true
      }
    })
    cases.push({
      name: 'H1 同版本改 resolved/integrity/加 install script → 1，三项都报', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir }),
      expect: (c, o) => c === 1 && o.includes('版本没变但 resolved 变了') && o.includes('版本没变但 integrity 变了') && o.includes('新增了 install script')
    })
  }
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/is-odd': goodEntry('is-odd', '3.0.1') } })
    writeServerLock(dir, { 'node_modules/is-odd': { version: '3.0.1', resolved: tarball('is-number', '7.0.0'), integrity: 'sha512-x' } })
    cases.push({
      name: 'H2a 同版本 resolved 指向别的包 → 1', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir }),
      expect: (c, o) => c === 1 && o.includes('的 resolved 指向别的包/版本')
    })
  }
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/good-dep': goodEntry('good-dep', '1.0.0') } })
    writeServerLock(dir, { 'node_modules/good-dep': { version: '1.0.1', resolved: tarball('good-dep', '1.0.0'), integrity: 'sha512-y' } })
    const bin = makeStub({ npm: { output: { created: '2010-01-01T00:00:00.000Z', ...FIXTURE_TIMES['good-dep'] } } })
    cases.push({
      name: 'H2b 升版本但 resolved 仍指旧版本 → 1', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: (c, o) => c === 1 && o.includes('的 resolved 指向别的包/版本')
    })
  }

  // ── H3：版本串为 constructor / __proto__ / toString → 2 ──
  for (const weird of ['constructor', '__proto__', 'toString']) {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    writeServerLock(dir, {
      'node_modules/left-pad': goodEntry('left-pad', '1.3.0'),
      'node_modules/good-dep': { version: weird, resolved: tarball('good-dep', weird), integrity: 'sha512-b' }
    })
    const bin = makeStub({ npm: { output: { created: '2010-01-01T00:00:00.000Z', ...FIXTURE_TIMES['good-dep'] } } })
    cases.push({
      name: `H3 版本 ${weird} → 2（不是 NaN、不是 0）`, needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: (c, o) => c === 2 && o.includes('查不到 good-dep@') && !o.includes('最年轻 NaN')
    })
  }

  // ── H4：npm 子进程配置隔离（记录型 npm 桩直接断言 argv/env/cwd）──
  {
    const recordFile = join(tmpRoot, 'npm-args-a.log')
    const dir = makeRepo({ serverPackages: { 'node_modules/good-dep': goodEntry('good-dep', '1.0.0') } })
    writeServerLock(dir, { 'node_modules/good-dep': goodEntry('good-dep', '1.0.1') })
    const bin = makeStub({ npm: { record: recordFile, output: { created: '2010-01-01T00:00:00.000Z', ...FIXTURE_TIMES['good-dep'] } } })
    const HOSTILE = 'https://hostile.example/'
    cases.push({
      name: 'H4a npm_config_registry/恶意 registry 不采信 + 回显（记录型桩断言）', needs: null,
      run: () => runBin(['--diff', 'HEAD'], {
        cwd: dir,
        env: { PATH: `${bin}:${process.env.PATH}`, LOCK_CHECK_REGISTRY: HOSTILE, npm_config_registry: 'http://127.0.0.1:9/' }
      }),
      expect: (c, o) => {
        if (c !== 0 || !o.includes(`registry: ${HOSTILE}`)) return false
        const recs = readRecords(recordFile)
        return recs.length > 0 && recs.every(r =>
          r.npmConfigKeys.length === 0 &&
          r.args.some(a => a === `--registry=${HOSTILE}`) &&
          r.args.some(a => a.startsWith('--userconfig=')) &&
          r.args.some(a => a.startsWith('--globalconfig=')) &&
          !r.args.some(a => a.includes(dir)) &&
          !r.cwd.startsWith(dir)
        )
      }
    })
    writeFileSync(join(dir, '.npmrc'), 'registry=http://127.0.0.1:9/\n')
    const recordFile2 = join(tmpRoot, 'npm-args-b.log')
    const bin2 = makeStub({ npm: { record: recordFile2, output: { created: '2010-01-01T00:00:00.000Z', ...FIXTURE_TIMES['good-dep'] } } })
    cases.push({
      name: 'H4b 仓库根 .npmrc 被忽略（npm 的 cwd 不在仓库里）', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { PATH: `${bin2}:${process.env.PATH}` } }),
      expect: c => {
        if (c !== 0) return false
        const recs = readRecords(recordFile2)
        return recs.length > 0 && recs.every(r => !r.cwd.startsWith(dir))
      }
    })
  }

  // ── M1：锁条目为 null 不得崩栈 ──
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    writeFileSync(join(dir, 'server/package-lock.json'), JSON.stringify({
      name: 'fixture-server', version: '0.0.0', lockfileVersion: 3, requires: true,
      packages: { '': { name: 'fixture-server', version: '0.0.0' }, 'node_modules/left-pad': null }
    }))
    cases.push({
      name: 'M1 锁条目为 null → 2（旧版是未捕获异常退出 1）', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir }),
      expect: (c, o) => c === 2 && o.includes('算不出') && o.includes('锁条目不是对象')
    })
  }

  // ── M2：畸形包名不得进入 npm（名字在查询前就被拒，故离线）──
  for (const [label, key] of [
    ['选项注入 --registry=…', 'node_modules/--registry=http://127.0.0.1:9/'],
    ['相对路径 ../../x', 'node_modules/../../x'],
    ['不含 node_modules/ 的 key', 'packages/a']
  ]) {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    writeServerLock(dir, {
      'node_modules/left-pad': goodEntry('left-pad', '1.3.0'),
      [key]: { version: '1.0.1', resolved: tarball('good-dep', '1.0.1'), integrity: 'sha512-z' }
    })
    cases.push({
      name: `M2 ${label} → 2`, needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir }),
      expect: c => c === 2
    })
  }

  // ── L1：ref 以 - 开头 → 2 ──
  cases.push({
    name: 'L1a --diff -h → 2', needs: null,
    run: () => runBin(['--diff', '-h']),
    expect: (c, o) => c === 2 && o.includes('base-ref 以 - 开头')
  })
  cases.push({
    name: 'L1b --diff --output=x → 2', needs: null,
    run: () => runBin(['--diff', '--output=x']),
    expect: (c, o) => c === 2 && o.includes('base-ref 以 - 开头')
  })

  // ── L2：gh 返回 100 条（达 per_page 上限）→ 按违规处理 ──
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    const bin = makeStub({
      npm: { output: { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, dependencies: { total: 2 } } } },
      gh: { output: Array.from({ length: 100 }, (_, i) => ({ number: i + 1 })) }
    })
    cases.push({
      name: 'L2 gh 返回 100 条 → 1 且提示「≥100」', needs: null,
      run: () => runBin(['--audit', '--root', dir], { env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: (c, o) => c === 1 && o.includes('≥100')
    })
  }

  // ── L5：npm audit 报 0 漏洞但退出码非 0 → 2 ──
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    const bin = makeStub({
      npm: { exit: 1, output: { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, dependencies: { total: 2 } } } },
      gh: { output: [] }
    })
    cases.push({
      name: 'L5 audit 报 0 但退出码 1 → 2', needs: null,
      run: () => runBin(['--audit', '--root', dir], { env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: (c, o) => c === 2 && o.includes('输出与状态矛盾')
    })
  }

  // ── 执行 ──
  for (const c of cases) {
    if (c.needs === 'npm' && !npmOnline) { networkSkipped++; console.log(`⏭  ${c.name} — 需联网但联网失败（npm）`); continue }
    if (c.needs === 'gh' && !ghOnline) { networkSkipped++; console.log(`⏭  ${c.name} — 需联网但联网失败（gh）`); continue }
    let code = null
    let out = ''
    try {
      const r = c.run()
      code = r.code
      out = r.out
    } catch (err) {
      record(c.name, false, `用例自身抛错：${err.message}`)
      continue
    }
    let ok = false
    try {
      ok = c.expect(code, out)
    } catch {
      ok = false
    }
    record(c.name, ok, ok ? '' : `exit=${code} ${out.split('\n').filter(Boolean).slice(-2).join(' | ').slice(0, 220)}`)
  }

  const passed = results.filter(r => r.ok).length
  const failed = results.length - passed
  console.log(`跑了 ${results.length + networkSkipped} 项，通过 ${passed}，失败 ${failed}，需联网但联网失败 ${networkSkipped}`)
  process.exit(failed > 0 || networkSkipped > 0 ? 1 : 0)
}

try {
  main()
} catch (err) {
  console.error(`自测自身出错：${err && err.stack ? err.stack : String(err)}`)
  const passed = results.filter(r => r.ok).length
  console.log(`跑了 ${results.length} 项，通过 ${passed}，失败 ${results.length - passed}，需联网但联网失败 ${networkSkipped}`)
  process.exit(1)
}
