// The valley road between the village and Chad City: continuous, every long stretch walkable at the road's own height, the
// gateway opens onto it, the overlook is reachable, and the whole journey works in both directions (teleport-assisted walking).
//   URL=http://localhost:4318/chadverse/ node scripts/descent-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: {}, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Descender')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(250) }
const road = await C('descent')
let len = 0
for (let i = 1; i < road.length; i++) len += Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1])
const drop = road[0][2] - road[road.length - 1][2]
console.log(`valley road: ${road.length} points, ${len.toFixed(0)} m, drop ${drop.toFixed(1)} m (grade ${(drop / len).toFixed(3)}); walking ${(len / 2.2 / 60).toFixed(1)} min · jog ${(len / 5.2).toFixed(0)} s · sprint ${(len / 7.6).toFixed(0)} s`)
check(drop > 45 && drop / len < 0.1, 'a long, gentle descent into the valley (drop > 45 m, grade < 10 %)')
let gap = 0
for (let i = 1; i < road.length; i++) gap = Math.max(gap, Math.hypot(road[i][0] - road[i - 1][0], road[i][1] - road[i - 1][1]))
check(gap < 52, `the road is continuous (longest straight leg ${gap.toFixed(1)} m, no breaks)`)
// the village gateway: walk south through the open gate onto the road
await C('teleport', 0, 66, 0)
await p.waitForTimeout(600)
const a0 = await C('world')
await hold('w', 3500)
const a1 = await C('world')
check(a1.z > a0.z + 4 && Math.abs(a1.x) < 3.6, `the open village gate leads onto the road (z ${a0.z.toFixed(1)} → ${a1.z.toFixed(1)})`)
// every long stretch, walked forwards from 4 m in, stays on the road at the road's height
const legs = []
for (let i = 1; i < road.length; i++) {
  const [x0, z0, y0] = road[i - 1]
  const [x1, z1, y1] = road[i]
  const l = Math.hypot(x1 - x0, z1 - z0)
  if (l > 14) legs.push({ x0, z0, x1, z1, y0, y1, l })
}
let off = 0
for (const [i, L] of legs.entries()) {
  const dx = (L.x1 - L.x0) / L.l
  const dz = (L.z1 - L.z0) / L.l
  await C('teleport', L.x0 + dx * 3, L.z0 + dz * 3, Math.atan2(dx, dz))
  await p.waitForTimeout(450)
  await hold('w', 2000)
  const w = await C('world')
  const t = (w.x - L.x0) * dx + (w.z - L.z0) * dz
  const perp = Math.abs((w.x - L.x0) * -dz + (w.z - L.z0) * dx)
  const expect = L.y0 + (L.y1 - L.y0) * Math.min(1, Math.max(0, t / L.l))
  if (perp > 3.4 || Math.abs(w.y - expect) > 0.7 || t < 5) { off++; console.log(`    stretch ${i}: perp ${perp.toFixed(2)} t ${t.toFixed(1)} y ${w.y.toFixed(2)} vs ${expect.toFixed(2)}`) }
}
check(off === 0, `${legs.length} stretches walked: on the road, at the road's height (${off} off)`)
// the overlook terrace, then the City Gateway, both reachable and clear
for (const [n, x, z, y] of [['the overlook terrace', 14, 90, 0], ['the City Gateway', -6, 415, -52]]) {
  await C('teleport', x, z, 0)
  await p.waitForTimeout(500)
  const w = await C('world')
  check(Math.hypot(w.x - x, w.z - z) < 0.25 && Math.abs(w.y - y) < 0.6, `${n} is clear and at the right height (${Math.hypot(w.x - x, w.z - z).toFixed(2)} m off, y ${w.y.toFixed(1)})`)
}
// the way back up: from the City Gateway heading east/north along the final stretch, the player climbs again
await C('teleport', 24, 408, Math.atan2(1, -0.6))
await p.waitForTimeout(400)
const u0 = await C('world')
await hold('w', 5000)
const u1 = await C('world')
check(u1.z < u0.z - 3 || u1.x > u0.x + 3, `the road works in the other direction too (moved ${Math.hypot(u1.x - u0.x, u1.z - u0.z).toFixed(1)} m back toward the village)`)
// the city's first street continues from the gateway
await C('teleport', -6, 415, -Math.PI / 2)
await p.waitForTimeout(400)
const d0 = await C('world')
await hold('w', 4000)
const d1 = await C('world')
check(d1.x < d0.x - 4, `the gateway opens onto Downtown's avenue (x ${d0.x.toFixed(1)} → ${d1.x.toFixed(1)})`)
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
