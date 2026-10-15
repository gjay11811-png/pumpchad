// Parkour HUD on an EMULATED iPhone 13 (portrait + landscape): start a run with the GO button (touch), screenshot the chip, run the joystick + jump.
//   URL=... SHOTS=dir node scripts/parkour-phone-shots.mjs      — SIMULATED, not a real phone
import { chromium, devices } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const OUT = process.env.SHOTS || '.'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const p = await ctx.newPage()
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { xp: 60000, discoveries: ['intro_seen', 'visit_parkour'] }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE)
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Phone Runner')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const cdp = await ctx.newCDPSession(p)
const active = new Map()
const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...active.entries()].map(([id, [x, y]]) => ({ x, y, id })) })
const down = async (id, x, y) => {
  active.set(id, [x, y])
  await send('touchStart')
}
const move = async (id, x, y) => {
  active.set(id, [x, y])
  await send('touchMove')
}
const up = async (id) => {
  const [x, y] = active.get(id) ?? [0, 0]
  active.delete(id)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x, y, id }] })
}
const wait = (ms) => p.waitForTimeout(ms)
const center = async (sel) => {
  const bb = await p.locator(sel).first().boundingBox()
  return [bb.x + bb.width / 2, bb.y + bb.height / 2]
}
const PK = () => p.evaluate(() => window.__chadverse.parkour())
await p.evaluate(() => window.__chadverse.teleport(-234, 22, Math.PI))
await wait(1200)
// start the run with the touch GO button
const goBtn = p.getByRole('button', { name: /Start Rookie Run/ })
check((await goBtn.count()) === 1, 'the GO button appears on the start pad')
const gb = await goBtn.boundingBox()
await down(5, gb.x + gb.width / 2, gb.y + gb.height / 2)
await wait(60)
await up(5)
await wait(600)
let s = await PK()
check(s.run?.id === 'rookie', 'tapping GO starts the Rookie Run on a phone')
await p.addStyleTag({ content: '.panel:not([data-testid=parkour-chip] .panel), [data-testid=objective] { opacity: 0 !important }' })
await p.screenshot({ path: `${OUT}/pk-phone-portrait.jpg`, quality: 80 })
const chip = await p.locator('[data-testid=parkour-chip] .panel').boundingBox()
const VW = p.viewportSize().width
check(chip && chip.x >= 0 && chip.x + chip.width <= VW, `the chip fits the portrait width (${chip?.width.toFixed(0)} of ${VW} px)`)
// walk with the joystick, jump with the Jump button, over the first wall
const VH = p.viewportSize().height
const J = [90, VH - 120]
await down(1, ...J)
await move(1, J[0], J[1] - 60)
const [jx, jy] = await center('[data-testid=jump-button]')
for (let i = 0; i < 40; i++) {
  const w = await p.evaluate(() => window.__chadverse.world())
  const pk = await PK()
  if (pk.run && w.z < 19.2 && w.z > 14 && !pk.trav && pk.grounded) {
    await down(2, jx, jy)
    await wait(40)
    await up(2)
  }
  if (w.z < 14) break
  await wait(80)
}
await up(1)
s = await PK()
const wz = (await p.evaluate(() => window.__chadverse.world())).z
check(wz < 16.5, `joystick + the Jump button vault the first wall on a phone (z ${wz.toFixed(1)}, last traversal ${JSON.stringify(s.travLog)})`)
// exit via the chip button (touch) after rotating to landscape
await p.setViewportSize({ width: VH, height: VW })
await wait(700)
await p.screenshot({ path: `${OUT}/pk-phone-landscape.jpg`, quality: 80 })
const chipL = await p.locator('[data-testid=parkour-chip] .panel').boundingBox()
check(chipL && chipL.x >= 0 && chipL.x + chipL.width <= VH, `the chip fits the landscape width (${chipL?.width.toFixed(0)} of ${VH} px)`)
const [ex, ey] = await center('[data-testid=parkour-chip] button:has-text("Exit")')
await down(3, ex, ey)
await wait(50)
await up(3)
await wait(500)
check((await PK()).run === null, 'the Exit chip button (a touch tap) ends the run')
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
