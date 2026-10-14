// Mobile controls: stuck-movement regression suite + the portrait challenges tab / sheet.
// Real multi-touch through Chrome DevTools (Input.dispatchTouchEvent → genuine touch pointer events), on an
// emulated iPhone 13 (390×844, touch, mobile). SIMULATED — not a real phone.
//   URL=http://localhost:4318/chadverse/ node scripts/mobile-input-test.mjs
import { chromium, devices } from 'playwright'
const URL = process.env.URL || 'http://localhost:4318/chadverse/'
const b = await chromium.launch({ executablePath: process.env.LOCALAPPDATA + '/ms-playwright/chromium-1228/chrome-win64/chrome.exe' })
const ctx = await b.newContext({ ...devices['iPhone 13'] })
const p = await ctx.newPage()
const errs = []
let fails = 0
const check = (ok, msg) => { console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) fails++ }
p.on('pageerror', (e) => errs.push(e.message))
p.on('console', (m) => m.type() === 'error' && !/WebGL|GLTFLoader|VALIDATE_STATUS/.test(m.text()) && errs.push(m.text().slice(0, 160)))
await p.goto(URL, { waitUntil: 'networkidle' })
await p.evaluate(() => {
  localStorage.clear()
  localStorage.setItem('pumpchad.chadverse.save', JSON.stringify({ version: 1, character: null, progress: { discoveries: ['intro_seen'] }, settings: { quality: 'low', muted: true } }))
})
await p.reload({ waitUntil: 'networkidle' })
await p.click('[data-testid=enter-muted]')
await p.waitForSelector('[role=tablist]')
await p.getByRole('tab', { name: 'Name' }).click()
await p.fill('#chad-name', 'Thumb Test')
await p.getByRole('button', { name: /Enter Chad Square/ }).click()
await p.waitForFunction(() => window.__chadverse?.phase === 'world' && window.__chadverse.world(), null, { timeout: 90000 })
await p.waitForTimeout(1500)

const cdp = await ctx.newCDPSession(p)
const active = new Map() // id → [x, y]
const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...active.entries()].map(([id, [x, y]]) => ({ x, y, id })) })
const down = async (id, x, y) => { active.set(id, [x, y]); await send('touchStart') }
const move = async (id, x, y) => { active.set(id, [x, y]); await send('touchMove') }
// CDP touchEnd lists the points being LIFTED (the others stay down)
const up = async (id) => {
  const [x, y] = active.get(id) ?? [0, 0]
  active.delete(id)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x, y, id }] })
}
const cancel = async () => { active.clear(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }) }
const W = () => p.evaluate(() => window.__chadverse.world())
const wait = (ms) => p.waitForTimeout(ms)
const IN = () => p.evaluate(() => window.__chadverse.input())
/** released means: the stick lets go at once (input state), and once the run's momentum settles nothing moves */
const stopped = async (label) => {
  await wait(60)
  const i = await IN()
  check(!i.stick.active && i.owner === null && i.move.x === 0 && i.move.z === 0, `${label}: directional input cleared at once`)
  await wait(450)
  const a = await W()
  await wait(700)
  const c = await W()
  const d = Math.hypot(c.x - a.x, c.z - a.z)
  check(d < 0.03, `${label}: character stays stopped (drift ${d.toFixed(3)} m over 0.7 s)`)
}
const walking = async (label) => {
  const a = await W()
  await wait(500)
  const c = await W()
  const d = Math.hypot(c.x - a.x, c.z - a.z)
  check(d > 0.25, `${label}: character walks (${d.toFixed(2)} m in 0.5 s)`)
}
const tapEl = async (sel, id = 9) => {
  const bb = await p.locator(sel).first().boundingBox()
  await down(id, bb.x + bb.width / 2, bb.y + bb.height / 2)
  await wait(60)
  await up(id)
}
const home = async () => {
  await p.evaluate(() => window.__chadverse.teleport(0, 13, Math.PI))
  await wait(400)
}
const VW = p.viewportSize().width
const VH = p.viewportSize().height // iPhone 13 profile: 390×664 (the browser's visible area)
const J = [90, VH - 120] // inside the joystick zone (bottom-left)

/* 1. walk, release → stops; joystick returns to centre */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await walking('walk')
await up(1)
await stopped('release')
check((await p.locator('[data-testid=joystick-zone] .fixed').count()) === 0, 'joystick knob returns to its resting place')

/* 2. full push = run, then release */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 70)
const r0 = await W()
await wait(500)
const r1 = await W()
check(Math.hypot(r1.x - r0.x, r1.z - r0.z) > 0.9, `full push runs (${Math.hypot(r1.x - r0.x, r1.z - r0.z).toFixed(2)} m in 0.5 s)`)
await up(1)
await stopped('release after running')

/* 3. drag far outside the joystick zone, release out there */
await home()
await down(1, ...J)
await move(1, 300, 200)
await walking('dragged outside the zone')
await up(1)
await stopped('released outside the zone')

/* 4. the browser cancels the touch */
await home()
await down(1, ...J)
await move(1, J[0] + 10, J[1] - 50)
await wait(200)
await cancel()
await stopped('touch cancelled')

/* 5. rapid tapping on the stick */
await home()
for (let i = 0; i < 12; i++) {
  await down(1, J[0] + (i % 3) * 6, J[1] - (i % 2) * 30)
  await move(1, J[0], J[1] - 45)
  await up(1)
}
await stopped('rapid taps')

/* 6. a second finger elsewhere (camera drag, sprint) while walking; lift it, still walking; lift the stick, stops */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await down(2, 300, 300)
await move(2, 340, 310)
await up(2)
await walking('still walking after a second finger')
await tapEl('[data-testid=sprint]', 3)
check((await p.getAttribute('[data-testid=sprint]', 'aria-pressed')) === 'true', 'sprint toggles on (labelled “Run on”)')
await up(1)
await stopped('sprint toggled on, stick released')
await tapEl('[data-testid=sprint]', 3)
check((await p.getAttribute('[data-testid=sprint]', 'aria-pressed')) === 'false', 'sprint toggles off')

/* 7. open the pause menu with a second finger while walking, let go during the menu, close it */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await wait(200)
await tapEl('button[aria-label="Pause menu"]', 4)
await wait(300)
await up(1)
await p.keyboard.press('Escape')
await wait(400)
await stopped('menu opened mid-walk, closed after release')

/* 8. photo mode while walking (the joystick hides), then leave photo mode */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await wait(200)
await tapEl('button[aria-label="Photo mode"]', 5)
await wait(300)
await up(1)
await p.keyboard.press('Escape')
await wait(500)
await stopped('photo mode entered mid-walk')

/* 9. the app goes to the background while the finger is still down (no release ever arrives) */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await wait(200)
await p.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: true, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
})
await stopped('app backgrounded mid-walk')
await p.evaluate(() => {
  Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
})
// the old finger's release never came — a new touch must still work
await down(6, ...J)
await move(6, J[0], J[1] - 50)
await walking('a fresh touch works after the lost one')
await up(6)
active.clear()
await cancel()
await stopped('after recovery')

/* 10. rotation while walking */
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await wait(200)
await p.setViewportSize({ width: VH, height: VW })
await p.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
await stopped('rotated to landscape mid-walk')
await cancel()
await p.setViewportSize({ width: VW, height: VH })
await p.evaluate(() => window.dispatchEvent(new Event('orientationchange')))
await wait(500)

/* 11. portrait challenges: compact tab, panel ≤ half height, scroll never moves the game, swipe-down / close */
const tab = p.locator('[data-testid=challenge-tab]')
check((await tab.count()) === 1, 'challenges collapse into a compact tab')
const tb = await tab.boundingBox()
check(tb && tb.height <= 44 && tb.width <= VW * 0.72, `tab is compact (${tb?.width.toFixed(0)}×${tb?.height.toFixed(0)} px)`)
await home()
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await wait(200)
await tapEl('[data-testid=challenge-tab]', 7)
await wait(500)
check((await p.locator('[data-testid=challenge-panel]').count()) === 1, 'tapping the tab opens the panel')
await up(1)
const pb = await p.locator('[data-testid=challenge-panel]').boundingBox()
check(pb && pb.height <= VH * 0.52, `panel stays within half the screen (${pb?.height.toFixed(0)} of ${VH} px)`)
const cards = await p.locator('[data-testid^=card-]').count()
check(cards >= 5, `scrollable challenge cards (${cards})`)
const before = await W()
const lb = await p.locator('[data-testid=challenge-list]').boundingBox()
await down(8, lb.x + lb.width / 2, lb.y + lb.height - 20)
for (let k = 1; k <= 6; k++) await move(8, lb.x + lb.width / 2 - k * 8, lb.y + lb.height - 20 - k * 25)
await up(8)
await wait(300)
const after = await W()
check(Math.hypot(after.x - before.x, after.z - before.z) < 0.02 && Math.abs(after.camYaw - before.camYaw) < 0.01, 'scrolling the panel never moves the character or the camera')
// rotate with the panel open: it stays open, layout recalculates
await p.setViewportSize({ width: VH, height: VW })
await wait(400)
check((await p.locator('[data-testid=challenge-panel]').count()) === 1, 'panel state survives rotation')
const lpb = await p.locator('[data-testid=challenge-panel]').boundingBox()
check(lpb && lpb.height <= VW && lpb.width < VH, `landscape panel fits (${lpb?.width.toFixed(0)}×${lpb?.height.toFixed(0)})`)
await p.setViewportSize({ width: VW, height: VH })
await wait(400)
// swipe down on the handle closes it
const hb = await p.locator('[data-testid=challenge-handle]').boundingBox()
await down(10, hb.x + hb.width / 2, hb.y + 15)
for (let k = 1; k <= 5; k++) await move(10, hb.x + hb.width / 2, hb.y + 15 + k * 30)
await up(10)
await wait(500)
check((await p.locator('[data-testid=challenge-panel]').count()) === 0, 'swipe down collapses the panel')
await tapEl('[data-testid=challenge-tab]', 7)
await wait(400)
await tapEl('[data-testid=challenge-close]', 7)
await wait(500)
check((await p.locator('[data-testid=challenge-panel]').count()) === 0, 'the close button collapses the panel')
await stopped('panel closed')
await down(1, ...J)
await move(1, J[0], J[1] - 50)
await walking('controls restored after closing the panel')
await up(1)
await stopped('final release')
// nothing overflows sideways
check(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal overflow in portrait')

/* 12. desktop keyboard still works (same page: keys) */
await home()
await p.keyboard.down('w')
await wait(500)
const k1 = await W()
await p.keyboard.up('w')
await stopped('keyboard: W released')
check(Math.abs(k1.z - 13) > 0.3, 'keyboard: W walks')

check(!errs.length, `no page errors (${JSON.stringify(errs.slice(0, 3))})`)
console.log(fails ? `${fails} FAILED` : 'ALL PASS')
await b.close()
process.exit(fails ? 1 : 0)
