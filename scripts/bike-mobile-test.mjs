// Mobile controls, EMULATED: a touch-enabled browser context driven with raw multi-touch events over CDP (Input.dispatchTouchEvent) — real fingers on a real phone will differ.
// Checks: several touches held at once (gas + steering arrows + brake), independent tracking, camera drag not stealing a held button,
// release on cancel / focus loss / pause / dismount, buttons inside the usable screen and not overlapping, no walking buttons showing.
//   KIND=surron|street node scripts/bike-mobile-test.mjs
import { chromium } from 'playwright'
const BASE = process.env.URL || 'http://localhost:5180/chadverse/'
const KIND = process.env.KIND || 'surron'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-gpu-watchdog'] })
const VW = 844
const VH = 390
const ctx = await b.newContext({ viewport: { width: VW, height: VH }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 })
const p = await ctx.newPage()
let fails = 0
const check = (ok, msg) => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`)
  if (!ok) fails++
}
const errs = []
p.on('pageerror', (e) => errs.push(e.message))
await p.addInitScript(() => localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 2, character: null, progress: { discoveries: ['intro_seen'], xp: 800 }, settings: { quality: 'low', muted: true } })))
await p.goto(BASE + '?sky=day')
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Rider')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 120000 })
const cdp = await ctx.newCDPSession(p)
const B = () => p.evaluate(() => window.__chadverse.bike())
const adv = (s) => p.evaluate((s) => window.__chadverse.advance(s), s)
const set = (o) => p.evaluate((o) => window.__chadverse.setBike(o), o)
const touches = new Map()
const send = async (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...touches.entries()].map(([id, [x, y]]) => ({ x, y, id })) })
const touchStart = async (id, x, y) => (touches.set(id, [x, y]), await send('touchStart'), await p.waitForTimeout(90))
const touchMove = async (id, x, y) => (touches.set(id, [x, y]), await send('touchMove'), await p.waitForTimeout(80))
/** wait until the game has actually seen the stick at this side (x < 0 left, > 0 right, 0 centre): on the slow software renderer an input event can wait a second or more */
const stickSeen = (side) => p.waitForFunction((sd) => { const st = window.__chadverse.input().stick; return sd === 0 ? Math.abs(st.x) < 0.25 : sd > 0 ? st.x > 0.3 : st.x < -0.3 }, side, { timeout: 30000, polling: 50 })
const touchEnd = async (id) => {
  const pt = touches.get(id)
  touches.delete(id)
  // CDP touchEnd lists the fingers that LIFT (touchCancel takes none and cancels all)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: pt[0], y: pt[1], id }] })
}
const center = async (tid) => {
  const r = await p.locator(`[data-testid=${tid}]`).boundingBox()
  return [r.x + r.width / 2, r.y + r.height / 2]
}
const parked = (await B()).parked.find((x) => x.kind === KIND)
await p.evaluate(([x, z]) => window.__chadverse.teleport(x, z - 1.6, Math.PI), [parked.x, parked.z])
await adv(0.3)
await p.evaluate((k) => window.__chadverse.mountBike(k), KIND)
await adv(1)
await p.evaluate(() => window.__chadverse.freeze(true)) // game time moves only when this script says so
await set({ x: 0, z: 14, h: 0, v: 12 })
await adv(0.3)
check((await B()).riding, 'mounted (touch layout)')

/* layout: the virtual joystick on the left, GAS + BRAKE right, GET OFF; no REV, no rear / lean buttons, no steering arrows */
const ids = ['ride-throttle', 'ride-brake', 'ride-getoff']
const boxes = {}
for (const id of ids) boxes[id] = await p.locator(`[data-testid=${id}]`).boundingBox()
check(ids.every((id) => boxes[id] && boxes[id].x >= 0 && boxes[id].y >= 0 && boxes[id].x + boxes[id].width <= VW && boxes[id].y + boxes[id].height <= VH), 'every riding button sits inside the visible screen')
let overlap = false
for (let i = 0; i < ids.length; i++)
  for (let j = i + 1; j < ids.length; j++) {
    const a = boxes[ids[i]]
    const c = boxes[ids[j]]
    if (a.x < c.x + c.width && c.x < a.x + a.width && a.y < c.y + c.height && c.y < a.y + a.height) overlap = true
  }
check(!overlap, 'no riding button overlaps another')
const jz = await p.locator('[data-testid=joystick-zone]').boundingBox()
check(!!jz && jz.x < 20 && jz.x + jz.width <= VW / 2 + 4 && jz.height > 100, `the virtual joystick zone is on the left (${jz ? Math.round(jz.x) + ',' + Math.round(jz.y) + ' ' + Math.round(jz.width) + 'x' + Math.round(jz.height) : 'none'})`)
check(boxes['ride-throttle'].x > VW / 2 && boxes['ride-brake'].x > VW / 2, 'Gas and Brake are on the right')
check(boxes['ride-throttle'].width >= 60 && boxes['ride-brake'].width >= 60, `the main buttons are thumb-sized (gas ${Math.round(boxes['ride-throttle'].width)} px, brake ${Math.round(boxes['ride-brake'].width)} px)`)
const gone = await p.evaluate(() => ['ride-heave', 'ride-rear', 'ride-forward', 'ride-trick', 'ride-reverse', 'ride-left'].map((t) => !!document.querySelector(`[data-testid="${t}"]`)))
check(!gone[0] && !gone[1] && !gone[2] && !gone[5], 'there is no REV, rear-brake, lean button or steering arrows on the riding screen')
check(!gone[3] && !gone[4], 'ONE HAND and REVERSE are not shown while riding along at speed on the ground')
const hidden = await p.evaluate(() => ['sprint', 'jump-button', 'emote-button'].every((t) => { const e = document.querySelector(`[data-testid="${t}"]`); return !e || getComputedStyle(e).display === 'none' }))
check(hidden, 'the walking buttons (sprint / jump / emote) are hidden while riding (the joystick stays)')
check(await p.evaluate(() => ['hud-profile', 'objective-wrap'].every((t) => { const e = document.querySelector(`[data-testid="${t}"]`); return !e || getComputedStyle(e).display === 'none' })), 'the profile and objective panels fold away while riding')

/* several touches at once: gas (right thumb) + steer right arrow (left thumb) */
const [gx, gy] = await center('ride-throttle')
const jx = jz.x + jz.width * 0.4
const jy = jz.y + jz.height * 0.55
await touchStart(1, gx, gy)
await touchStart(3, jx, jy)
await touchMove(3, jx + 55, jy)
await stickSeen(1)
await adv(0.3)
let s = await B()
check(s.buttons.throttle && s.inputs.thr > 0.5, `Gas is held (throttle ${s.inputs.thr})`)
check(s.delta > 0.02, `the joystick steers right while the Gas is held (bars ${s.delta})`)
await touchMove(3, jx, jy)
await stickSeen(0)
await adv(0.2)
for (let i = 0; i < 30 && (await B()).phase !== 'riding'; i++) await adv(0.2)
await set({ x: 0, z: 14, h: 0, v: 10 })
await touchMove(3, jx - 55, jy)
await stickSeen(-1)
await adv(0.5)
s = await B()
check(s.buttons.throttle && s.delta < -0.02, `pushing the stick the other way steers left, Gas still held (bars ${s.delta})`)
await touchMove(3, jx, jy)
await stickSeen(0)
await adv(0.3)
await set({ x: 0, z: 14, h: 0, v: 10 })
await touchMove(3, jx + 12, jy - 70)
await stickSeen(0)
await adv(0.3)
s = await B()
check(s.buttons.throttle && !s.buttons.brake && s.inputs.thr > 0.5, 'the stick pushed UP does not mean gas or brake (the buttons own those)')
await touchEnd(3)
await adv(0.1)
for (let i = 0; i < 30 && (await B()).phase !== 'riding'; i++) await adv(0.2)
await set({ x: 0, z: 14, h: 0, v: 12 })
await adv(0.2)

/* a camera drag in empty screen space with a fourth finger must not release the held buttons */
console.log('   before4', JSON.stringify((await B()).buttons))
await touchStart(4, VW / 2, 120)
console.log('   after4', JSON.stringify((await B()).buttons))
await touchMove(4, VW / 2 + 60, 140)
console.log('   move4', JSON.stringify((await B()).buttons))
await adv(0.1)
s = await B()
console.log('   after drag', JSON.stringify({ b: s.buttons, i: s.inputs, phase: s.phase }))
check(s.buttons.throttle && s.inputs.thr > 0.5, 'a camera-drag finger does not steal the gas')
await touchEnd(4)
console.log('   after end4', JSON.stringify((await B()).buttons))

/* two fingers: gas + stick held, lifting the stick releases only steering */
await set({ x: 0, z: 14, h: 0, v: 12 })
await touchStart(2, jx, jy)
await touchMove(2, jx + 55, jy)
await stickSeen(1)
await adv(0.5)
await touchEnd(2)
await adv(0.9)
s = await B()
check(s.buttons.throttle && Math.abs(s.delta) < 0.06, `lifting the stick finger releases only steering (bars back to ${s.delta}); the Gas stays held`)

/* brake + stick together with the gas released */
const [bx, by] = await center('ride-brake')
await touchEnd(1)
for (let i = 0; i < 30 && (await B()).phase !== 'riding'; i++) await adv(0.2)
await set({ x: 0, z: 14, h: 0, v: 12 })
await touchStart(5, bx, by)
await touchStart(6, jx, jy)
await touchMove(6, jx - 55, jy)
await stickSeen(-1)
await adv(0.5)
s = await B()
check(s.buttons.brake && s.inputs.brk > 0.5 && s.delta < -0.05 && s.pitch === 0, `steering with the stick while Brake is held works (brake ${s.inputs.brk}, bars ${s.delta}, front planted)`)
await touchEnd(6)
await touchEnd(5)

/* touch cancel clears everything */
await touchStart(20, gx, gy)
await touchStart(21, bx, by)
await adv(0.2)
touches.clear()
await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
await adv(0.3)
s = await B()
check(!s.buttons.throttle && !s.buttons.brake && s.inputs.brk < 0.5, 'a cancelled touch releases all held buttons')

for (let i = 0; i < 30 && (await B()).phase !== 'riding'; i++) await adv(0.2) // (recovered from any bump)
/* REVERSE appears only when nearly stopped, and is separate from the gas */
await set({ x: 0, z: 14, h: 0, v: 0 })
await adv(0.6)
const rvBox = await p.locator('[data-testid=ride-reverse]').boundingBox().catch(() => null)
check(!!rvBox && rvBox.x + rvBox.width <= VW && rvBox.y + rvBox.height <= VH, 'the REVERSE button appears when the bike is nearly stopped, on screen')
if (rvBox) {
  await touchStart(11, rvBox.x + rvBox.width / 2, rvBox.y + rvBox.height / 2)
  await adv(1.5)
  s = await B()
  check(s.buttons.reverse && s.v < -0.5 && s.inputs.thr < 0.05, `holding Reverse backs the bike up without any gas (${s.v} m/s)`)
  await touchEnd(11)
  await adv(0.8)
}
await set({ x: 0, z: 14, h: 0, v: 9 })
await adv(0.5)
check(!(await p.locator('[data-testid=ride-reverse]').count()), 'REVERSE is hidden again once the bike is moving')

/* ONE HAND appears only inside a wheelie, changes only the pose, and the hand goes back on release */
await set({ x: 0, z: 14, h: 0, v: 5 })
let up2 = false
for (let i = 0; i < 6 && !up2; i++) {
  // a fresh press of the gas is a lift request: tap it
  await touchStart(12, gx, gy)
  await adv(0.15)
  await touchEnd(12)
  await adv(0.35)
  up2 = (await B()).pitch > 0.22
}
await adv(0.05)
const thBox = await p.locator('[data-testid=ride-trick]').boundingBox().catch(() => null)
check(up2 && !!thBox, `the ONE HAND button shows up only once the front wheel is up (${up2 ? 'wheelie up' : 'no lift'})`)
if (thBox) {
  await touchStart(13, thBox.x + thBox.width / 2, thBox.y + thBox.height / 2)
  await adv(0.5)
  s = await B()
  check(s.buttons.trick && s.oneHand > 0.6 && !s.crashed, `holding it raises the riders hand (pose ${s.oneHand}), no crash`)
  await touchEnd(13)
  await adv(0.9)
  s = await B()
  check(!s.buttons.trick && s.oneHand < 0.1, `releasing it returns the hand to the grip (pose ${s.oneHand})`)
}
await set({ x: 0, z: 14, h: 0, v: 3 })
await adv(2.5)
check(!(await p.locator('[data-testid=ride-trick]').count()), 'ONE HAND is gone again once the front wheel is down')

/* orientation change releases everything, and the portrait layout still fits */
await touchStart(14, gx, gy)
await adv(0.2)
check((await B()).buttons.throttle, 'gas held before the rotation')
await p.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
await adv(0.2)
check(!(await B()).buttons.throttle, 'an orientation change releases the held buttons')
await touchEnd(14)
await p.setViewportSize({ width: 390, height: 844 })
await adv(0.4)
const pids = ['ride-throttle', 'ride-brake', 'ride-getoff']
let pok = true
let pov = false
const pbx = []
for (const id of pids) {
  const bb = await p.locator(`[data-testid=${id}]`).boundingBox()
  pbx.push(bb)
  if (!bb || bb.x < 0 || bb.y < 0 || bb.x + bb.width > 390 || bb.y + bb.height > 844) pok = false
}
for (let i = 0; i < pbx.length; i++) for (let j = i + 1; j < pbx.length; j++) { const a2 = pbx[i], c2 = pbx[j]; if (a2 && c2 && a2.x < c2.x + c2.width && c2.x < a2.x + a2.width && a2.y < c2.y + c2.height && c2.y < a2.y + a2.height) pov = true }
check(pok && !pov, 'portrait: Gas, Brake and Get off are on screen and none overlap')
await p.screenshot({ path: (process.env.SHOT || 'mobile-after.jpg').replace('.jpg', '-portrait.jpg'), type: 'jpeg', quality: 70 })
await p.setViewportSize({ width: VW, height: VH })
await adv(0.3)

/* focus loss */
await touchStart(7, gx, gy)
await adv(0.3)
check((await B()).buttons.throttle, 'gas held again')
await p.evaluate(() => window.dispatchEvent(new Event('blur')))
await adv(0.3)
check(!(await B()).buttons.throttle, 'losing focus releases the buttons')
await touchEnd(7)

/* pause (hidden tab) */
await touchStart(8, gx, gy)
await adv(0.2)
await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
await adv(0.2)
check(!(await B()).buttons.throttle, 'the page being hidden / paused releases the buttons')
await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
await touchEnd(8)

/* Get off with a held button */
await set({ x: 0, z: 14, h: 0, v: 0 })
for (let i = 0; i < 40; i++) { const q = await B(); if (q.phase === 'riding' && q.pitch < 0.02 && Math.abs(q.v) < 0.5) break; await set({ x: 0, z: 14, h: 0, v: 0 }); await adv(0.3) } // front down, standing still
await touchStart(9, jx, jy) // (the stick stays held)
await adv(0.2)
const [ox, oy] = await center('ride-getoff')
await touchStart(10, ox, oy)
await touchEnd(10)
await adv(1.2)
s = await B()
check(!s.riding, 'Get off dismounts')
check(await p.evaluate(() => !window.__chadverse.bike().buttons), 'after dismount the riding buttons are gone, nothing is left held (walking controls back)')
await touchEnd(9)
check(errs.length === 0, `no page errors (${JSON.stringify(errs.slice(0, 2))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS (emulated touch)')
await p.screenshot({ path: process.env.SHOT || 'mobile-after.jpg', type: 'jpeg', quality: 70 })
await b.close()
process.exit(fails ? 1 : 0)
