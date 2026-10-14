// Citadel Mountain: the Castle Road is continuous, climbs, keeps the player on it (not off the edge), and reaches the castle bailey;
// the keep's doors stay closed with an honest plaque.
//   URL=http://localhost:4318/chadverse/ node scripts/mountain-test.mjs
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
await p.fill('#chad-name', 'Climber')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const OX = -120, OY = -52, OZ = 470 // the valley city's frame in the world
const road = await C('road')
console.log(`road: ${road.length} points, top y ${road[road.length - 1][2]}`)
check(road.length > 40 && road[road.length - 1][2] > 30, 'the Castle Road climbs to the summit')
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(250) }
// a straight walk from the Gate Plaza up the first stretch
await C('teleport', 10 + OX, -55 + OZ, Math.PI)
await p.waitForTimeout(700)
const a0 = await C('world')
await hold('w', 3500)
const a1 = await C('world')
check(a1.z < a0.z - 6 && a1.y > a0.y, `walks from the Gate Plaza onto the road and starts climbing (z ${a0.z.toFixed(1)} → ${a1.z.toFixed(1)}, y ${a1.y.toFixed(2)})`)
// every straight leg: stand at 20% along it facing along it, walk, stay on the road and keep rising
const legs = []
for (let i = 1; i < road.length; i++) {
  const [x0, z0] = road[i - 1]
  const [x1, z1, y1] = road[i]
  const len = Math.hypot(x1 - x0, z1 - z0)
  if (len > 20) legs.push({ x0, z0, x1, z1, y0: road[i - 1][2], y1, len })
}
check(legs.length >= 8, `${legs.length} long road legs found`)
let off = 0
for (const [i, L] of legs.entries()) {
  const dx = (L.x1 - L.x0) / L.len
  const dz = (L.z1 - L.z0) / L.len
  const sx = L.x0 + dx * 4
  const sz = L.z0 + dz * 4
  await C('teleport', sx, sz, Math.atan2(dx, dz))
  await p.waitForTimeout(500)
  await hold('w', 2200)
  const w = await C('world')
  // distance from the leg's centreline (should stay within the road's half-width)
  const t = ((w.x - L.x0) * dx + (w.z - L.z0) * dz)
  const perp = Math.abs((w.x - L.x0) * -dz + (w.z - L.z0) * dx)
  const expect = L.y0 + (L.y1 - L.y0) * Math.min(1, Math.max(0, t / L.len))
  if (perp > 2.7 || Math.abs(w.y - expect) > 0.6 || t < 6) { off++; console.log(`    leg ${i}: perp ${perp.toFixed(2)} t ${t.toFixed(1)} y ${w.y.toFixed(2)} vs ${expect.toFixed(2)}`) }
}
check(off === 0, `walking every leg keeps the player on the road at the road's height (${off} off)`)
// the castle: from the gatehouse approach across the moat bridge into the bailey
const last = road[road.length - 1]
await C('teleport', last[0], last[1] + 12, Math.PI)
await p.waitForTimeout(500)
await hold('w', 8000)
const c1 = await C('world')
check(c1.y > 30 && c1.z < -142 + OZ && c1.z > -190 + OZ, `crosses the moat bridge and enters the bailey (z ${c1.z.toFixed(1)}, y ${c1.y.toFixed(2)})`)
// the closed keep doors: walking at the keep stops at the steps (solid), not inside
await C('teleport', 12.6 + OX, -184 + OZ, Math.PI)
await p.waitForTimeout(400)
await hold('w', 9000)
const c2 = await C('world')
check(c2.z > -167.6 - 34 + OZ && c2.z < -164.5 - 34 + OZ, `the keep's doors stay closed — the player stops at the steps (z ${c2.z.toFixed(1)})`)
// stray off the edge: pushing sideways at the plateau rim stays on the plateau
await C('teleport', 10 + OX + 20, -198 + OZ, Math.PI / 2)
await hold('w', 5000)
const c3 = await C('world')
check(Math.hypot(c3.x - (10 + OX), c3.z - (-198 + OZ)) < 26.1, `the plateau rim holds (${Math.hypot(c3.x - (10 + OX), c3.z - (-198 + OZ)).toFixed(1)} m from the centre)`)
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
