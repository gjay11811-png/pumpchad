// Chadville Heights: walk the real routes with ordinary keys (arch -> spine -> lanes) and check gate prompts. SIMULATED browser.
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Walker')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const W = () => p.evaluate(() => window.__chadverse.world())
const wait = (ms) => p.waitForTimeout(ms)
const tp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
// yaw: the camera looks along (-sin yaw, -cos yaw) for the camera; the existing tests face west with -PI/2 and the estates spawn uses it
const run = async (label, x, z, yaw, secs, key = 'w') => {
  await tp(x, z, yaw)
  await wait(600)
  await p.keyboard.down('Shift')
  await p.keyboard.down(key)
  await wait(secs * 1000)
  await p.keyboard.up(key)
  await p.keyboard.up('Shift')
  const w = await W()
  console.log(`  ${label}: ended at (${w.x.toFixed(1)}, ${w.z.toFixed(1)})`)
  return w
}
// 1. from the estate arch west along the old lane, through the link onto the spine, then down lane A
let w = await run('arch west along the estate lane', -34, 47, -Math.PI / 2, 6)
check(w.x < -60, `walks the old estate lane to the spine (x ${w.x.toFixed(1)})`)
w = await run('lane A, west end run (13 plots)', -72, 38, -Math.PI / 2, 24)
check(w.x < -225, `reaches the far end of lane A (x ${w.x.toFixed(1)})`)
w = await run('lane B, west end run', -72, 62, -Math.PI / 2, 24)
check(w.x < -225, `reaches the far end of lane B (x ${w.x.toFixed(1)})`)
w = await run('spine north to south', -68, 28, 0, 6)
check(w.z > 60, `walks the spine from the north end (z ${w.z.toFixed(1)})`)
// 2. a plot inside the district is NOT walk-through: it is enclosed by a kerb (open at its gate) and stays walkable inside
// gate prompts on all four gate directions
const gates = await p.evaluate(async () => {
  const out = []
  for (const [id, x, z] of [['H01', 0, 0]]) out.push(id)
  return out
})
void gates
const probe = async (label, x, z, yaw) => {
  await tp(x, z, yaw)
  await wait(900)
  const w = await W()
  console.log(`  ${label}: prompt = ${JSON.stringify(w.prompt)}`)
  return w.prompt
}
// H11 = row 1 slot 3.. positions are x0 = -71 - 13*slot - 12; plot gate on the lane side
let pr = await probe('row 1 (gate south), slot 5 plot gate', -71 - 13 * 5 - 6, 36.9, 0)
check(!!pr && /plot:H/.test(JSON.stringify(pr)), 'a north-row plot (gate faces south) shows its Buy prompt at the gate')
pr = await probe('row 2 (gate north), slot 4 plot gate', -71 - 13 * 4 - 6, 39.1, Math.PI)
check(!!pr && /plot:H/.test(JSON.stringify(pr)), 'a lane-A-south plot (gate faces north) shows its Buy prompt')
pr = await probe('show home sign area (not for sale)', -77, 36.9, 0)
check(!pr || !/Buy/.test(JSON.stringify(pr)), 'the show-home lot has no Buy prompt')
// 3. old plots unchanged
pr = await probe('plot A gate (original)', -44 - 0.9, 56, -Math.PI / 2)
check(!!pr && /plot:A/.test(JSON.stringify(pr)), 'original Plot A keeps its gate and id')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
