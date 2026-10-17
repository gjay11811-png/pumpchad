// Mobile controls, EMULATED: a touch-enabled browser context driven with raw multi-touch events over CDP (Input.dispatchTouchEvent) — real fingers on a real phone will differ.
// Checks: several touches held at once (gas + lean back + joystick steer + brakes), independent tracking, camera drag not stealing a held button,
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
const touchStart = async (id, x, y) => (touches.set(id, [x, y]), send('touchStart'))
const touchMove = async (id, x, y) => (touches.set(id, [x, y]), send('touchMove'))
const touchEnd = async (id) => {
  touches.delete(id)
  await send('touchEnd')
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
await set({ x: 0, z: 14, h: 0, v: 8 })
await adv(0.3)
check((await B()).riding, 'mounted (touch layout)')

/* layout */
const ids = ['ride-throttle', 'ride-brake', 'ride-rear', 'ride-heave', 'ride-forward', 'ride-getoff']
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
const hidden = await p.evaluate(() => ['sprint', 'jump-button', 'emote-button'].every((t) => { const e = document.querySelector(`[data-testid="${t}"]`); return !e || getComputedStyle(e).display === 'none' }))
check(hidden, 'the walking buttons (sprint / jump / emote) are hidden while riding')
const jz = await p.locator('[data-testid=joystick-zone]').boundingBox()
check(!!jz && jz.x + jz.width <= boxes['ride-heave'].x + 1 || !!jz, `joystick zone present (${jz ? Math.round(jz.x) + ',' + Math.round(jz.y) + ' ' + Math.round(jz.width) + 'x' + Math.round(jz.height) : 'none'})`)

/* several touches at once: gas + lean back (two thumbs on the right) + joystick steer (left) */
const [gx, gy] = await center('ride-throttle')
const [hx, hy] = await center('ride-heave')
const jx = jz ? jz.x + jz.width / 2 : 120
const jy = jz ? jz.y + jz.height / 2 : 300
await touchStart(1, gx, gy)
await touchStart(2, hx, hy)
await touchStart(3, jx, jy)
await touchMove(3, jx + 55, jy)
await adv(0.6)
let s = await B()
check(s.buttons.throttle && s.buttons.heave, `gas and lean-back are both held (${JSON.stringify({ t: s.buttons.throttle, h: s.buttons.heave })})`)
check(s.inputs.thr > 0.5 && s.inputs.lean > 0.3, `the bike answers both (throttle ${s.inputs.thr}, lean ${s.inputs.lean})`)
check(Math.abs(s.delta) > 0.01, `the joystick steers at the same time (bars ${s.delta})`)

/* a camera drag in empty screen space with a fourth finger must not release the held buttons */
await touchStart(4, VW / 2, 120)
await touchMove(4, VW / 2 + 60, 140)
await adv(0.3)
s = await B()
check(s.buttons.throttle && s.buttons.heave && s.inputs.thr > 0.5, 'a camera-drag finger does not steal the throttle or lean')
await touchEnd(4)

/* lifting one finger releases only that control */
await touchEnd(2)
await adv(0.2)
s = await B()
check(s.buttons.throttle && !s.buttons.heave, 'lifting the lean-back finger releases only lean-back')

/* brake + rear brake together with gas released */
const [bx, by] = await center('ride-brake')
const [rx, ry] = await center('ride-rear')
await touchEnd(1)
await touchStart(5, bx, by)
await touchStart(6, rx, ry)
await adv(0.5)
s = await B()
check(s.buttons.brake && s.buttons.rear && s.inputs.brk > 0.5 && s.inputs.rbk > 0.5, `brake and rear brake can be held together (${s.inputs.brk}, ${s.inputs.rbk})`)

/* touch cancel clears everything */
await send('touchCancel')
touches.clear()
await adv(0.3)
s = await B()
check(!s.buttons.throttle && !s.buttons.brake && !s.buttons.rear && !s.buttons.heave && s.inputs.brk < 0.5, 'a cancelled touch releases all held buttons')

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
await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
await adv(0.2)
check(!(await B()).buttons.throttle, 'the page being hidden / paused releases the buttons')
await p.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })
await touchEnd(8)

/* Get off with a held button */
await set({ x: 0, z: 14, h: 0, v: 0 })
await adv(0.3)
await touchStart(9, gx, gy)
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
