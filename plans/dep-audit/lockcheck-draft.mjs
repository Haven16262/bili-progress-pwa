// 一次性草稿（2026-09-21 全局者在 Dependabot 清理复审时写）——只当起点，未按 plans/ 里的「检查脚本纪律」打磨：
// 基准提交写死为 d6df3c7、无退出码约定、无法回归测试。正式版见 scripts/lock-check.mjs（由 context.md 的任务清单要求实现）。
import { execSync } from 'child_process'
const sh = c => execSync(c, { encoding: 'utf8', maxBuffer: 64e6 })
const now = Date.now(); const out = []
const pubCache = new Map()
function pubTime(name, ver) {
  if (!pubCache.has(name)) { try { pubCache.set(name, JSON.parse(sh(`npm view ${name} time --json 2>/dev/null`))) } catch { pubCache.set(name, {}) } }
  return pubCache.get(name)[ver]
}
for (const d of ['server', 'client']) {
  const oldL = JSON.parse(sh(`git show d6df3c7:${d}/package-lock.json`)).packages
  const newL = JSON.parse(sh(`git show HEAD:${d}/package-lock.json`)).packages
  const changed = [], added = [], removed = [], badHost = [], newScript = [], noIntegrity = []
  for (const [k, v] of Object.entries(newL)) {
    if (!k) continue
    const o = oldL[k]
    if (!o) added.push(k + '@' + v.version)
    else if (o.version !== v.version) changed.push({ k, name: k.split('node_modules/').pop(), from: o.version, to: v.version, res: v.resolved, integ: !!v.integrity, script: !!v.hasInstallScript && !o.hasInstallScript })
    if ((!o || o.version !== v.version)) {
      if (v.resolved && !v.resolved.startsWith('https://registry.npmjs.org/')) badHost.push(k + ' ' + v.resolved)
      if (!v.integrity && v.resolved) noIntegrity.push(k)
      if (v.hasInstallScript && (!o || !o.hasInstallScript)) newScript.push(k)
    }
  }
  for (const k of Object.keys(oldL)) if (k && !newL[k]) removed.push(k + '@' + oldL[k].version)
  console.log(`\n===== ${d}: changed ${changed.length}, added ${added.length}, removed ${removed.length}`)
  console.log('added:', added, 'removed:', removed)
  console.log('non-registry resolved:', badHost.length, badHost, '| missing integrity:', noIntegrity.length, '| new install scripts:', newScript.length, newScript)
  console.log('better-sqlite3:', oldL['node_modules/better-sqlite3']?.version, '->', newL['node_modules/better-sqlite3']?.version, '(unchanged expected)')
  for (const c of changed) {
    const t = pubTime(c.name, c.to); const days = t ? ((now - new Date(t)) / 864e5).toFixed(0) : '?'
    out.push({ d, name: c.name, from: c.from, to: c.to, published: t, days })
  }
}
out.sort((a, b) => (a.days === '?' ? 9e9 : +a.days) - (b.days === '?' ? 9e9 : +b.days))
console.log('\n== changed versions, youngest first (days since the NEW version was published)')
for (const o of out.slice(0, 12)) console.log(`${o.days}d`.padStart(5), o.d.padEnd(6), o.name, o.from, '->', o.to, (o.published || '').slice(0, 10))
console.log('... total changed:', out.length, '| unknown publish time:', out.filter(o => o.days === '?').length)
