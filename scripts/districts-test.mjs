// The new quarters: Downtown (boulevard, avenue, cross street), Southshore (Shore Road, Quay Lane) and Mill Row (Mill Road, the lane) —
// each street is walkable end to end without hitting a collider, and the landmark fast-travel points land inside walkable ground.
//   URL=http://localhost:4318/chadverse/ node scripts/districts-test.mjs
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
await p.fill('#chad-name', 'Walker')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const hold = async (k, ms) => { await p.keyboard.down(k); await p.waitForTimeout(ms); await p.keyboard.up(k); await p.waitForTimeout(250) }
const walk = async (name, x, z, yaw, axis, dir, min) => {
  await C('teleport', x, z, yaw)
  await p.waitForTimeout(500)
  const a = await C('world')
  await hold('w', 5000)
  const w = await C('world')
  const moved = axis === 'x' ? (w.x - a.x) * dir : (w.z - a.z) * dir
  check(moved >= min, `${name}: walked ${moved.toFixed(1)} m along the street (needs ≥ ${min})`)
}
const P = Math.PI
await walk('Downtown boulevard (north from the south end)', -60, 462, P, 'z', -1, 7)
await walk('Downtown avenue (east from the Gate Plaza)', -82, 415, P / 2, 'x', 1, 7)
await walk('Downtown cross street (east)', -82, 440, P / 2, 'x', 1, 7)
await walk('Southshore Shore Road (east)', 70, 94, P / 2, 'x', 1, 7)
await walk('Southshore Quay Lane (south from the lake)', 98.5, 68, 0, 'z', 1, 7)
await walk('Mill Row lane (south from the estates)', -42, 78, 0, 'z', 1, 7)
await walk('Mill Row Mill Road (east)', -68, 100, P / 2, 'x', 1, 7)
// every fast-travel landmark spawn lands on walkable ground (the player is not pushed away)
const places = [['Chad City gateway', -10, 415], ['Valley overlook', 8, 89], ['Castle Road', -110, 417], ['Chad Castle', -110, 300], ['Southshore', 70, 94], ['Mill Row', -42, 82]]
for (const [n, x, z] of places) {
  await C('teleport', x, z, 0)
  await p.waitForTimeout(500)
  const w = await C('world')
  check(Math.hypot(w.x - x, w.z - z) < 0.2, `${n}: the travel spawn is clear (${Math.hypot(w.x - x, w.z - z).toFixed(2)} m off)`)
}
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
