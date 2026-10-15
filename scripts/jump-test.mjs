// Height-aware jumping through ordinary keys: clear / land on a low wall (a stone planter, 0.6 m), stay blocked by a tall one, and
// confirm jumping never opens the locked Valley Gate. Simulated desktop browser.
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:4318/chadverse/'
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
const P = Math.PI
// the west forecourt planter (x -13.3..-11.9, z 64.3..68.5, 0.6 m high) approached from the west along +x with nothing else in the way
const run = async (x, z, yaw, jumpAfter) => {
  await C('teleport', x, z, yaw)
  await wait(500)
  let maxY = 0
  let stood = false
  await p.keyboard.down('w')
  await wait(jumpAfter)
  await p.keyboard.press('Space')
  for (let i = 0; i < 28; i++) {
    await wait(100)
    const a = await C('anim')
    maxY = Math.max(maxY, a.jumpY)
    if (a.jumpY > 0.4 && !a.airborne) stood = true
  }
  await p.keyboard.up('w')
  await wait(700)
  return { w: await C('world'), a: await C('anim'), maxY, stood }
}
let r = await run(-16, 66.4, P / 2, 750)
console.log('  planter run:', JSON.stringify({ x: +r.w.x.toFixed(2), peak: r.maxY, stoodOnIt: r.stood, airborne: r.a.airborne }))
check(r.maxY >= 0.55, `a jump at the planter peaks above its 0.6 m top (peak ${r.maxY} m)`)
check(r.stood || r.w.x > -11.3, `the player stood on it or ended on the far side (x ${r.w.x.toFixed(2)}, stood ${r.stood})`)
check(r.w.x > -11.3, `and kept walking off the far side (x ${r.w.x.toFixed(2)} > -11.3)`)
// 2) a tall obstacle still blocks: the lamp post row / a building wall — the Valley Gate piers (3.6 m)
r = await run(0, 72.0, 0, 200)
check(r.w.z < 74.9, `jumping at the Valley Gate does not clear it (z ${r.w.z.toFixed(2)})`)
// 3) plain walking into the low planter without jumping is blocked
await C('teleport', -16, 66.4, P / 2)
await wait(500)
await p.keyboard.down('w')
await wait(2600)
await p.keyboard.up('w')
const w3 = await C('world')
check(w3.x < -13.2, `walking into the 0.6 m planter without a jump is blocked (x ${w3.x.toFixed(2)})`)
// 4) landing returns to normal movement
await C('teleport', 0, 20, 0)
await wait(400)
await p.keyboard.press('Space')
await wait(900)
const a4 = await C('anim')
check(!a4.airborne && a4.jumpY === 0, 'a jump on open ground lands back at 0 and is grounded again')
await p.keyboard.down('w'); await wait(900); await p.keyboard.up('w')
const w5 = await C('world')
check(Math.abs(w5.z - 20) > 1.2, 'normal movement resumes after landing')
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
