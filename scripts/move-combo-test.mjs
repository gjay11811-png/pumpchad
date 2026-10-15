// Movement + sprint + jump together (desktop keys), reproduced before any change: hold W + Shift, press Space repeatedly, diagonals too.
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 900, height: 600 } })
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Explorer')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const wait = (ms) => p.waitForTimeout(ms)
// open cobbles, facing south (+z) down the forecourt: nothing to hit for ~12 m
await C('teleport', 0, 52.5, 0)
await wait(700)
const trace = async (label, keys, jumps, z0 = 52.5) => {
  await C('teleport', 0, z0, 0)
  await wait(500)
  for (const k of keys) await p.keyboard.down(k)
  await wait(900) // reach full speed
  const s0 = await C('anim')
  const w0 = await C('world')
  const samples = []
  for (let i = 0; i < jumps; i++) {
    await p.keyboard.press('Space')
    for (let k = 0; k < 9; k++) { await wait(100); const a = await C('anim'), w = await C('world'); samples.push({ sp: a.speed, x: w.x, z: w.z }) }
  }
  const w1 = await C('world')
  // only count samples while the run was still advancing (a wall / the end of open ground is not a momentum loss)
  let last = samples.length; for (let i = samples.length - 1; i > 0; i--) { if (Math.hypot(samples[i].x - samples[i - 1].x, samples[i].z - samples[i - 1].z) > 0.05) { last = i + 1; break } }
  if (process.env.DUMP) console.log(samples.map((q) => q.sp.toFixed(1) + '@' + q.x.toFixed(1) + ',' + q.z.toFixed(1)).join(' '))
  const speeds = samples.slice(0, last).map((q) => q.sp)
  const s1 = await C('anim')
  for (const k of keys) await p.keyboard.up(k)
  await wait(400)
  console.log(`  ${label}: speed before ${s0.speed}, min during ${Math.min(...speeds).toFixed(2)}, after ${s1.speed}, travelled ${Math.hypot(w1.x - w0.x, w1.z - w0.z).toFixed(1)} m in ${jumps} jump(s)`)
  return { s0, s1, min: Math.min(...speeds), dist: Math.hypot(w1.x - w0.x, w1.z - w0.z) }
}
let r = await trace('W + Shift + Space', ['w', 'Shift'], 1)
check(r.s0.speed > 6.5, `sprint reaches ~7.6 m/s before the jump (${r.s0.speed})`)
check(r.min > 4.5, `forward speed is kept through the jump (min ${r.min.toFixed(2)})`)
check(r.s1.speed > 6.5, `and after landing (${r.s1.speed})`)
r = await trace('W + Shift + 3 jumps', ['w', 'Shift'], 3, 38)
check(r.min > 4.5 && r.s1.speed > 6.5, 'repeated jumps keep the sprint')
r = await trace('W + D + Shift + Space (diagonal)', ['w', 'd', 'Shift'], 1, 36)
check(r.min > r.s0.speed * 0.6, `diagonal sprint-jump keeps momentum (min ${r.min.toFixed(2)})`)
// shift pressed AFTER jump begins, and released mid-air
await C('teleport', 0, 52.5, 0); await wait(500)
await p.keyboard.down('w'); await wait(500); await p.keyboard.press('Space'); await wait(120); await p.keyboard.down('Shift'); await wait(900)
const a = await C('anim')
await p.keyboard.up('Shift'); await p.keyboard.up('w'); await wait(300)
check(a.speed > 4, `Shift pressed mid-jump still sprints after landing (${a.speed})`)
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
