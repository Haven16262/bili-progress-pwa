#!/usr/bin/env node
// lock-check.mjs 的可重复自测。用法：node scripts/lock-check.selftest.mjs
//
// - 只在临时目录里造夹具（git init 的小仓库 + 伪造锁文件 + PATH 里的 npm/gh 桩），
//   不写真实仓库的任何文件，跑完清理。
// - LOCK_CHECK_BIN=<路径> 可指定被测脚本（默认同目录的 lock-check.mjs）——用于「先红后绿」证据：
//   拿旧版脚本跑本自测，H1–H4/M1/M2/L1/L5 与复审第二轮各用例应当变红。
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
      ? `appendFileSync(${JSON.stringify(spec.record)}, JSON.stringify({ args, cwd: process.cwd(), npmConfigKeys: Object.keys(process.env).filter(k => /^npm_config_/i.test(k)), nodeEnv: process.env.NODE_ENV ?? null, leakedKeys: Object.keys(process.env).filter(k => /^GIT_|^GH_HOST$|^GH_REPO$/.test(k)) }) + '\\n')\n`
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
      expect: (c, o) => c === 2 && !o.includes('NaN') && !o.includes('违规 0 项')
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


  // ════ 复审第二轮（security-reviewer）新发现的缺口：每条一个用例，先在 74096ac 上红、再在修复版上绿 ════
  const goodTimes = { created: '2010-01-01T00:00:00.000Z', ...FIXTURE_TIMES['good-dep'] }

  // H-A：NODE_ENV=production 会让 npm audit 跳过 devDependencies → 必须剔除 NODE_ENV 并显式 --include=dev
  {
    const recordFile = join(tmpRoot, 'npm-audit-env.log')
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    const okAudit = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, dependencies: { total: 2 } } }
    const bin = makeStub({ npm: { record: recordFile, output: okAudit }, gh: { output: [] } })
    cases.push({
      name: 'H-A NODE_ENV=production 不得影响 audit（剔除 NODE_ENV + --include=dev）', needs: null,
      run: () => runBin(['--audit', '--root', dir], { env: { PATH: `${bin}:${process.env.PATH}`, NODE_ENV: 'production' } }),
      expect: c => {
        const recs = readRecords(recordFile)
        return c === 0 && recs.length > 0 && recs.every(r => r.nodeEnv === null && r.args.includes('--include=dev'))
      }
    })
  }

  // M-1：别名条目按 entry.name 查冷却期，不是锁 key
  {
    const recordFile = join(tmpRoot, 'npm-alias.log')
    const dir = makeRepo({ serverPackages: { 'node_modules/good-dep': goodEntry('good-dep', '1.0.0') } })
    writeServerLock(dir, {
      'node_modules/good-dep': goodEntry('good-dep', '1.0.0'),
      'node_modules/zzz-alias-key': { name: 'left-pad', ...goodEntry('left-pad', '1.3.0') }
    })
    const bin = makeStub({ npm: { record: recordFile, output: { created: '2010-01-01T00:00:00.000Z', ...FIXTURE_TIMES['left-pad'] } } })
    cases.push({
      name: 'M-1 别名条目：冷却期查 entry.name（left-pad），不查锁 key', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: (c, o) => {
        const recs = readRecords(recordFile)
        const queried = recs.map(r => r.args[r.args.indexOf('--') + 1])
        return c === 0 && queried.length === 1 && queried[0] === 'left-pad' && o.includes('别名 key zzz-alias-key')
      }
    })
  }

  // M-2：新增条目既无 resolved 也无 integrity（且不是 inBundle/link）→ 违规，不能所有断言被跳过
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    writeServerLock(dir, {
      'node_modules/left-pad': goodEntry('left-pad', '1.3.0'),
      'node_modules/good-dep': { version: '1.0.0' }
    })
    const bin = makeStub({ npm: { output: goodTimes } })
    cases.push({
      name: 'M-2 新增条目缺 resolved/integrity → 1（不是退出 0）', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: (c, o) => c === 1 && o.includes('缺 resolved')
    })
  }

  // M-3：--audit 遇到空锁 / 残缺锁不得报「0 漏洞」
  for (const [label, lockText] of [['锁文件是 {}', '{}'], ['packages 为空但 package.json 声明了依赖', JSON.stringify({ name: 'x', lockfileVersion: 3, packages: {} })]]) {
    const dir = makeRepo({
      serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') },
      extraFiles: { 'server/package.json': JSON.stringify({ name: 'fixture-server', version: '0.0.0', dependencies: { 'left-pad': '^1.3.0' } }) }
    })
    writeFileSync(join(dir, 'server/package-lock.json'), lockText)
    const bin = makeStub({ npm: { output: { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, dependencies: { total: 0 } } } }, gh: { output: [] } })
    cases.push({
      name: `M-3 --audit ${label} → 2`, needs: null,
      run: () => runBin(['--audit', '--root', dir], { env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: (c, o) => c === 2 && o.includes('算不出')
    })
  }

  // M-4：包名不得以 . / _ 开头（npm 会把 .. 当目录 spec）
  for (const key of ['node_modules/.', 'node_modules/..', 'node_modules/.hidden']) {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    writeServerLock(dir, {
      'node_modules/left-pad': goodEntry('left-pad', '1.3.0'),
      [key]: { version: '1.0.1', resolved: tarball('good-dep', '1.0.1'), integrity: 'sha512-z' }
    })
    const recordFile = join(tmpRoot, `npm-m4-${key.replace(/\W/g, '_')}.log`)
    const bin = makeStub({ npm: { record: recordFile, output: goodTimes } })
    cases.push({
      name: `M-4 包名 ${key.slice('node_modules/'.length)} → 2 且 npm 一次都没被调用`, needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: c => { let n = 0; try { n = readRecords(recordFile).length } catch { /* 桩没被调用 = 没日志文件 */ } return c === 2 && n === 0 }
    })
  }

  // M-5：npm 子进程显式 --prefix 到自己的空目录（不沿父目录找 .npmrc），diff 与 audit 两条路径都要
  {
    const recordFile = join(tmpRoot, 'npm-prefix.log')
    const dir = makeRepo({ serverPackages: { 'node_modules/good-dep': goodEntry('good-dep', '1.0.0') } })
    writeServerLock(dir, { 'node_modules/good-dep': goodEntry('good-dep', '1.0.1') })
    const bin = makeStub({ npm: { record: recordFile, output: goodTimes } })
    cases.push({
      name: 'M-5 --diff 的 npm 带 --prefix=<自己的 cwd>', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: c => { const recs = readRecords(recordFile); return c === 0 && recs.length > 0 && recs.every(r => r.args.includes(`--prefix=${r.cwd}`)) }
    })
    const recordFile2 = join(tmpRoot, 'npm-prefix-audit.log')
    const okAudit = { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, dependencies: { total: 2 } } }
    const bin2 = makeStub({ npm: { record: recordFile2, output: okAudit }, gh: { output: [] } })
    cases.push({
      name: 'M-5 --audit 的 npm 带 --prefix=<自己的 cwd>', needs: null,
      run: () => runBin(['--audit', '--root', dir], { env: { PATH: `${bin2}:${process.env.PATH}` } }),
      expect: c => { const recs = readRecords(recordFile2); return c === 0 && recs.length > 0 && recs.every(r => r.args.includes(`--prefix=${r.cwd}`)) }
    })
  }

  // L-a：GIT_DIR 指向别的仓库不得影响 base 对比
  {
    const good = { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') }
    const tampered = { 'node_modules/left-pad': { ...goodEntry('left-pad', '1.3.0'), integrity: 'sha512-tampered', hasInstallScript: true } }
    const other = makeRepo({ serverPackages: tampered })
    const dir = makeRepo({ serverPackages: good })
    writeServerLock(dir, tampered)
    cases.push({
      name: 'L-a GIT_DIR 指向别的仓库（其 HEAD 锁 = 被篡改的锁）→ 仍报违规 1', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { GIT_DIR: join(other, '.git') } }),
      expect: (c, o) => c === 1 && o.includes('版本没变但 integrity 变了')
    })
  }

  // L-b：--root 是仓库子目录时，base 必须按 --root 读，不是按仓库根读
  {
    const good = { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') }
    const tampered = { 'node_modules/left-pad': { ...goodEntry('left-pad', '1.3.0'), integrity: 'sha512-tampered', hasInstallScript: true } }
    const dir = makeRepo({
      serverPackages: tampered, // 仓库根的 server/ 恰好等于「被篡改后的样子」
      extraFiles: {
        'app/server/package-lock.json': lockJson(good, 'fixture-server'),
        'app/client/package-lock.json': lockJson({}, 'fixture-client')
      }
    })
    writeFileSync(join(dir, 'app/server/package-lock.json'), lockJson(tampered, 'fixture-server'))
    cases.push({
      name: 'L-b --root=<子目录>：base 按 --root 读 → 报违规 1（旧版读仓库根，误报 0）', needs: null,
      run: () => runBin(['--diff', 'HEAD', '--root', join(dir, 'app')]),
      expect: (c, o) => c === 1 && o.includes('版本没变但 integrity 变了')
    })
  }

  // L-c：--min-age-days 空串不得变成 0；生效阈值要回显
  cases.push({
    name: 'L-c1 --min-age-days "" → 2（不是悄悄当 0）', needs: null,
    run: () => runBin(['--diff', 'HEAD', '--min-age-days', '']),
    expect: c => c === 2
  })
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    cases.push({
      name: 'L-c2 生效的冷却期阈值回显在输出里', needs: null,
      run: () => runBin(['--diff', 'HEAD', '--min-age-days', '3'], { cwd: dir }),
      expect: (c, o) => c === 0 && o.includes('冷却期阈值：3 天')
    })
  }

  // L-d：版本串 created / modified（time 对象里的非版本键）→ 2
  for (const weird of ['created', 'modified']) {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    writeServerLock(dir, {
      'node_modules/left-pad': goodEntry('left-pad', '1.3.0'),
      'node_modules/good-dep': { version: weird, resolved: tarball('good-dep', weird), integrity: 'sha512-b' }
    })
    const bin = makeStub({ npm: { output: { created: '2010-01-01T00:00:00.000Z', modified: '2010-01-01T00:00:00.000Z', ...FIXTURE_TIMES['good-dep'] } } })
    cases.push({
      name: `L-d 版本串 ${weird} → 2（不能拿包创建时间过冷却期）`, needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: (c, o) => c === 2 && o.includes('不是合法 semver')
    })
  }
  // H3b：合法 semver 但 time 里没有 → 2（Object.hasOwn 这一层的用例）
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    writeServerLock(dir, {
      'node_modules/left-pad': goodEntry('left-pad', '1.3.0'),
      'node_modules/good-dep': goodEntry('good-dep', '9.9.9')
    })
    const bin = makeStub({ npm: { output: goodTimes } })
    cases.push({
      name: 'H3b 合法 semver 但发布时间表里没有 → 2「查不到」', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { PATH: `${bin}:${process.env.PATH}` } }),
      expect: (c, o) => c === 2 && o.includes('查不到 good-dep@9.9.9')
    })
  }

  // L-e：字段类型/格式校验（三种畸形各一例）
  for (const [label, entry, want] of [
    ['version 缺失', { resolved: tarball('good-dep', 'undefined'), integrity: 'sha512-x' }, c => c === 2],
    ['integrity 是垃圾串 "junk"', { version: '1.0.0', resolved: tarball('good-dep', '1.0.0'), integrity: 'junk' }, (c, o) => c === 1 && o.includes('integrity 缺失或格式不对')],
    ['hasInstallScript 为 false（npm 只会写 true）', { ...goodEntry('good-dep', '1.0.0'), hasInstallScript: false }, c => c === 2]
  ]) {
    const packages = { 'node_modules/good-dep': entry }
    const dir = makeRepo({ serverPackages: packages }) // base 与工作区相同：只有格式规则能报
    cases.push({
      name: `L-e ${label} → 非 0`, needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir }),
      expect: want
    })
  }

  // L-f：gh 调用钉死 github.com，且 GH_HOST / GH_REPO 不进子进程
  {
    const ghRecord = join(tmpRoot, 'gh-env.log')
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    const bin = makeStub({
      npm: { output: { auditReportVersion: 2, vulnerabilities: {}, metadata: { vulnerabilities: { total: 0, info: 0, low: 0, moderate: 0, high: 0, critical: 0 }, dependencies: { total: 2 } } } },
      gh: { record: ghRecord, output: [] }
    })
    cases.push({
      name: 'L-f gh 带 --hostname github.com，GH_HOST/GH_REPO 被剔除', needs: null,
      run: () => runBin(['--audit', '--root', dir], { env: { PATH: `${bin}:${process.env.PATH}`, GH_HOST: 'evil.example', GH_REPO: 'evil/repo' } }),
      expect: c => {
        const recs = readRecords(ghRecord)
        return c === 0 && recs.length === 1 && recs[0].args.includes('--hostname') && recs[0].args.includes('github.com') && recs[0].leakedKeys.length === 0
      }
    })
  }

  // L-g：非官方 registry 要有醒目提示
  {
    const dir = makeRepo({ serverPackages: { 'node_modules/left-pad': goodEntry('left-pad', '1.3.0') } })
    cases.push({
      name: 'L-g LOCK_CHECK_REGISTRY 非官方源 → 输出「非官方 registry」提示', needs: null,
      run: () => runBin(['--diff', 'HEAD'], { cwd: dir, env: { LOCK_CHECK_REGISTRY: 'https://hostile.example/' } }),
      expect: (c, o) => c === 0 && o.includes('非官方 registry')
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
