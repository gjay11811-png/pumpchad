// Phone multi-touch: joystick + camera drag + sprint + jump held/used at the same time, each finger independent.
// SIMULATED: real touch pointer events through Chrome DevTools on an emulated iPhone 13 — NOT a real phone.
import { chromium, devices } from 'playwright'
const URL = process.env.URL || 'http://localhost:5180/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const p = await ctx.newPage()
const errs = []
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
p.on('pageerror', (e) => errs.push(e.message))
await p.goto(URL, { waitUntil: 'networkidle' })
await p.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } }))
})
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Thumb Test')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
await p.waitForTimeout(1500)
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
const W = () => p.evaluate(() => window.__chadverse.world())
const IN = () => p.evaluate(() => window.__chadverse.input())
const A = () => p.evaluate(() => window.__chadverse.anim())
const wait = (ms) => p.waitForTimeout(ms)
const home = async () => {
  await p.evaluate(() => window.__chadverse.teleport(0, 40, Math.PI))
  await wait(500)
}
const center = async (sel) => {
  const bb = await p.locator(sel).first().boundingBox()
  return [bb.x + bb.width / 2, bb.y + bb.height / 2]
}
const tap = async (id, sel) => {
  const [x, y] = await center(sel)
  await down(id, x, y)
  await wait(50)
  await up(id)
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z)
const VW = p.viewportSize().width
const VH = p.viewportSize().height
const J = [90, VH - 120]
console.log('world keys:', Object.keys(await W()).join(','), '| anim keys:', Object.keys(await A()).join(','))

/* A. stick (finger 1) + camera drag (finger 2) at once */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await wait(300)
const a0 = await W()
await down(2, 300, 300)
for (let k = 1; k <= 12; k++) {
  await move(2, 300 + k * 12, 300)
  await wait(40)
}
const a1 = await W()
check(Math.abs(a1.camYaw - a0.camYaw) > 0.15, `camera turns while the stick is held (dyaw ${(a1.camYaw - a0.camYaw).toFixed(2)})`)
check(dist(a0, a1) > 1, `character keeps walking meanwhile (${dist(a0, a1).toFixed(1)} m)`)
const i1 = await IN()
check(i1.stick.active && i1.owner !== null, 'stick still owned by finger 1 during the camera drag')
/* B. lift the camera finger: still walking; lift stick: stops */
await up(2)
await wait(150)
const b0 = await W()
await wait(500)
const b1 = await W()
check(dist(b0, b1) > 0.8, 'releasing the camera finger does not stop the walk')
const yawA = (await W()).camYaw
await wait(300)
check(Math.abs((await W()).camYaw - yawA) < 0.02, 'and the camera stops turning')
await up(1)
await wait(700)
const c0 = await W()
await wait(700)
check(dist(c0, await W()) < 0.03, 'releasing the stick stops the walk (no drift)')

/* C. stick + sprint toggle + jump button */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await wait(400)
await tap(3, '[data-testid=sprint]')
check((await p.getAttribute('[data-testid=sprint]', 'aria-pressed')) === 'true', 'sprint toggled on with the stick held')
await wait(600)
const s0 = await A()
const w0 = await W()
const [jx, jy] = await center('[data-testid=jump-button]')
await down(4, jx, jy)
const sp = []
for (let k = 0; k < 8; k++) {
  await wait(100)
  sp.push((await A()).speed)
}
await up(4)
const w1 = await W()
check(dist(w0, w1) > 3, `moved ${dist(w0, w1).toFixed(1)} m while jumping`)
check(Math.min(...sp) > s0.speed * 0.6, `speed kept through the jump (before ${s0.speed}, min ${Math.min(...sp).toFixed(1)})`)
check((await IN()).stick.active, 'stick still held after the jump tap')
/* D. jump while ALSO dragging the camera */
await down(2, 300, 300)
const j0 = await W()
await down(4, jx, jy)
await up(4)
for (let k = 1; k <= 8; k++) {
  await move(2, 300 + k * 10, 300 + k * 3)
  await wait(60)
}
check(Math.abs((await W()).camYaw - j0.camYaw) > 0.1, 'camera drag works while sprinting and jumping')
await up(2)
await up(1)
await wait(900)
const d0 = await W()
await wait(700)
check(dist(d0, await W()) < 0.03, 'everything released: stopped, nothing stuck')
await tap(3, '[data-testid=sprint]')
/* E. lift the FIRST finger while the camera finger stays down */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await down(2, 300, 300)
await up(1)
await wait(150)
check(!(await IN()).stick.active, 'stick released when ITS finger lifts')
const e0 = (await W()).camYaw
for (let k = 1; k <= 8; k++) {
  await move(2, 300 + k * 12, 300)
  await wait(40)
}
check(Math.abs((await W()).camYaw - e0) > 0.1, 'camera finger unaffected by the stick finger lifting first')
await up(2)
/* F. interrupted touch: cancel while two fingers are down */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await down(2, 300, 300)
await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
active.clear()
await wait(900)
const f0 = await W()
await wait(700)
check(!(await IN()).stick.active && dist(f0, await W()) < 0.03, 'touchCancel with several fingers: nothing stuck')
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await wait(500)
check((await IN()).stick.active, 'a new touch works afterwards')
await up(1)
/* G. orientation change with the stick held */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await wait(200)
await p.setViewportSize({ width: VH, height: VW })
await p.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
await wait(900)
const g0 = await W()
await wait(600)
check(dist(g0, await W()) < 0.03 && !(await IN()).stick.active, 'rotation mid-walk: input cleared, no stuck movement')
active.clear()
const LJ = [90, VW - 70]
await down(5, ...LJ)
await move(5, LJ[0], LJ[1] - 40)
await wait(500)
check((await IN()).stick.active, 'landscape joystick works after rotating')
await down(6, 560, 120)
await move(6, 580, 120)
const yaw0 = (await W()).camYaw
for (let k = 1; k <= 12; k++) {
  await move(6, 580 + k * 12, 120)
  await wait(40)
}
check(Math.abs((await W()).camYaw - yaw0) > 0.05, 'landscape camera drag works with the stick held')
await up(6)
await up(5)
check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
