// Chadville Heights (large plots): walk the real routes with ordinary keys (arch → boulevard → spine → both lanes) and check the gate prompts. SIMULATED browser; game time is stepped
// (QA advance) and the key state is real, so slow software rendering does not change the result.   node scripts/heights-walk-test.mjs
import { chromium } from 'playwright'
import { PLOTS, plotGate, HEIGHTS } from '../src/game/estates.ts'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 800, height: 450 } })
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
await p.evaluate(() => window.__chadverse.freeze(true))
const W = () => p.evaluate(() => window.__chadverse.world())
const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
const tp = (x, z, yaw) => p.evaluate(([x, z, yaw]) => window.__chadverse.teleport(x, z, yaw), [x, z, yaw])
// yaw: 0 faces south (+z), -PI/2 faces west (-x), PI faces north
const run = async (label, x, z, yaw, secs, key = 'w') => {
  await tp(x, z, yaw)
  await adv(0.6)
  await p.keyboard.down('Shift')
  await p.keyboard.down(key)
  for (let t = 0; t < secs; t += 1) await adv(1)
  await p.keyboard.up(key)
  await p.keyboard.up('Shift')
  const w = await W()
  console.log(`  ${label}: ended at (${w.x.toFixed(1)}, ${w.z.toFixed(1)})`)
  return w
}
// 1. the arch → the boulevard across the Green → the spine → lane A and lane B to their far (west) ends → the spine end to end
let w = await run('arch west along the boulevard', -34, 47, -Math.PI / 2, 34)
check(w.x < HEIGHTS.spine.x1 + 6, `walks the boulevard from the arch to the spine (x ${w.x.toFixed(1)})`)
w = await run('lane A, east end run (13 plots)', -256, -13, -Math.PI / 2, 44)
check(w.x < -520, `reaches the far end of lane A (x ${w.x.toFixed(1)})`)
w = await run('lane B, east end run', -256, 45, -Math.PI / 2, 44)
check(w.x < -520, `reaches the far end of lane B (x ${w.x.toFixed(1)})`)
w = await run('spine north to south', -248, -38, 0, 14)
check(w.z > 60, `walks the spine from the north end (z ${w.z.toFixed(1)})`)
// 2. gate prompts on both gate directions, in each of the four rows, and the original plots A–D
const probe = async (label, x, z, yaw) => {
  await tp(x, z, yaw)
  await adv(0.9)
  const w = await W()
  console.log(`  ${label}: prompt = ${JSON.stringify(w.prompt)}`)
  return w.prompt
}
for (const id of ['H05', 'H18', 'H31', 'H44', 'A', 'D']) {
  const plot = PLOTS.find((q) => q.id === id)
  const g = plotGate(plot)
  const pr = await probe(`${plot.name} (row "${plot.row}", gate ${plot.gate})`, g.x, g.z + (plot.gate === 'n' ? -1.1 : 1.1), plot.gate === 'n' ? 0 : Math.PI)
  check(pr === `plot:${id}`, `${plot.name}: the gate offers its own build / buy prompt (${pr})`)
}
// the show homes stand on the Green and are not for sale
const pr = await probe('show-home lot', -198, 47.2, Math.PI)
check(!pr || !/plot:/.test(String(pr)), 'the show-home lots have no plot prompt')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
