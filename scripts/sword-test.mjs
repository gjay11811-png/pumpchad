// Sword Drill (Antique Estoc, CC0) with ordinary input: walk to the rack, E to take it up, step to the dummies, E to cut, score, the timer, results,
// the best is saved, the sword goes back on the rack. SIMULATED browser.   URL=... SHOTS=dir node scripts/sword-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const SHOTS = process.env.SHOTS || ''
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const p = await b.newPage({ viewport: { width: 1000, height: 640 } })
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen', 'visit_parkour'], xp: 3000 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Swordsman')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const C = (fn, ...a) => p.evaluate(([f, a]) => window.__chadverse[f](...a), [fn, a])
const wait = (ms) => p.waitForTimeout(ms)
const shot = async (n) => SHOTS && p.screenshot({ path: `${SHOTS}/${n}.jpg`, quality: 82 })
await C('teleport', -196, -11.2, 0)
await wait(1200)
check(((await C('world')).prompt ?? '') === 'sword', 'standing at the rack offers the Sword Drill')
await p.keyboard.press('e')
await wait(600)
let s = await C('sword')
check(s?.active && !s.done, 'E takes up the Estoc and starts the 30 s round')
// the three dummies are at z -12.2 / -11.0 / -12.2 (x -198.8, -196, -193.2): stand just south of the middle one, facing north (yaw PI)
await C('teleport', -196, -9.0, Math.PI)
await wait(800)
let swung = 0
for (let i = 0; i < 12; i++) {
  await p.keyboard.press('e')
  swung++
  await wait(520)
  if (i === 2) {
    await shot('sword-cut-1')
    const h = await C('handPos')
    const f = [0, -1]
    const r = [1, 0]
    await p.evaluate(([c, l]) => window.__chadverse.shotCam({ cam: c, look: l, fov: 45 }), [[h.x + r[0] * 2.2 - f[0] * 0.6, h.y + 0.4, h.z + r[1] * 2.2 - f[1] * 0.6 + 1.2], [h.x, h.y - 0.1, h.z - 0.5]])
    await wait(200)
    await shot('sword-cut-side')
    await p.evaluate(() => window.__chadverse.shotCam(null))
  }
}
s = await C('sword')
check(s.swings >= 8, `cuts are accepted one at a time (${s.swings} swings of ${swung} presses)`)
check(s.hits >= 5 && s.score > 0, `cuts that land on a dummy score (${s.hits} hits, score ${s.score}, best combo ×${s.bestCombo})`)
// a cut at empty air scores nothing: walk far from the dummies
const before = s.hits
await C('teleport', -210, -7, Math.PI / 2)
await wait(500)
for (let i = 0; i < 3; i++) {
  await p.keyboard.press('e')
  await wait(500)
}
s = await C('sword')
check(s.hits === before, 'cutting at empty air scores nothing')
// wait out the clock
await C('teleport', -196, -9.0, Math.PI)
await p.waitForFunction(() => window.__chadverse.sword()?.done, null, { timeout: 40000 })
s = await C('sword')
check(s.done && s.result && s.result.xp >= 0, `the round ends on the clock with a result (${JSON.stringify(s.result)})`)
await shot('sword-result')
await wait(900)
const sv = (await C('save')).progress
check((sv.records.sword_drill ?? 0) === s.score, `the best is saved (${sv.records.sword_drill})`)
await p.getByRole('button', { name: 'Done', exact: true }).click()
await wait(500)
s = await C('sword')
check(!s.active, 'Done puts the sword back and ends the drill')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
