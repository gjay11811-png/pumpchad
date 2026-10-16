// Riding with ORDINARY KEYS in a simulated browser (headless software GL — not a real phone, not a real GPU).
// The game renders ~1-2 fps there, so game time is advanced with the QA hook __chadverse.advance(sec) (fixed 60 Hz World.update, no rendering).
// Key presses are real keyboard events; the checks read the game's state.
//   mount → accelerate → steer → brake / reverse → rear brake → held wheelie with small corrections → rear-brake touchdown →
//   loop-out + recovery → wall → dismount → remount → pause/dismount release inputs.      KIND=surron|street node scripts/bike-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
const SPECIES = process.env.SPECIES || ''
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const p = await b.newPage({ viewport: { width: 800, height: 450 } })
const errs = []
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE + '?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
if (SPECIES) await p.click(`[data-testid=species-${SPECIES}]`)
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const B = () => p.evaluate(() => window.__chadverse.bike())
const W = () => p.evaluate(() => window.__chadverse.world())
const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
/** advance game time in 0.1 s slices until fn(state) is true (or maxSec passes); returns the state it ended on */
const until = async (fn, maxSec = 20, dt = 0.1) => {
  let s = await B()
  for (let t = 0; t < maxSec; t += dt) {
    if (fn(s)) return { ok: true, s }
    await adv(dt)
    s = await B()
  }
  return { ok: fn(s), s }
}
const set = (o) => p.evaluate((o) => window.__chadverse.setBike(o), o)
const down = (k) => p.keyboard.down(k)
const up = (k) => p.keyboard.up(k)
const deg = (r) => ((r * 180) / Math.PI).toFixed(0)
const parked = (await B()).parked.find((x) => x.kind === KIND)


await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
await adv(0.3)
await p.keyboard.press('e')
await adv(1)

const keys = {}
const press = async (k, on) => { if (!!keys[k] === on) return; keys[k] = on; await (on ? down(k) : up(k)) }
for (const v0 of [6, 8]) {
  await set({ x: 0, z: 10, h: 0, v: v0 })
  await adv(0.3)
  let held = 0, maxP = 0, line = ''
  for (let t = 0; t < 15; t += 0.05) {
    const s = await B()
    if (s.crashed || !s.riding) { line += ' CRASH@' + t.toFixed(1); break }
    maxP = Math.max(maxP, s.pitch)
    if (s.pitch > 0.3) held = Math.max(held, s.wheelieTime)
    if (s.z > 70) await set({ x: 0, z: 10 })
    const bal = s.balance
    const predicted = s.pitch + s.pitchRate * 0.25
    await press('Shift', s.pitch < bal * 0.45 && s.pitchRate < 0.9)
    await press('w', predicted < bal * 0.82 && s.v < 22)
    await press(' ', predicted > bal * 0.95)
    if (held > 6) break
    await adv(0.05)
  }
  console.log('v0', v0, 'held', held.toFixed(1), 'maxP', maxP.toFixed(2), line)
  await press('w', false); await press('Shift', false); await press(' ', false)
  await adv(3)
}
await b.close()
